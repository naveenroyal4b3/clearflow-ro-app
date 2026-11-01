-- Upgrades an existing Clearflow database (created from schema.sql before this change) with:
-- units and discounts on invoice lines, GSTIN and HSN checks for GST invoices, removal of deleted
-- accounts' details from the activity log, one-transaction workspace deletion, and a limit on app
-- error reports. Run once in the Supabase SQL Editor.
-- supabase/schema.sql already contains all of this for new databases.

begin;

alter table public.products add column if not exists unit text not null default 'Nos' check (length(unit) between 1 and 10);
alter table public.sales_document_items add column if not exists unit text not null default 'Nos';
alter table public.sales_document_items add column if not exists discount numeric(12,2) not null default 0 check (discount >= 0);

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
  item_discount numeric(12,2);
  gst_invoice boolean := p_document_type = 'Invoice' and coalesce(p_gst_enabled, false);
begin
  if public.current_app_role() is distinct from 'owner' then raise exception 'Only an owner can create sales documents'; end if;
  if p_document_type not in ('Quotation', 'Invoice') then raise exception 'Invalid document type'; end if;
  if jsonb_typeof(p_line_items) <> 'array' or jsonb_array_length(p_line_items) = 0 then raise exception 'At least one line item is required'; end if;
  if not exists (select 1 from public.customers c where c.organization_id = org_id and c.id = p_customer_id) then
    raise exception 'Customer does not belong to this organization';
  end if;
  -- Only a GST-registered business may charge GST, and a tax invoice must show each item's HSN code.
  if gst_invoice and not exists (select 1 from public.organizations o where o.id = org_id and coalesce(trim(o.gstin), '') <> '') then
    raise exception 'Add your GSTIN in Business details before issuing a GST invoice, or issue it without GST';
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
    item_discount := coalesce((item ->> 'discount')::numeric, 0);
    if item_discount < 0 or item_discount > item_quantity * item_price then raise exception 'A discount cannot be more than the line amount'; end if;

    select * into product_row
    from public.products p
    where p.organization_id = org_id and p.id = item ->> 'product_id' and p.active;
    if not found then raise exception 'Product does not belong to this organization or is inactive'; end if;
    if gst_invoice and trim(product_row.hsn_code) = '' then
      raise exception 'Add an HSN code to % in the catalogue before issuing a GST invoice', product_row.name;
    end if;

    if p_document_type = 'Invoice' then
      update public.products
      set stock = stock - item_quantity::integer, updated_at = now()
      where organization_id = org_id and id = product_row.id and stock >= item_quantity::integer;
      if not found then raise exception 'Insufficient stock for %', product_row.name; end if;
    end if;

    insert into public.sales_document_items (
      organization_id, document_id, product_id, product_name, hsn_code, unit, quantity, unit_price, discount, gst_rate
    ) values (
      org_id, document_id, product_row.id, product_row.name, product_row.hsn_code, product_row.unit, item_quantity, item_price, item_discount, product_row.gst_rate
    );
  end loop;

  return document_id;
end;
$$;

create or replace function public.redact_deleted_profile_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  personal_fields text[] := array['full_name', 'login_email', 'phone', 'business_name', 'business_address', 'gstin'];
begin
  update public.audit_log
  set old_data = old_data - personal_fields, new_data = new_data - personal_fields
  where table_name = 'profiles' and record_id = old.user_id::text;
  return old;
end;
$$;

revoke all on function public.redact_deleted_profile_audit() from public, anon, authenticated;
drop trigger if exists redact_profile_audit_on_delete on public.profiles;
create trigger redact_profile_audit_on_delete after delete on public.profiles
  for each row execute function public.redact_deleted_profile_audit();

-- Remove personal details already logged for accounts that were deleted before this change.
update public.audit_log a
set old_data = a.old_data - array['full_name', 'login_email', 'phone', 'business_name', 'business_address', 'gstin'],
    new_data = a.new_data - array['full_name', 'login_email', 'phone', 'business_name', 'business_address', 'gstin']
where a.table_name = 'profiles'
  and not exists (select 1 from public.profiles p where p.user_id::text = a.record_id);

create or replace function public.delete_organization(p_organization_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.feedback where organization_id = p_organization_id;
  delete from public.sales_document_items where organization_id = p_organization_id;
  delete from public.sales_documents where organization_id = p_organization_id;
  delete from public.document_counters where organization_id = p_organization_id;
  delete from public.service_jobs where organization_id = p_organization_id;
  delete from public.product_prices where organization_id = p_organization_id;
  delete from public.products where organization_id = p_organization_id;
  delete from public.profiles where organization_id = p_organization_id;
  delete from public.customers where organization_id = p_organization_id;
  delete from public.organizations where id = p_organization_id;
end;
$$;

revoke all on function public.delete_organization(uuid) from public, anon, authenticated;
grant execute on function public.delete_organization(uuid) to service_role;

create index if not exists client_errors_user_date_idx on public.client_errors (user_id, created_at desc);

create or replace function public.limit_client_errors()
returns trigger
language plpgsql
security definer
set search_path = ''
as $
declare
  hourly_limit integer;
begin
  -- Set apart from the IF: PL/pgSQL would end the IF condition at the THEN inside a CASE.
  hourly_limit := case when new.user_id is null then 300 else 50 end;
  if (
    select count(*) from public.client_errors e
    where e.user_id is not distinct from new.user_id and e.created_at > now() - interval '1 hour'
  ) >= hourly_limit then
    return null;
  end if;
  return new;
end;
$$;

revoke all on function public.limit_client_errors() from public, anon, authenticated;
drop trigger if exists limit_client_errors on public.client_errors;
create trigger limit_client_errors before insert on public.client_errors
  for each row execute function public.limit_client_errors();

commit;
