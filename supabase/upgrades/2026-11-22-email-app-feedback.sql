-- Emails every platform admin when a business sends feedback to Clearflow (the Suggest button on
-- the website, the chat icon in the app). Sent through Resend (resend.com) with pg_net, after the
-- feedback is saved; if the email fails, the feedback is still saved.
-- Needs the Resend API key in Supabase Vault first (run once, with your own key):
--   select vault.create_secret('re_your_key_here', 'resend_api_key');
-- Without that secret no email is sent. Not part of schema.sql: needs Supabase's pg_net and Vault.
-- Safe to run more than once.

-- pg_net is available on Supabase; the plain Postgres used to check this script in CI has none.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net;
  end if;
end;
$$;

create or replace function public.email_app_feedback()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  api_key text;
  recipients jsonb;
begin
  select decrypted_secret into api_key from vault.decrypted_secrets where name = 'resend_api_key' limit 1;
  select jsonb_agg(u.email) into recipients
    from public.platform_admins a join auth.users u on u.id = a.user_id
    where u.email is not null;
  if api_key is null or recipients is null then
    return new;
  end if;
  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object('Authorization', 'Bearer ' || api_key, 'Content-Type', 'application/json'),
    body := jsonb_build_object(
      'from', 'Clearflow RO <onboarding@resend.dev>',
      'to', recipients,
      'subject', 'Clearflow ' || lower(new.kind) || ' from ' || coalesce(nullif(new.business, ''), nullif(new.name, ''), new.email),
      'text', new.message || E'\n\n'
        || 'From: ' || new.name || ' (' || new.role || ')' || E'\n'
        || 'Business: ' || new.business || E'\n'
        || 'Phone: ' || new.phone || E'\n'
        || 'Email: ' || new.email || E'\n'
        || 'Where: ' || new.page || ' · ' || new.platform || ' ' || new.app_version || E'\n\n'
        || 'All feedback: https://clearflowro.in/ (Suggest > See all app feedback)'
    )
  );
  return new;
exception when others then
  -- An email problem must never stop the feedback from being saved.
  return new;
end;
$$;
revoke all on function public.email_app_feedback() from public, anon, authenticated;

drop trigger if exists email_app_feedback on public.app_feedback;
create trigger email_app_feedback after insert on public.app_feedback
  for each row execute function public.email_app_feedback();
