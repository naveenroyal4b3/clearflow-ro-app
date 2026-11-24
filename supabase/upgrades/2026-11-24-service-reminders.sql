-- Service-due reminders: each customer can have a regular service interval (in months) and a next
-- service date. When a service job for that customer is completed, the next service date moves on
-- by the interval, counted from the day it was completed. Safe to run again.
alter table public.customers
  add column if not exists service_every_months smallint check (service_every_months between 1 and 60),
  add column if not exists next_service_on date;

-- Runs as the table owner so a technician completing a job also moves the customer's date on (they
-- cannot edit customers themselves).
create or replace function public.advance_next_service()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'Completed' and (tg_op = 'INSERT' or old.status is distinct from 'Completed') then
    update public.customers c
    set next_service_on = (current_date + make_interval(months => c.service_every_months))::date,
        updated_at = now()
    where c.organization_id = new.organization_id
      and c.id = new.customer_id
      and c.service_every_months is not null;
  end if;
  return new;
end;
$$;
revoke all on function public.advance_next_service() from public, anon, authenticated;

drop trigger if exists advance_next_service on public.service_jobs;
create trigger advance_next_service after insert or update of status on public.service_jobs
  for each row execute function public.advance_next_service();
