-- Väntelistan: anon får bara lägga till rader (inte läsa).
grant insert on public.bk_vantelista to anon, authenticated;
