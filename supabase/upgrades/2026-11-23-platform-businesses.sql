-- Every business with its plan and usage, for the TiruFix team's Businesses screen. Returns rows
-- only to platform admins; anyone else gets an empty list. Safe to run again.
create or replace function public.platform_businesses()
returns table (
  id uuid, name text, phone text, owner_name text, owner_email text, signed_up timestamptz,
  trial_ends_at timestamptz, paid_until timestamptz, plan_interval text,
  last_sign_in timestamptz, last_activity timestamptz,
  customers bigint, products bigint, jobs bigint, invoices bigint, invoices_30d bigint, team bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, o.name, o.phone, owner.full_name, u.email, o.created_at,
         o.trial_ends_at, o.paid_until, o.plan_interval,
         (select max(au.last_sign_in_at) from public.profiles p join auth.users au on au.id = p.user_id where p.organization_id = o.id),
         (select max(a.changed_at) from public.audit_log a where a.organization_id = o.id and a.changed_by is not null),
         (select count(*) from public.customers c where c.organization_id = o.id),
         (select count(*) from public.products p where p.organization_id = o.id),
         (select count(*) from public.service_jobs j where j.organization_id = o.id),
         (select count(*) from public.sales_documents d where d.organization_id = o.id and d.document_type = 'Invoice' and d.status <> 'Cancelled'),
         (select count(*) from public.sales_documents d where d.organization_id = o.id and d.document_type = 'Invoice' and d.status <> 'Cancelled' and d.created_at > now() - interval '30 days'),
         (select count(*) from public.profiles p where p.organization_id = o.id)
  from public.organizations o
  left join auth.users u on u.id = o.created_by
  left join public.profiles owner on owner.user_id = o.created_by
  where public.is_platform_admin()
  order by o.created_at desc;
$$;
revoke all on function public.platform_businesses() from public, anon;
grant execute on function public.platform_businesses() to authenticated;
