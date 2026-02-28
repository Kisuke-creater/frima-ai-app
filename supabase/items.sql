-- Apply in Supabase SQL editor.
-- This schema matches src/lib/firestore.ts item model.

create extension if not exists pgcrypto;

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  uid text not null default auth.uid()::text,
  title text not null,
  description text not null,
  category text not null,
  condition text not null,
  price integer not null check (price >= 0),
  marketplace text null,
  status text not null check (status in ('listed', 'sold')),
  created_at timestamptz not null default now(),
  sold_at timestamptz null,
  sold_price integer null check (sold_price is null or sold_price >= 0),
  shipping_spec jsonb null
);

alter table public.items
  alter column uid set default auth.uid()::text;

create index if not exists items_uid_created_at_idx
  on public.items (uid, created_at desc);

revoke all on public.items from anon;
revoke all on public.items from public;
grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.items to authenticated;

alter table public.items enable row level security;
alter table public.items force row level security;

drop policy if exists "anon_select_items" on public.items;
drop policy if exists "anon_insert_items" on public.items;
drop policy if exists "anon_update_items" on public.items;
drop policy if exists "anon_delete_items" on public.items;

drop policy if exists "items_select_own" on public.items;
create policy "items_select_own"
  on public.items
  for select
  to authenticated
  using (uid = auth.uid()::text);

drop policy if exists "items_insert_own" on public.items;
create policy "items_insert_own"
  on public.items
  for insert
  to authenticated
  with check (uid = auth.uid()::text);

drop policy if exists "items_update_own" on public.items;
create policy "items_update_own"
  on public.items
  for update
  to authenticated
  using (uid = auth.uid()::text)
  with check (uid = auth.uid()::text);

drop policy if exists "items_delete_own" on public.items;
create policy "items_delete_own"
  on public.items
  for delete
  to authenticated
  using (uid = auth.uid()::text);
