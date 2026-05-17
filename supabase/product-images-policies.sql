-- Run this in the Supabase SQL editor for the project.
-- It makes product image files publicly readable and allows logged-in users to
-- upload/delete files through the app's anon Supabase client.

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update
set public = true;

update storage.buckets
set public = true,
    file_size_limit = null,
    allowed_mime_types = null
where id = 'product-images';

drop policy if exists "Public can read product images" on storage.objects;
drop policy if exists "Authenticated users can upload product images" on storage.objects;
drop policy if exists "Authenticated users can delete product images" on storage.objects;

create policy "Public can read product images"
on storage.objects
for select
to public
using (bucket_id = 'product-images');

create policy "Authenticated users can upload product images"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'product-images');

create policy "Authenticated users can delete product images"
on storage.objects
for delete
to authenticated
using (bucket_id = 'product-images');

select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'product-images';

select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname in (
    'Public can read product images',
    'Authenticated users can upload product images',
    'Authenticated users can delete product images'
  )
order by policyname;
