-- Run this in the Supabase SQL editor for the project.
-- It prepares paid customer orders for the checkout form and admin dashboard.

create extension if not exists pgcrypto;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

alter table public.orders
  add column if not exists product_name text,
  add column if not exists amount numeric,
  add column if not exists customer_email text,
  add column if not exists customer_name text,
  add column if not exists customer_phone text,
  add column if not exists delivery_address text,
  add column if not exists payment_status text,
  add column if not exists transaction_id text,
  add column if not exists order_status text,
  add column if not exists assigned_vendor text;

alter table public.orders
  alter column order_status set default 'processing';

update public.orders
set order_status = 'processing'
where order_status is null;

alter table public.orders enable row level security;

drop policy if exists "Customers can create paid orders" on public.orders;
drop policy if exists "Admins can read orders" on public.orders;
drop policy if exists "Admins can update orders" on public.orders;

create policy "Customers can create paid orders"
on public.orders
for insert
to anon, authenticated
with check (
  payment_status = 'successful'
  and customer_name is not null
  and length(trim(customer_name)) > 0
  and customer_phone is not null
  and length(trim(customer_phone)) > 0
  and delivery_address is not null
  and length(trim(delivery_address)) > 0
);

create policy "Admins can read orders"
on public.orders
for select
to authenticated
using (true);

create policy "Admins can update orders"
on public.orders
for update
to authenticated
using (true)
with check (true);
