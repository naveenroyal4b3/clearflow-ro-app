-- Upgrades an existing Clearflow database (created from schema.sql before 2026-10-28) with:
-- GST invoice details, the audit log, and app error reporting. Run once in the Supabase SQL Editor.
-- supabase/schema.sql already contains all of this for new databases.

begin;

alter table public.organizations add column if not exists address text not null default '';
alter table public.organizations add column if not exists state_code text not null default '' check (state_code ~ '^([0-9]{2})?$');
alter table public.organizations add column if not exists phone text not null default '';
alter table public.customers add column if not exists gstin text not null default '';
alter table public.customers add column if not exists state_code text not null default '' check (state_code ~ '^([0-9]{2})?$');
alter table public.products add column if not exists hsn_code text not null default '';
alter table public.sales_document_items add column if not exists hsn_code text not null default '';
alter table public.sales_documents add column if not exists seller_name text not null default '';
alter table public.sales_documents add column if not exists seller_gstin text not null default '';
alter table public.sales_documents add column if not exists seller_address text not null default '';
alter table public.sales_documents add column if not exists seller_state_code text not null default '';
alter table public.sales_documents add column if not exists seller_phone text not null default '';
alter table public.sales_documents add column if not exists buyer_name text not null default '';
alter table public.sales_documents add column if not exists buyer_gstin text not null default '';
alter table public.sales_documents add column if not exists buyer_address text not null default '';
alter table public.sales_documents add column if not exists buyer_state_code text not null default '';

grant update (name, gstin, address, state_code, phone) on public.organizations to authenticated;

create or replace function public.create_sales_document(
  p_document_type text,
  p_customer_id text,
  p_document_date date,
  p_due_date date,
  p_gst_enabled boolean,
  p_line_items jsonb
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  org_id uuid := public.current_organization_id();
  document_year text;
  sequence_number bigint;
  document_id text;
  item jsonb;
  product_row public.products%rowtype;
  item_quantity numeric(10,2);
  item_price numeric(12,2);
begin
  if public.current_app_role() is distinct from 'owner' then raise exception 'Only an owner can create sales documents'; end if;
  if p_document_type not in ('Quotation', 'Invoice') then raise exception 'Invalid document type'; end if;
  if jsonb_typeof(p_line_items) <> 'array' or jsonb_array_length(p_line_items) = 0 then raise exception 'At least one line item is required'; end if;
  if not exists (select 1 from public.customers c where c.organization_id = org_id and c.id = p_customer_id) then
    raise exception 'Customer does not belong to this organization';
  end if;

  document_year := case
    when extract(month from p_document_date) >= 4 then
      to_char(p_document_date, 'YY') || '-' || to_char(p_document_date + interval '1 year', 'YY')
    else
      to_char(p_document_date - interval '1 year', 'YY') || '-' || to_char(p_document_date, 'YY')
  end;

  insert into public.document_counters as counter (organization_id, financial_year, document_type, last_number)
  values (org_id, document_year, p_document_type, 1)
  on conflict (organization_id, financial_year, document_type)
  do update set last_number = counter.last_number + 1
  returning last_number into sequence_number;

  document_id := case when p_document_type = 'Invoice' then 'INV-' else 'QT-' end
    || document_year || '-' || lpad(sequence_number::text, 4, '0');

  insert into public.sales_documents (
    id, organization_id, document_type, customer_id, document_date, due_date, gst_enabled, status, created_by,
    seller_name, seller_gstin, seller_address, seller_state_code, seller_phone,
    buyer_name, buyer_gstin, buyer_address, buyer_state_code
  )
  select
    document_id, org_id, p_document_type, p_customer_id, p_document_date, p_due_date, coalesce(p_gst_enabled, false),
    case when p_document_type = 'Invoice' then 'Pending' else 'Draft' end, auth.uid(),
    o.name, coalesce(o.gstin, ''), o.address, o.state_code, o.phone,
    c.name, c.gstin, c.address, c.state_code
  from public.organizations o
  join public.customers c on c.organization_id = o.id and c.id = p_customer_id
  where o.id = org_id;

  for item in select value from jsonb_array_elements(p_line_items)
  loop
    item_quantity := (item ->> 'quantity')::numeric;
    item_price := (item ->> 'unit_price')::numeric;
    if item_quantity is null or item_price is null or item_quantity <= 0 or item_price < 0 then raise exception 'Invalid line item quantity or price'; end if;
    if p_document_type = 'Invoice' and item_quantity <> trunc(item_quantity) then raise exception 'Invoice stock quantities must be whole units'; end if;

    select * into product_row
    from public.products p
    where p.organization_id = org_id and p.id = item ->> 'product_id' and p.active;
    if not found then raise exception 'Product does not belong to this organization or is inactive'; end if;

    if p_document_type = 'Invoice' then
      update public.products
      set stock = stock - item_quantity::integer, updated_at = now()
      where organization_id = org_id and id = product_row.id and stock >= item_quantity::integer;
      if not found then raise exception 'Insufficient stock for %', product_row.name; end if;
    end if;

    insert into public.sales_document_items (
      organization_id, document_id, product_id, product_name, hsn_code, quantity, unit_price, gst_rate
    ) values (
      org_id, document_id, product_row.id, product_row.name, product_row.hsn_code, item_quantity, item_price, product_row.gst_rate
    );
  end loop;

  return document_id;
end;
$$;

-- Audit trail: who changed which business record, and what it looked like before and after.
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  table_name text not null,
  record_id text not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  changed_by uuid default auth.uid(),
  changed_at timestamptz not null default now(),
  old_data jsonb,
  new_data jsonb
);

create index if not exists audit_log_organization_date_idx on public.audit_log (organization_id, changed_at desc);

create or replace function public.record_audit_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_data jsonb := to_jsonb(coalesce(new, old));
begin
  insert into public.audit_log (organization_id, table_name, record_id, action, changed_by, old_data, new_data)
  values (
    case when tg_table_name = 'organizations' then (row_data ->> 'id')::uuid else (row_data ->> 'organization_id')::uuid end,
    tg_table_name,
    case tg_table_name
      when 'profiles' then row_data ->> 'user_id'
      when 'product_prices' then (row_data ->> 'product_id') || ':' || (row_data ->> 'audience')
      else row_data ->> 'id'
    end,
    lower(tg_op),
    auth.uid(),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

revoke all on function public.record_audit_event() from public, anon, authenticated;

drop trigger if exists audit_customers on public.customers;
create trigger audit_customers after insert or update or delete on public.customers
  for each row execute function public.record_audit_event();
drop trigger if exists audit_products on public.products;
create trigger audit_products after insert or update or delete on public.products
  for each row execute function public.record_audit_event();
drop trigger if exists audit_product_prices on public.product_prices;
create trigger audit_product_prices after insert or update or delete on public.product_prices
  for each row execute function public.record_audit_event();
drop trigger if exists audit_service_jobs on public.service_jobs;
create trigger audit_service_jobs after insert or update or delete on public.service_jobs
  for each row execute function public.record_audit_event();
drop trigger if exists audit_sales_documents on public.sales_documents;
create trigger audit_sales_documents after insert or update or delete on public.sales_documents
  for each row execute function public.record_audit_event();
-- Profiles without an organization (a new owner before workspace setup) have nothing to audit.
drop trigger if exists audit_profiles_insert on public.profiles;
create trigger audit_profiles_insert after insert on public.profiles
  for each row when (new.organization_id is not null) execute function public.record_audit_event();
drop trigger if exists audit_profiles_update on public.profiles;
create trigger audit_profiles_update after update on public.profiles
  for each row when (coalesce(new.organization_id, old.organization_id) is not null) execute function public.record_audit_event();
drop trigger if exists audit_profiles_delete on public.profiles;
create trigger audit_profiles_delete after delete on public.profiles
  for each row when (old.organization_id is not null) execute function public.record_audit_event();
-- Deleting the organization removes its audit log, so only updates are recorded.
drop trigger if exists audit_organizations on public.organizations;
create trigger audit_organizations after update on public.organizations
  for each row execute function public.record_audit_event();

alter table public.audit_log enable row level security;
grant select on public.audit_log to authenticated;

drop policy if exists "Owners can read their organization's audit log" on public.audit_log;
create policy "Owners can read their organization's audit log"
  on public.audit_log for select to authenticated
  using (organization_id = (select public.current_organization_id()) and (select public.current_app_role()) = 'owner');

-- Errors reported by the app, so problems on users' phones are visible to the developer.
-- Readable only with the service key (Supabase dashboard); users can only add rows.
create table if not exists public.client_errors (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid default auth.uid(),
  message text not null check (length(message) <= 2000),
  stack text not null default '' check (length(stack) <= 8000),
  page text not null default '' check (length(page) <= 500),
  user_agent text not null default '' check (length(user_agent) <= 500),
  app_version text not null default '' check (length(app_version) <= 40)
);

alter table public.client_errors enable row level security;
grant insert (message, stack, page, user_agent, app_version) on public.client_errors to anon, authenticated;

drop policy if exists "Anyone can report an app error as themselves" on public.client_errors;
create policy "Anyone can report an app error as themselves"
  on public.client_errors for insert to anon, authenticated
  with check (user_id is not distinct from auth.uid());

commit;
