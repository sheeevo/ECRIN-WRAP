-- Ecrin Wrap — client account schema
-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run: every statement is guarded with "if not exists" / "or replace".

create extension if not exists "pgcrypto";

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  brand text not null,
  model text not null,
  finish text,
  created_at timestamptz not null default now()
);

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  service text not null,
  brand text,
  model text,
  specs text,
  contact_name text,
  contact_info text,
  status text not null default 'nouveau',
  created_at timestamptz not null default now()
);

alter table public.vehicles enable row level security;
alter table public.quotes enable row level security;

drop policy if exists "vehicles_select_own" on public.vehicles;
drop policy if exists "vehicles_insert_own" on public.vehicles;
drop policy if exists "vehicles_update_own" on public.vehicles;
drop policy if exists "vehicles_delete_own" on public.vehicles;

create policy "vehicles_select_own" on public.vehicles for select using (auth.uid() = user_id);
create policy "vehicles_insert_own" on public.vehicles for insert with check (auth.uid() = user_id);
create policy "vehicles_update_own" on public.vehicles for update using (auth.uid() = user_id);
create policy "vehicles_delete_own" on public.vehicles for delete using (auth.uid() = user_id);

drop policy if exists "quotes_select_own" on public.quotes;
drop policy if exists "quotes_insert_own" on public.quotes;

create policy "quotes_select_own" on public.quotes for select using (auth.uid() = user_id);
create policy "quotes_insert_own" on public.quotes for insert with check (auth.uid() = user_id);
