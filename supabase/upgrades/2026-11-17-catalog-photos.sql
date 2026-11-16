-- Catalogue photos: one shared photo per catalogue product (keyed by its catalogue name), or per
-- product type (keyed 'type:<kind>', e.g. 'type:membrane'), shown to every business for products
-- without their own photo. Only platform admins (the app's operator, added by hand below) can
-- change them. Stored in a public Storage bucket, since they are not private.
-- Safe to run more than once.
--
-- To make yourself an admin, run once in the SQL editor with your login email:
--   insert into public.platform_admins (user_id) select id from auth.users where email = 'you@example.com';

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.platform_admins enable row level security;
revoke all on public.platform_admins from anon, authenticated;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.platform_admins where user_id = (select auth.uid()));
$$;
revoke all on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated;

create table if not exists public.catalog_photos (
  key text primary key check (length(key) between 1 and 200),
  path text not null check (length(path) <= 300 and path !~ '^/' and path !~ '\.\.'),
  updated_at timestamptz not null default now()
);
alter table public.catalog_photos enable row level security;
revoke all on public.catalog_photos from anon;
grant select, insert, update, delete on public.catalog_photos to authenticated;

drop policy if exists "Signed-in users can view catalogue photos" on public.catalog_photos;
create policy "Signed-in users can view catalogue photos"
  on public.catalog_photos for select to authenticated using (true);

drop policy if exists "Platform admins can add catalogue photos" on public.catalog_photos;
create policy "Platform admins can add catalogue photos"
  on public.catalog_photos for insert to authenticated with check ((select public.is_platform_admin()));

drop policy if exists "Platform admins can change catalogue photos" on public.catalog_photos;
create policy "Platform admins can change catalogue photos"
  on public.catalog_photos for update to authenticated
  using ((select public.is_platform_admin())) with check ((select public.is_platform_admin()));

drop policy if exists "Platform admins can remove catalogue photos" on public.catalog_photos;
create policy "Platform admins can remove catalogue photos"
  on public.catalog_photos for delete to authenticated using ((select public.is_platform_admin()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('catalog-photos', 'catalog-photos', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Anyone can view the files through their public links; only admins can list or change them.
drop policy if exists "Platform admins can list catalogue photos" on storage.objects;
create policy "Platform admins can list catalogue photos"
  on storage.objects for select to authenticated
  using (bucket_id = 'catalog-photos' and (select public.is_platform_admin()));

drop policy if exists "Platform admins can add catalogue photo files" on storage.objects;
create policy "Platform admins can add catalogue photo files"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'catalog-photos' and (select public.is_platform_admin()));

drop policy if exists "Platform admins can delete catalogue photo files" on storage.objects;
create policy "Platform admins can delete catalogue photo files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'catalog-photos' and (select public.is_platform_admin()));
