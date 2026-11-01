-- Upgrades an existing Clearflow database (created from schema.sql before 2026-11-01) with:
-- marking invoices paid or cancelled (cancelling returns stock). Run once in the Supabase SQL Editor.
-- supabase/schema.sql already contains all of this for new databases.

begin;

create or replace function public.set_sales_document_status(p_document_id text, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  org_id uuid := public.current_organization_id();
  doc public.sales_documents%rowtype;
begin
  if public.current_app_role() is distinct from 'owner' then raise exception 'Only an owner can change a document''s status'; end if;

  select * into doc
  from public.sales_documents d
  where d.organization_id = org_id and d.id = p_document_id
  for update;
  if not found then raise exception 'Document not found'; end if;
  if doc.status = p_status then return; end if;
  if doc.status = 'Cancelled' then raise exception 'A cancelled document cannot be changed'; end if;
  if not (
    doc.document_type = 'Invoice' and p_status in ('Pending', 'Paid', 'Cancelled')
    or doc.document_type = 'Quotation' and p_status in ('Draft', 'Sent', 'Cancelled')
  ) then
    raise exception 'A % cannot be marked %', lower(doc.document_type), p_status;
  end if;

  if doc.document_type = 'Invoice' and p_status = 'Cancelled' then
    update public.products p
    set stock = p.stock + returned.quantity, updated_at = now()
    from (
      select i.product_id, sum(i.quantity)::integer as quantity
      from public.sales_document_items i
      where i.organization_id = org_id and i.document_id = doc.id
      group by i.product_id
    ) returned
    where p.organization_id = org_id and p.id = returned.product_id;
  end if;

  update public.sales_documents
  set status = p_status
  where organization_id = org_id and id = doc.id;
end;
$$;

revoke all on function public.set_sales_document_status(text, text) from public, anon;
grant execute on function public.set_sales_document_status(text, text) to authenticated;

commit;
