-- Run this in the Supabase SQL editor before uploading 360 product photos.
-- It adds optional ordered storage paths for product rotation frames.

alter table public.products
add column if not exists rotation_image_urls text[] not null default '{}';
