-- Referrals: every business has a short code to share. A new business can enter a code during its
-- first 14 days (once). When it pays for the first time, it and the business that referred it each
-- get 30 extra days. Owners cannot change these columns directly (only name, gstin, address,
-- state_code and phone are granted), and the reward is applied by the database when paid_until is
-- first set, whether by the Razorpay webhook or by hand in the SQL editor.
-- Safe to run more than once.

alter table public.organizations
  add column if not exists referral_code text unique check (referral_code ~ '^[A-Z0-9]{6}$'),
  add column if not exists referred_by uuid references public.organizations (id) on delete set null,
  add column if not exists referral_rewarded_at timestamptz;

create or replace function public.set_referral_code()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.referral_code is null then
    loop
      new.referral_code := upper(substr(md5(gen_random_uuid()::text), 1, 6));
      exit when not exists (select 1 from public.organizations where referral_code = new.referral_code);
    end loop;
  end if;
  return new;
end;
$$;
revoke all on function public.set_referral_code() from public, anon, authenticated;

drop trigger if exists set_referral_code on public.organizations;
create trigger set_referral_code before insert on public.organizations
  for each row execute function public.set_referral_code();

-- Codes for businesses created before this upgrade.
do $$
declare
  org record;
  code text;
begin
  for org in select id from public.organizations where referral_code is null loop
    loop
      code := upper(substr(md5(gen_random_uuid()::text), 1, 6));
      exit when not exists (select 1 from public.organizations where referral_code = code);
    end loop;
    update public.organizations set referral_code = code where id = org.id;
  end loop;
end;
$$;

-- An owner enters the code of the business that told them about TiruFix.
create or replace function public.apply_referral(code text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  own public.organizations%rowtype;
  referrer uuid;
begin
  if public.current_app_role() is distinct from 'owner' then
    raise exception 'Only the business owner can enter a referral code';
  end if;
  select * into own from public.organizations where id = public.current_organization_id();
  if own.referred_by is not null then
    raise exception 'A referral code has already been entered for this business';
  end if;
  if own.created_at < now() - interval '14 days' or own.paid_until is not null then
    raise exception 'A referral code can only be entered in the first 14 days, before paying';
  end if;
  select id into referrer from public.organizations where referral_code = upper(trim(code)) and id <> own.id;
  if referrer is null then
    raise exception 'This referral code is not valid';
  end if;
  update public.organizations set referred_by = referrer where id = own.id;
end;
$$;
revoke all on function public.apply_referral(text) from public, anon;
grant execute on function public.apply_referral(text) to authenticated;

-- The first payment of a referred business: 30 extra days for it and for the business that
-- referred it. Only at the first trigger level, so the referrer's own update does not cascade.
create or replace function public.reward_referral()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if pg_trigger_depth() = 1 and old.paid_until is null and new.paid_until is not null
     and new.referred_by is not null and new.referral_rewarded_at is null then
    new.paid_until := new.paid_until + interval '30 days';
    new.referral_rewarded_at := now();
    update public.organizations
      set paid_until = greatest(coalesce(paid_until, '-infinity'::timestamptz), trial_ends_at, now()) + interval '30 days'
      where id = new.referred_by;
  end if;
  return new;
end;
$$;
revoke all on function public.reward_referral() from public, anon, authenticated;

drop trigger if exists reward_referral on public.organizations;
create trigger reward_referral before update of paid_until on public.organizations
  for each row execute function public.reward_referral();
