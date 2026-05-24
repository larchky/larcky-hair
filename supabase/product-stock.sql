-- Run this in the Supabase SQL editor before using product stock limits.
-- Existing products will start at 0 until their stock is updated in admin.

alter table public.products
add column if not exists stock_quantity integer not null default 0;

alter table public.products
drop constraint if exists products_stock_quantity_nonnegative;

alter table public.products
add constraint products_stock_quantity_nonnegative
check (stock_quantity >= 0);
