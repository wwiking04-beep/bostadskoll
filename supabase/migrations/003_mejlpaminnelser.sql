-- Mejlpåminnelser utan konto: dubbel bekräftelse, avregistrering i varje mejl.
-- Klienter når inget direkt. Bara Bostadskolls serverfunktioner (Vercel) anropar
-- funktionerna nedan, med en hemlighet som ligger i bk_hemlighet och i Vercels miljövariabler.

create table if not exists public.bk_hemlighet (id int primary key default 1 check (id = 1), v text not null);

create table if not exists public.bk_mejl_forfragningar (
  token text primary key,
  epost text not null check (epost ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(epost) <= 200),
  koer jsonb not null check (jsonb_typeof(koer) = 'array' and jsonb_array_length(koer) between 1 and 30),
  skapad timestamptz not null default now()
);
create index if not exists bk_mejl_forfragningar_epost on public.bk_mejl_forfragningar(epost, skapad);

create table if not exists public.bk_mejl_prenumeranter (
  id bigint generated always as identity primary key,
  epost text not null unique,
  avreg text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  bekraftad timestamptz not null default now()
);

create table if not exists public.bk_mejl_koer (
  id bigint generated always as identity primary key,
  prenumerant_id bigint not null references public.bk_mejl_prenumeranter(id) on delete cascade,
  ko_slug text not null check (ko_slug ~ '^[a-z0-9-]{2,60}$'),
  senast date not null,
  intervall_dagar int not null check (intervall_dagar between 7 and 1100),
  unique (prenumerant_id, ko_slug)
);

create table if not exists public.bk_mejl_skickat (
  ko_id bigint not null references public.bk_mejl_koer(id) on delete cascade,
  deadline date not null,
  dagar_kvar int not null,
  status text not null,
  tid timestamptz not null default now(),
  primary key (ko_id, deadline, dagar_kvar)
);

alter table public.bk_hemlighet enable row level security;
alter table public.bk_mejl_forfragningar enable row level security;
alter table public.bk_mejl_prenumeranter enable row level security;
alter table public.bk_mejl_koer enable row level security;
alter table public.bk_mejl_skickat enable row level security;
revoke all on public.bk_hemlighet, public.bk_mejl_forfragningar, public.bk_mejl_prenumeranter, public.bk_mejl_koer, public.bk_mejl_skickat from anon, authenticated;

create or replace function public.bk_kontroll(p_h text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_h is null or not exists (select 1 from public.bk_hemlighet where v = p_h) then
    raise exception 'NEKAD' using errcode = '42501';
  end if;
end $$;
revoke execute on function public.bk_kontroll(text) from public, anon, authenticated;

-- Ny begäran: returnerar bekräftelsetoken (skickas bara i mejlet).
create or replace function public.bk_mejl_begar(p_h text, p_epost text, p_koer jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare t text; e text := lower(trim(p_epost));
begin
  perform public.bk_kontroll(p_h);
  delete from public.bk_mejl_forfragningar where skapad < now() - interval '7 days';
  if (select count(*) from public.bk_mejl_forfragningar where epost = e and skapad > now() - interval '1 hour') >= 3 then
    raise exception 'FOROFTA' using errcode = 'P0001';
  end if;
  if (select count(*) from public.bk_mejl_forfragningar where skapad > now() - interval '1 day') >= 300 then
    raise exception 'FULLT' using errcode = 'P0001';
  end if;
  t := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into public.bk_mejl_forfragningar(token, epost, koer) values (t, e, p_koer);
  return t;
end $$;

-- Bekräfta: aktiverar prenumerationen och lägger in (eller uppdaterar) köerna.
create or replace function public.bk_mejl_bekrafta(p_h text, p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare f public.bk_mejl_forfragningar; pid bigint; a text; k jsonb;
begin
  perform public.bk_kontroll(p_h);
  delete from public.bk_mejl_forfragningar where token = p_token and skapad > now() - interval '7 days' returning * into f;
  if f.token is null then return null; end if;
  insert into public.bk_mejl_prenumeranter(epost) values (f.epost)
    on conflict (epost) do update set bekraftad = now() returning id, avreg into pid, a;
  for k in select * from jsonb_array_elements(f.koer) loop
    insert into public.bk_mejl_koer(prenumerant_id, ko_slug, senast, intervall_dagar)
      values (pid, k->>'slug', (k->>'senast')::date, (k->>'intervall')::int)
      on conflict (prenumerant_id, ko_slug) do update set senast = excluded.senast, intervall_dagar = excluded.intervall_dagar;
  end loop;
  return jsonb_build_object('epost', f.epost, 'avreg', a, 'koer', f.koer);
end $$;

create or replace function public.bk_mejl_avregistrera(p_h text, p_avreg text) returns text
language plpgsql security definer set search_path = public as $$
declare e text;
begin
  perform public.bk_kontroll(p_h);
  delete from public.bk_mejl_prenumeranter where avreg = p_avreg returning epost into e;
  return e;
end $$;

-- "Klart idag" från ett påminnelsemejl: ny frist räknas från p_datum.
create or replace function public.bk_mejl_klar(p_h text, p_avreg text, p_slug text, p_datum date) returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  perform public.bk_kontroll(p_h);
  update public.bk_mejl_koer k set senast = p_datum
    from public.bk_mejl_prenumeranter p
    where p.id = k.prenumerant_id and p.avreg = p_avreg and k.ko_slug = p_slug;
  get diagnostics n = row_count;
  return n > 0;
end $$;

-- Påminnelser som ska ut idag (30, 7, 1 och 0 dagar före), som inte redan skickats.
create or replace function public.bk_mejl_att_skicka(p_h text, p_idag date)
returns table(ko_id bigint, epost text, avreg text, ko_slug text, senast date, deadline date, dagar_kvar int)
language plpgsql security definer set search_path = public as $$
begin
  perform public.bk_kontroll(p_h);
  return query
  select k.id, p.epost, p.avreg, k.ko_slug, k.senast, k.senast + k.intervall_dagar, (k.senast + k.intervall_dagar) - p_idag
  from public.bk_mejl_koer k join public.bk_mejl_prenumeranter p on p.id = k.prenumerant_id
  where (k.senast + k.intervall_dagar) - p_idag in (30, 7, 1, 0)
    and not exists (select 1 from public.bk_mejl_skickat s where s.ko_id = k.id and s.deadline = k.senast + k.intervall_dagar
                    and s.dagar_kvar = (k.senast + k.intervall_dagar) - p_idag and s.status = 'skickad')
  order by p.epost
  limit 500;
end $$;

create or replace function public.bk_mejl_skickad(p_h text, p_ko_id bigint, p_deadline date, p_dagar int, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.bk_kontroll(p_h);
  insert into public.bk_mejl_skickat(ko_id, deadline, dagar_kvar, status) values (p_ko_id, p_deadline, p_dagar, p_status)
    on conflict (ko_id, deadline, dagar_kvar) do update set status = excluded.status, tid = now();
end $$;

-- Funktionerna skyddas av hemligheten; anon får anropa dem via PostgREST.
revoke execute on function public.bk_mejl_begar(text, text, jsonb), public.bk_mejl_bekrafta(text, text),
  public.bk_mejl_avregistrera(text, text), public.bk_mejl_klar(text, text, text, date),
  public.bk_mejl_att_skicka(text, date), public.bk_mejl_skickad(text, bigint, date, int, text) from public;
grant execute on function public.bk_mejl_begar(text, text, jsonb), public.bk_mejl_bekrafta(text, text),
  public.bk_mejl_avregistrera(text, text), public.bk_mejl_klar(text, text, text, date),
  public.bk_mejl_att_skicka(text, date), public.bk_mejl_skickad(text, bigint, date, int, text) to anon;
