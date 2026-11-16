-- Product photos: an optional picture per product, stored in a private Storage bucket under
-- <organization id>/<file>. Members of the business can view them; only the owner can change them.
-- Safe to run more than once.

alter table public.products add column if not exists image_path text;
alter table public.products drop constraint if exists products_image_path_check;
alter table public.products add constraint products_image_path_check
  check (image_path is null or (length(image_path) <= 200 and image_path like organization_id::text || '/%'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', false, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Organization members can view product images" on storage.objects;
create policy "Organization members can view product images"
  on storage.objects for select to authenticated
  using (bucket_id = 'product-images' and (storage.foldername(name))[1] = (select public.current_organization_id())::text);

drop policy if exists "Owners can add product images" on storage.objects;
create policy "Owners can add product images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and (storage.foldername(name))[1] = (select public.current_organization_id())::text and (select public.current_app_role()) = 'owner');

drop policy if exists "Owners can replace product images" on storage.objects;
create policy "Owners can replace product images"
  on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and (storage.foldername(name))[1] = (select public.current_organization_id())::text and (select public.current_app_role()) = 'owner');

drop policy if exists "Owners can delete product images" on storage.objects;
create policy "Owners can delete product images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and (storage.foldername(name))[1] = (select public.current_organization_id())::text and (select public.current_app_role()) = 'owner');
