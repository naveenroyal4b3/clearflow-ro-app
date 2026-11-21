-- A business's phone must be a real mobile number. Without a + it must be an Indian mobile, saved
-- as 10 digits (spaces, dashes and a 91 or 0 in front are dropped). Other countries are written with
-- + (or 00) and the country code, 8 to 15 digits, saved as +digits. Fillers such as 9999999999 are
-- refused. Checked whenever the phone is changed, so older app versions cannot save a fake number
-- either. A new business starts with no phone (create_organization) and the apps ask for it in the
-- same setup step. Safe to run more than once.

create or replace function public.check_organization_phone()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  raw text := trim(coalesce(new.phone, ''));
  digits text := regexp_replace(raw, '\D', '', 'g');
  international boolean := left(raw, 1) = '+' or left(raw, 2) = '00';
begin
  if left(raw, 2) = '00' then
    digits := substr(digits, 3);
  end if;
  if digits ~ '^(\d)\1+ then
    raise exception 'Enter a valid mobile number. Outside India, start with + and the country code.';
  end if;
  if international and left(digits, 2) <> '91' then
    if digits !~ '^[1-9][0-9]{7,14} then
      raise exception 'Enter a valid mobile number. Outside India, start with + and the country code.';
    end if;
    new.phone := '+' || digits;
    return new;
  end if;
  if length(digits) = 12 and left(digits, 2) = '91' then
    digits := right(digits, 10);
  elsif length(digits) = 11 and left(digits, 1) = '0' then
    digits := right(digits, 10);
  end if;
  if digits !~ '^[6-9][0-9]{9} or digits = '9876543210' then
    raise exception 'Enter a valid mobile number. Outside India, start with + and the country code.';
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
