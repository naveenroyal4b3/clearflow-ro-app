-- A business's phone must be a real Indian mobile number. The database cleans it to 10 digits
-- (dropping spaces, dashes and a +91, 91 or 0 in front) and refuses anything else whenever the
-- phone is changed, so older app versions cannot save a fake number either. A new business starts
-- with no phone (create_organization), and the apps ask for it in the same setup step.
-- Safe to run more than once.

create or replace function public.check_organization_phone()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  digits text := regexp_replace(coalesce(new.phone, ''), '\D', '', 'g');
begin
  if length(digits) = 12 and left(digits, 2) = '91' then
    digits := right(digits, 10);
  elsif length(digits) = 11 and left(digits, 1) = '0' then
    digits := right(digits, 10);
  end if;
  if digits !~ '^[6-9][0-9]{9}$' then
    raise exception 'Enter a valid 10-digit mobile number';
  end if;
  new.phone := digits;
  return new;
end;
$$;
revoke all on function public.check_organization_phone() from public, anon, authenticated;

drop trigger if exists check_organization_phone on public.organizations;
create trigger check_organization_phone before update of phone on public.organizations
  for each row when (new.phone is distinct from old.phone)
  execute function public.check_organization_phone();
