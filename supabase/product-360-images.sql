-- Run this in the Supabase SQL editor before uploading 360 product photos.
-- It adds ordered storage paths for both single-row and multi-row 360 frames.

alter table public.products
add column if not exists rotation_image_urls text[] not null default '{}';

alter table public.products
add column if not exists rotation_image_rows text[][] not null default '{}';

update public.products
set rotation_image_rows = array[rotation_image_urls]
where cardinality(rotation_image_rows) = 0
  and cardinality(rotation_image_urls) > 0;
