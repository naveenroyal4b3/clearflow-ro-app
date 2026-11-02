-- Upgrades an existing Clearflow database (created from schema.sql before 2026-11-02) with:
-- one device per login. Run once in the Supabase SQL Editor.
-- supabase/schema.sql already contains all of this for new databases.

begin;

create or replace function public.signed_in_elsewhere()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.sessions s
    where s.user_id = (select auth.uid())
      and s.id is distinct from nullif((select auth.jwt()) ->> 'session_id', '')::uuid
  );
$$;

revoke all on function public.signed_in_elsewhere() from public, anon;
grant execute on function public.signed_in_elsewhere() to authenticated;

commit;
