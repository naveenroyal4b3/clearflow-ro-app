-- The business's UPI ID (for example name@okhdfcbank). Unpaid invoices then carry a scan-to-pay
-- UPI QR code for the bill amount. Owners can set it in Business details. Safe to run again.
alter table public.organizations
  add column if not exists upi_id text not null default '';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'organizations_upi_id_check') then
    alter table public.organizations add constraint organizations_upi_id_check
      check (upi_id = '' or upi_id ~ '^[A-Za-z0-9._-]{2,256}@[A-Za-z][A-Za-z0-9.-]{1,63}$');
  end if;
end;
$$;

grant update (upi_id) on public.organizations to authenticated;
