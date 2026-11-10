-- Upgrades an existing Clearflow database (created from schema.sql before 2026-11-10) with:
-- free trials and paid plans. Run once in the Supabase SQL Editor.
-- supabase/schema.sql already contains all of this for new databases.
-- Existing businesses get a 7-day trial from when this runs.

begin;

-- Plans: every business gets a free trial, then needs a paid plan (bought on the website through
-- Razorpay) to add or change records. Without an active plan the workspace stays readable, so
-- invoices can still be viewed and exported. Only the Razorpay webhook (service key) sets
-- paid_until; owners cannot change these columns.
alter table public.organizations
  add column if not exists trial_ends_at timestamptz not null default (now() + interval '7 days'),
  add column if not exists paid_until timestamptz,
  add column if not exists plan_interval text check (plan_interval in ('monthly', 'yearly')),
  add column if not exists razorpay_subscription_id text;

create or replace function public.organization_plan_active(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organizations o
    where o.id = org_id and greatest(o.trial_ends_at, coalesce(o.paid_until, '-infinity'::timestamptz)) > now()
  );
$$;

-- Blocks signed-in users from adding or changing business records once the plan has ended. It is a
-- trigger, not a policy, so it also covers the security-definer functions (invoices, job status).
-- Deletes stay allowed so an owner can still delete their account. The service key (no auth.uid())
-- is not limited.
create or replace function public.require_active_plan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and not public.organization_plan_active(new.organization_id) then
    raise exception 'This business''s plan has ended. Renew it to add or change records.'
      using errcode = 'P0001', hint = 'plan_ended';
  end if;
  return new;
end;
$$;

revoke all on function public.organization_plan_active(uuid) from public, anon;
grant execute on function public.organization_plan_active(uuid) to authenticated;
revoke all on function public.require_active_plan() from public, anon, authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['customers', 'products', 'product_prices', 'service_jobs', 'sales_documents', 'sales_document_items']
  loop
    execute format('drop trigger if exists require_active_plan on public.%I', table_name);
    execute format('create trigger require_active_plan before insert or update on public.%I for each row execute function public.require_active_plan()', table_name);
  end loop;
end;
$$;

commit;
