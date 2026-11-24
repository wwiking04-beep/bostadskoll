-- Bostadskoll: bevakningar av bostadsköer med påminnelser.
create extension if not exists pg_cron;

create table if not exists public.bk_profiler (
  user_id uuid primary key references auth.users(id) on delete cascade,
  epost text,
  premium boolean not null default false,
  mejl_paminnelser boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.bk_bevakningar (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  ko_slug text not null,
  senast_atgard date not null,
  intervall_dagar int not null check (intervall_dagar between 7 and 1100),
  anteckning text check (char_length(anteckning) <= 300),
  created_at timestamptz not null default now(),
  unique (user_id, ko_slug)
);
create index if not exists bk_bevakningar_user on public.bk_bevakningar(user_id);

create table if not exists public.bk_vantelista (
  id bigint generated always as identity primary key,
  epost text not null unique check (epost ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(epost) <= 200),
  plan text check (plan in ('manad','ar')),
  created_at timestamptz not null default now()
);

create table if not exists public.bk_paminnelser (
  id bigint generated always as identity primary key,
  bevakning_id bigint not null references public.bk_bevakningar(id) on delete cascade,
  deadline date not null,
  dagar_kvar int not null,
  status text not null default 'vantar' check (status in ('vantar','skickad','torrkorning','fel')),
  skapad timestamptz not null default now(),
  skickad timestamptz,
  unique (bevakning_id, deadline, dagar_kvar)
);

alter table public.bk_profiler enable row level security;
alter table public.bk_bevakningar enable row level security;
alter table public.bk_vantelista enable row level security;
alter table public.bk_paminnelser enable row level security;

drop policy if exists "egen profil läs" on public.bk_profiler;
create policy "egen profil läs" on public.bk_profiler for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "egen profil ändra" on public.bk_profiler;
create policy "egen profil ändra" on public.bk_profiler for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- premium får inte ändras av användaren själv
revoke update on public.bk_profiler from authenticated;
grant update (mejl_paminnelser) on public.bk_profiler to authenticated;

drop policy if exists "egna bevakningar" on public.bk_bevakningar;
create policy "egna bevakningar" on public.bk_bevakningar for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "skriv upp sig" on public.bk_vantelista;
create policy "skriv upp sig" on public.bk_vantelista for insert to anon, authenticated with check (true);
revoke select, update, delete on public.bk_vantelista from anon, authenticated;

-- bk_paminnelser: ingen åtkomst för klienter (bara service role / cron)

-- Profil skapas när en användare registreras
create or replace function public.bk_ny_anvandare() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.bk_profiler(user_id, epost) values (new.id, new.email) on conflict do nothing;
  return new;
end $$;
drop trigger if exists bk_ny_anvandare on auth.users;
create trigger bk_ny_anvandare after insert on auth.users for each row execute function public.bk_ny_anvandare();

-- Gratis: en kö. Premium: obegränsat.
create or replace function public.bk_kontrollera_grans() returns trigger
language plpgsql security definer set search_path = public as $$
declare antal int; ar_premium boolean;
begin
  select coalesce(premium,false) into ar_premium from public.bk_profiler where user_id = new.user_id;
  select count(*) into antal from public.bk_bevakningar where user_id = new.user_id;
  if not coalesce(ar_premium,false) and antal >= 1 then
    raise exception 'GRATISGRANS: Gratisversionen bevakar en kö. Premium ger obegränsat.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists bk_grans on public.bk_bevakningar;
create trigger bk_grans before insert on public.bk_bevakningar for each row execute function public.bk_kontrollera_grans();

-- Köar påminnelser 30, 7 och 1 dag före (och dagen då fristen gått ut). Skickar inget själv.
create or replace function public.bk_koa_paminnelser() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into public.bk_paminnelser(bevakning_id, deadline, dagar_kvar)
  select b.id, b.senast_atgard + b.intervall_dagar, (b.senast_atgard + b.intervall_dagar) - current_date
  from public.bk_bevakningar b
  join public.bk_profiler p on p.user_id = b.user_id and p.mejl_paminnelser
  where (b.senast_atgard + b.intervall_dagar) - current_date in (30, 7, 1, 0)
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.bk_koa_paminnelser() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'bostadskoll-paminnelser';
select cron.schedule('bostadskoll-paminnelser', '0 6 * * *', 'select public.bk_koa_paminnelser()');
