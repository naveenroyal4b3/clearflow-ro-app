-- AMC contracts (yearly maintenance contracts with included visits and a renewal date), suppliers
-- and purchase bills. Saving a purchase bill adds its quantities to stock; deleting it takes them
-- off again. Owners only. Safe to run again.

create table if not exists public.amc_contracts (
  id text not null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id text not null,
  appliance text not null default '',
  starts_on date not null,
  ends_on date not null,
  amount numeric(12, 2) not null default 0 check (amount >= 0),
  visits_included smallint not null default 0 check (visits_included between 0 and 52),
  visits_used smallint not null default 0 check (visits_used between 0 and 52),
  notes text not null default '',
  status text not null default 'Active' check (status in ('Active', 'Cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, id),
  foreign key (organization_id, customer_id) references public.customers(organization_id, id),
  check (ends_on >= starts_on)
);

create table if not exists public.suppliers (
  id text not null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 160),
  phone text not null default '',
  gstin text not null default '',
  state_code text not null default '' check (state_code ~ '^([0-9]{2})?$'),
  address text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, id)
);

create table if not exists public.purchase_bills (
  id text not null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  supplier_id text not null,
  bill_number text not null default '',
  bill_date date not null,
  gst_enabled boolean not null default true,
  notes text not null default '',
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (organization_id, id),
  foreign key (organization_id, supplier_id) references public.suppliers(organization_id, id)
);

create table if not exists public.purchase_bill_items (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  bill_id text not null,
  line_no smallint not null,
  product_id text not null,
  quantity integer not null check (quantity > 0),
  rate numeric(12, 2) not null check (rate >= 0),
  gst_rate numeric(5, 2) not null default 0 check (gst_rate between 0 and 100),
  primary key (organization_id, bill_id, line_no),
  foreign key (organization_id, bill_id) references public.purchase_bills(organization_id, id) on delete cascade,
  foreign key (organization_id, product_id) references public.products(organization_id, id)
);

grant select, insert, update, delete on public.amc_contracts, public.suppliers, public.purchase_bills, public.purchase_bill_items to authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['amc_contracts', 'suppliers', 'purchase_bills', 'purchase_bill_items']
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists "Owners manage %s" on public.%I', table_name, table_name);
    execute format('create policy "Owners manage %s" on public.%I for all to authenticated using (organization_id = (select public.current_organization_id()) and (select public.current_app_role()) = ''owner'') with check (organization_id = (select public.current_organization_id()) and (select public.current_app_role()) = ''owner'')', table_name, table_name);
    -- Like the other business tables, nothing can be added or changed once the plan has ended.
    execute format('drop trigger if exists require_active_plan on public.%I', table_name);
    execute format('create trigger require_active_plan before insert or update on public.%I for each row execute function public.require_active_plan()', table_name);
  end loop;
  foreach table_name in array array['amc_contracts', 'suppliers', 'purchase_bills']
  loop
    execute format('drop trigger if exists audit_%s on public.%I', table_name, table_name);
    execute format('create trigger audit_%s after insert or update or delete on public.%I for each row execute function public.record_audit_event()', table_name, table_name);
  end loop;
end;
$$;

-- Saves a purchase bill with its lines and adds the quantities to stock, all or nothing.
-- p_items: [{ "productId": "P-1", "qty": 2, "rate": 450, "gst": 18 }, ...]
create or replace function public.create_purchase_bill(p_id text, p_supplier_id text, p_bill_number text, p_bill_date date, p_gst_enabled boolean, p_items jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  org_id uuid := public.current_organization_id();
begin
  if public.current_app_role() is distinct from 'owner' then
    raise exception 'Only the business owner can add purchase bills';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Add at least one item';
  end if;
  insert into public.purchase_bills (id, organization_id, supplier_id, bill_number, bill_date, gst_enabled)
  values (p_id, org_id, p_supplier_id, coalesce(trim(p_bill_number), ''), p_bill_date, coalesce(p_gst_enabled, true));
  insert into public.purchase_bill_items (organization_id, bill_id, line_no, product_id, quantity, rate, gst_rate)
  select org_id, p_id, item.position, item.value ->> 'productId', (item.value ->> 'qty')::integer, (item.value ->> 'rate')::numeric, coalesce((item.value ->> 'gst')::numeric, 0)
  from jsonb_array_elements(p_items) with ordinality as item(value, position);
  update public.products p
  set stock = coalesce(p.stock, 0) + added.quantity, updated_at = now()
  from (
    select product_id, sum(quantity)::integer as quantity
    from public.purchase_bill_items
    where organization_id = org_id and bill_id = p_id
    group by product_id
  ) added
  where p.organization_id = org_id and p.id = added.product_id;
  return p_id;
end;
$$;

-- Deletes a purchase bill and takes its quantities off stock again (never below zero).
create or replace function public.delete_purchase_bill(p_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  org_id uuid := public.current_organization_id();
begin
  if public.current_app_role() is distinct from 'owner' then
    raise exception 'Only the business owner can delete purchase bills';
  end if;
  update public.products p
  set stock = greatest(coalesce(p.stock, 0) - removed.quantity, 0), updated_at = now()
  from (
    select product_id, sum(quantity)::integer as quantity
    from public.purchase_bill_items
    where organization_id = org_id and bill_id = p_id
    group by product_id
  ) removed
  where p.organization_id = org_id and p.id = removed.product_id;
  delete from public.purchase_bills where organization_id = org_id and id = p_id;
  if not found then raise exception 'Purchase bill not found'; end if;
end;
$$;

revoke all on function public.create_purchase_bill(text, text, text, date, boolean, jsonb) from public, anon;
revoke all on function public.delete_purchase_bill(text) from public, anon;
grant execute on function public.create_purchase_bill(text, text, text, date, boolean, jsonb) to authenticated;
grant execute on function public.delete_purchase_bill(text) to authenticated;
