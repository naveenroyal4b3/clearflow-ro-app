create extension if not exists pgcrypto;

create type public.app_role as enum ('owner', 'technician', 'shop', 'customer');
create type public.feedback_status as enum ('new', 'in_review', 'in_progress', 'planned', 'resolved', 'closed');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 160),
  gstin text,
  address text not null default '',
  state_code text not null default '' check (state_code ~ '^([0-9]{2})?$'),
  phone text not null default '',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  role public.app_role not null default 'owner',
  full_name text not null default '',
  login_email text not null default '',
  phone text not null default '',
  business_name text not null default '',
  business_address text not null default '',
  gstin text not null default '',
  customer_id text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, user_id),
  check ((role = 'customer' and customer_id is not null) or role <> 'customer')
);

create table public.customers (
  id text not null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  phone text not null,
  email text,
  address text not null default '',
  customer_type text not null default 'Residential' check (customer_type in ('Residential', 'Commercial', 'Apartment')),
  installed_on date,
  purifier text not null default '',
  notes text not null default '',
  gstin text not null default '',
  state_code text not null default '' check (state_code ~ '^([0-9]{2})?$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, id)
);

alter table public.profiles
  add constraint profiles_customer_fk
  foreign key (organization_id, customer_id)
  references public.customers(organization_id, id)
  on delete restrict;

create table public.products (
  id text not null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  category text not null check (category in ('Purifiers', 'Accessories', 'Spare parts')),
  description text not null default '',
  hsn_code text not null default '',
  stock integer not null default 0 check (stock >= 0),
  gst_rate numeric(5,2) not null default 18 check (gst_rate between 0 and 100),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, id)
);

create table public.product_prices (
  organization_id uuid not null,
  product_id text not null,
  audience public.app_role not null check (audience in ('customer', 'technician', 'shop')),
  amount numeric(12,2) not null check (amount >= 0),
  updated_at timestamptz not null default now(),
  primary key (organization_id, product_id, audience),
  foreign key (organization_id, product_id)
    references public.products(organization_id, id) on delete cascade
);

create table public.service_jobs (
  id text not null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id text not null,
  job_type text not null,
  scheduled_for date not null,
  technician_id uuid,
  technician_name text not null default '',
  status text not null default 'Scheduled' check (status in ('Scheduled', 'In progress', 'Completed', 'Cancelled')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, id),
  foreign key (organization_id, customer_id)
    references public.customers(organization_id, id),
  foreign key (organization_id, technician_id)
    references public.profiles(organization_id, user_id) on delete set null (technician_id)
);

create table public.sales_documents (
  id text not null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_type text not null check (document_type in ('Quotation', 'Invoice')),
  customer_id text not null,
  document_date date not null,
  due_date date,
  gst_enabled boolean not null default true,
  status text not null default 'Draft' check (status in ('Draft', 'Sent', 'Pending', 'Paid', 'Cancelled')),
  created_by uuid not null default auth.uid() references public.profiles(user_id),
  created_at timestamptz not null default now(),
  -- Seller and buyer details as they were when the document was issued, so later edits to the
  -- business or customer never change an issued GST invoice.
  seller_name text not null default '',
  seller_gstin text not null default '',
  seller_address text not null default '',
  seller_state_code text not null default '',
  seller_phone text not null default '',
  buyer_name text not null default '',
  buyer_gstin text not null default '',
  buyer_address text not null default '',
  buyer_state_code text not null default '',
  primary key (organization_id, id),
  foreign key (organization_id, customer_id)
    references public.customers(organization_id, id)
);

create table public.document_counters (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  financial_year text not null,
  document_type text not null check (document_type in ('Quotation', 'Invoice')),
  last_number bigint not null default 0 check (last_number >= 0),
  primary key (organization_id, financial_year, document_type)
);

create table public.sales_document_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  document_id text not null,
  product_id text not null,
  product_name text not null,
  hsn_code text not null default '',
  quantity numeric(10,2) not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  gst_rate numeric(5,2) not null check (gst_rate between 0 and 100),
  foreign key (organization_id, document_id)
    references public.sales_documents(organization_id, id) on delete cascade,
  foreign key (organization_id, product_id)
    references public.products(organization_id, id)
);

create table public.feedback (
  id text not null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  submitter_user_id uuid not null default auth.uid() references public.profiles(user_id),
  customer_id text,
  submitter_name text not null default '',
  submitter_phone text not null default '',
  submitter_email text not null default '',
  category text not null check (category in ('Customer feedback', 'Issue', 'Bug', 'Feature request')),
  priority text not null default 'Normal' check (priority in ('Normal', 'High', 'Urgent')),
  title text not null check (length(trim(title)) between 1 and 100),
  description text not null check (length(trim(description)) between 1 and 2000),
  reference text not null default '',
  status public.feedback_status not null default 'new',
  created_at timestamptz not null default now(),
  primary key (organization_id, id),
  foreign key (organization_id, customer_id)
    references public.customers(organization_id, id)
);

create index service_jobs_technician_schedule_idx on public.service_jobs (technician_id, scheduled_for);
create index service_jobs_customer_schedule_idx on public.service_jobs (organization_id, customer_id, scheduled_for desc);
create index sales_documents_customer_date_idx on public.sales_documents (organization_id, customer_id, document_date desc);
create index feedback_submitter_date_idx on public.feedback (submitter_user_id, created_at desc);

create function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  invited_role public.app_role;
begin
  invited_role := coalesce((new.raw_app_meta_data ->> 'role')::public.app_role, 'owner'::public.app_role);
  insert into public.profiles (user_id, organization_id, role, full_name, login_email, phone, customer_id)
  values (
    new.id,
    nullif(new.raw_app_meta_data ->> 'organization_id', '')::uuid,
    invited_role,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    nullif(new.raw_app_meta_data ->> 'customer_id', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

create function public.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.organization_id
  from public.profiles p
  where p.user_id = (select auth.uid()) and p.active;
$$;

create function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.user_id = (select auth.uid()) and p.active;
$$;

create function public.current_customer_id()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.customer_id
  from public.profiles p
  where p.user_id = (select auth.uid()) and p.active and p.role = 'customer';
$$;

create function public.create_organization(organization_name text, organization_gstin text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_organization_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in is required';
  end if;

  if exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.organization_id is not null) then
    raise exception 'This account already belongs to an organization';
  end if;

  insert into public.organizations (name, gstin, created_by)
  values (trim(organization_name), nullif(trim(organization_gstin), ''), auth.uid())
  returning id into new_organization_id;

  update public.profiles
  set organization_id = new_organization_id, role = 'owner'
  where user_id = auth.uid();

  return new_organization_id;
end;
$$;

create function public.set_feedback_status(feedback_id text, next_status public.feedback_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.current_app_role() is distinct from 'owner' then
    raise exception 'Only an owner can update feedback status';
  end if;

  update public.feedback
  set status = next_status
  where organization_id = public.current_organization_id() and id = feedback_id;
end;
$$;

create function public.set_service_job_status(job_id text, next_status text, job_notes text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role public.app_role := public.current_app_role();
begin
  if actor_role is distinct from 'owner' and actor_role is distinct from 'technician' then
    raise exception 'This account cannot update service jobs';
  end if;
  if actor_role = 'technician' and next_status not in ('In progress', 'Completed') then
    raise exception 'Technicians may only start or complete assigned jobs';
  end if;

  update public.service_jobs
  set status = next_status,
      notes = coalesce(job_notes, notes),
      updated_at = now()
  where organization_id = public.current_organization_id()
    and id = job_id
    and (actor_role = 'owner' or technician_id = auth.uid());

  if not found then raise exception 'Service job not found or not assigned to this technician'; end if;
end;
$$;

create function public.create_sales_document(
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

revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
revoke all on function public.current_organization_id() from public, anon;
revoke all on function public.current_app_role() from public, anon;
revoke all on function public.current_customer_id() from public, anon;
revoke all on function public.create_organization(text, text) from public, anon;
revoke all on function public.set_feedback_status(text, public.feedback_status) from public, anon;
revoke all on function public.set_service_job_status(text, text, text) from public, anon;
revoke all on function public.create_sales_document(text, text, date, date, boolean, jsonb) from public, anon;
grant execute on function public.current_organization_id() to authenticated;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.current_customer_id() to authenticated;
grant execute on function public.create_organization(text, text) to authenticated;
grant execute on function public.set_feedback_status(text, public.feedback_status) to authenticated;
grant execute on function public.set_service_job_status(text, text, text) to authenticated;
grant execute on function public.create_sales_document(text, text, date, date, boolean, jsonb) to authenticated;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.products enable row level security;
alter table public.product_prices enable row level security;
alter table public.service_jobs enable row level security;
alter table public.sales_documents enable row level security;
alter table public.document_counters enable row level security;
alter table public.sales_document_items enable row level security;
alter table public.feedback enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.organizations to authenticated;
revoke insert, update, delete on public.organizations from authenticated;
grant update (name, gstin, address, state_code, phone) on public.organizations to authenticated;
grant select on public.profiles to authenticated;
revoke insert, update, delete on public.profiles from authenticated;
grant update (role, full_name, phone, business_name, business_address, gstin, customer_id, active) on public.profiles to authenticated;
grant select, insert, update, delete on public.customers to authenticated;
grant select, insert, update, delete on public.products to authenticated;
grant select, insert, update, delete on public.product_prices to authenticated;
grant select, insert, update, delete on public.service_jobs to authenticated;
grant select, insert, update, delete on public.sales_documents to authenticated;
grant select, insert, update, delete on public.sales_document_items to authenticated;
grant select, insert, update, delete on public.feedback to authenticated;

create policy "Members can read their organization"
  on public.organizations for select to authenticated
  using (id = (select public.current_organization_id()));

create policy "Owners can update their organization"
  on public.organizations for update to authenticated
  using (id = (select public.current_organization_id()) and (select public.current_app_role()) = 'owner')
  with check (id = (select public.current_organization_id()) and (select public.current_app_role()) = 'owner');

create policy "Users can read their own profile and owners can read team profiles"
  on public.profiles for select to authenticated
  using (
    user_id = (select auth.uid())
    or (organization_id = (select public.current_organization_id()) and (select public.current_app_role()) = 'owner')
  );

create policy "Owners can update team profiles"
  on public.profiles for update to authenticated
  using (organization_id = (select public.current_organization_id()) and (select public.current_app_role()) = 'owner')
  with check (organization_id = (select public.current_organization_id()) and (select public.current_app_role()) = 'owner');

create policy "Staff and linked customers can read customers"
  on public.customers for select to authenticated
  using (
    organization_id = (select public.current_organization_id())
    and (
      (select public.current_app_role()) = 'owner'
      or (select public.current_app_role()) = 'technician' and exists (
        select 1 from public.service_jobs job
        where job.organization_id = customers.organization_id
          and job.customer_id = customers.id
          and job.technician_id = (select auth.uid())
      )
      or id = (select public.current_customer_id())
    )
  );

create policy "Owners can manage customers"
  on public.customers for all to authenticated
  using (organization_id = (select public.current_organization_id()) and (select public.current_app_role()) = 'owner')
  with check (organization_id = (select public.current_organization_id()) and (select public.current_app_role()) = 'owner');

create policy "Organization members can read products"
  on public.products for select to authenticated
  using (organization_id = (select public.current_organization_id()));

create policy "Owners can manage products"
  on public.products for all to authenticated
  using (organization_id = (select public.current_organization_id()) and (select public.current_app_role()) = 'owner')
  with check (organization_id = (select public.current_organization_id()) and (select public.current_app_role()) = 'owner');

create policy "Users can read only their own price tier"
  on public.product_prices for select to authenticated
  using (
    organization_id = (select public.current_organization_id())
    and ((select public.current_app_role()) = 'owner' or audience = (select public.current_app_role()))
  );

create policy "Owners can manage product prices"
  on public.product_prices for all to authenticated
  using (organization_id = (select public.current_organization_id()) and (select public.current_app_role()) = 'owner')
  with check (organization_id = (select public.current_organization_id()) and (select public.current_app_role()) = 'owner');

create policy "Users can read assigned service jobs"
  on public.service_jobs for select to authenticated
  using (
    organization_id = (select public.current_organization_id())
    and (
      (select public.current_app_role()) = 'owner'
      or (select public.current_app_role()) = 'technician' and technician_id = (select auth.uid())
      or (select public.current_app_role()) = 'customer' and customer_id = (select public.current_customer_id())
    )
  );

create policy "Owners can manage service jobs"
  on public.service_jobs for all to authenticated
  using (organization_id = (select public.current_organization_id()) and (select public.current_app_role()) = 'owner')
  with check (organization_id = (select public.current_organization_id()) and (select public.current_app_role()) = 'owner');

create policy "Owners and linked customers can read sales documents"
  on public.sales_documents for select to authenticated
  using (
    organization_id = (select public.current_organization_id())
    and ((select public.current_app_role()) = 'owner' or customer_id = (select public.current_customer_id()))
  );

create policy "Users can read visible sales document items"
  on public.sales_document_items for select to authenticated
  using (
    organization_id = (select public.current_organization_id())
    and exists (
      select 1 from public.sales_documents d
      where d.organization_id = sales_document_items.organization_id
        and d.id = sales_document_items.document_id
    )
  );

create policy "Users can read their feedback and staff can triage"
  on public.feedback for select to authenticated
  using (
    organization_id = (select public.current_organization_id())
    and (
      submitter_user_id = (select auth.uid())
      or (select public.current_app_role()) in ('owner', 'technician')
    )
  );

create policy "Organization members can submit feedback"
  on public.feedback for insert to authenticated
  with check (
    organization_id = (select public.current_organization_id())
    and submitter_user_id = (select auth.uid())
    and ((select public.current_app_role()) <> 'customer' or customer_id = (select public.current_customer_id()))
  );

create policy "Owners can update feedback"
  on public.feedback for update to authenticated
  using (organization_id = (select public.current_organization_id()) and (select public.current_app_role()) = 'owner')
  with check (organization_id = (select public.current_organization_id()) and (select public.current_app_role()) = 'owner');

revoke all on public.document_counters from anon, authenticated;
-- Audit trail: who changed which business record, and what it looked like before and after.
create table public.audit_log (
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

create index audit_log_organization_date_idx on public.audit_log (organization_id, changed_at desc);

create function public.record_audit_event()
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

create trigger audit_customers after insert or update or delete on public.customers
  for each row execute function public.record_audit_event();
create trigger audit_products after insert or update or delete on public.products
  for each row execute function public.record_audit_event();
create trigger audit_product_prices after insert or update or delete on public.product_prices
  for each row execute function public.record_audit_event();
create trigger audit_service_jobs after insert or update or delete on public.service_jobs
  for each row execute function public.record_audit_event();
create trigger audit_sales_documents after insert or update or delete on public.sales_documents
  for each row execute function public.record_audit_event();
-- Profiles without an organization (a new owner before workspace setup) have nothing to audit.
create trigger audit_profiles_insert after insert on public.profiles
  for each row when (new.organization_id is not null) execute function public.record_audit_event();
create trigger audit_profiles_update after update on public.profiles
  for each row when (coalesce(new.organization_id, old.organization_id) is not null) execute function public.record_audit_event();
create trigger audit_profiles_delete after delete on public.profiles
  for each row when (old.organization_id is not null) execute function public.record_audit_event();
-- Deleting the organization removes its audit log, so only updates are recorded.
create trigger audit_organizations after update on public.organizations
  for each row execute function public.record_audit_event();

alter table public.audit_log enable row level security;
grant select on public.audit_log to authenticated;

create policy "Owners can read their organization's audit log"
  on public.audit_log for select to authenticated
  using (organization_id = (select public.current_organization_id()) and (select public.current_app_role()) = 'owner');

-- Errors reported by the app, so problems on users' phones are visible to the developer.
-- Readable only with the service key (Supabase dashboard); users can only add rows.
create table public.client_errors (
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

create policy "Anyone can report an app error as themselves"
  on public.client_errors for insert to anon, authenticated
  with check (user_id is not distinct from auth.uid());
