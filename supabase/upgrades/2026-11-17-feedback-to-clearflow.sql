-- App feedback: suggestions and problems about the app itself, sent from any page by anyone signed
-- in, and read only by platform admins (the app's operator). Separate from public.feedback, which
-- a business's customers and staff send to that business.
-- Who sent it, their business and role are filled in by the database, so they cannot be faked.
-- Safe to run more than once. Needs 2026-11-17-catalog-photos.sql (is_platform_admin) first.

create table if not exists public.app_feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete set null,
  business text not null default '',
  role text not null default '',
  name text not null default '',
  email text not null default '',
  phone text not null default '',
  kind text not null check (kind in ('Suggestion', 'Problem')),
  page text not null default '' check (length(page) <= 60),
  message text not null check (length(trim(message)) between 1 and 2000),
  platform text not null check (platform in ('web', 'android', 'ios')),
  app_version text not null default '' check (length(app_version) <= 40)
);
create index if not exists app_feedback_created_idx on public.app_feedback (created_at desc);
create index if not exists app_feedback_user_created_idx on public.app_feedback (user_id, created_at desc);

create or replace function public.fill_app_feedback()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  sender public.profiles%rowtype;
begin
  new.user_id := (select auth.uid());
  new.created_at := now();
  if (select count(*) from public.app_feedback where user_id = new.user_id and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Too much feedback sent in the last hour. Try again later.';
  end if;
  select * into sender from public.profiles where user_id = new.user_id;
  new.organization_id := sender.organization_id;
  new.role := coalesce(sender.role::text, '');
  new.name := coalesce(sender.full_name, '');
  new.email := coalesce(nullif(sender.login_email, ''), (select email from auth.users where id = new.user_id), '');
  new.phone := coalesce(sender.phone, '');
  new.business := coalesce((select name from public.organizations where id = sender.organization_id), '');
  return new;
end;
$$;
revoke all on function public.fill_app_feedback() from public, anon, authenticated;

drop trigger if exists fill_app_feedback on public.app_feedback;
create trigger fill_app_feedback before insert on public.app_feedback
  for each row execute function public.fill_app_feedback();

alter table public.app_feedback enable row level security;
revoke all on public.app_feedback from anon, authenticated;
grant insert (kind, page, message, platform, app_version) on public.app_feedback to authenticated;
grant select, delete on public.app_feedback to authenticated;

drop policy if exists "Signed-in users can send app feedback" on public.app_feedback;
create policy "Signed-in users can send app feedback"
  on public.app_feedback for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists "Platform admins can read app feedback" on public.app_feedback;
create policy "Platform admins can read app feedback"
  on public.app_feedback for select to authenticated using ((select public.is_platform_admin()));

drop policy if exists "Platform admins can remove app feedback" on public.app_feedback;
create policy "Platform admins can remove app feedback"
  on public.app_feedback for delete to authenticated using ((select public.is_platform_admin()));
