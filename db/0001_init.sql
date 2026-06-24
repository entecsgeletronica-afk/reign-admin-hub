-- =====================================================================
-- Reino das Cores · Admin Panel · Initial Schema
-- =====================================================================
-- Run this on a fresh Supabase project (SQL Editor or via CLI):
--   supabase db push                  (CLI)
--   or paste this whole file in the SQL Editor and Run.
--
-- This script is idempotent enough to re-run safely on a clean DB.
-- =====================================================================

-- Extensions
create extension if not exists "pgcrypto";

-- =====================================================================
-- 1) admin_profiles
-- =====================================================================
create table if not exists public.admin_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  name text,
  role text not null default 'owner',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =====================================================================
-- 2) Security Definer helper (avoids RLS recursion)
-- =====================================================================
create or replace function public.is_active_admin(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_profiles
    where id = _user_id
      and is_active = true
  )
$$;

-- =====================================================================
-- 3) Dashboard tables
-- =====================================================================
create table if not exists public.dashboard_kpis (
  id uuid primary key default gen_random_uuid(),
  period_key text not null,
  revenue_amount numeric not null default 0,
  sales_count integer not null default 0,
  mrr_amount numeric not null default 0,
  active_subscriptions integer not null default 0,
  avg_ticket numeric not null default 0,
  top_plan_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (period_key)
);

create table if not exists public.dashboard_series (
  id uuid primary key default gen_random_uuid(),
  period_key text not null,
  label text not null,
  revenue_amount numeric not null default 0,
  sales_count integer not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists dashboard_series_period_idx on public.dashboard_series (period_key, sort_order);

create table if not exists public.subscription_status_summary (
  id uuid primary key default gen_random_uuid(),
  period_key text not null,
  status_key text not null,
  status_label text not null,
  total integer not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists subscription_status_period_idx on public.subscription_status_summary (period_key, sort_order);

create table if not exists public.top_plans_summary (
  id uuid primary key default gen_random_uuid(),
  period_key text not null,
  plan_name text not null,
  total_sales integer not null default 0,
  revenue_amount numeric not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists top_plans_period_idx on public.top_plans_summary (period_key, sort_order);

create table if not exists public.monthly_recurring_summary (
  id uuid primary key default gen_random_uuid(),
  month_key text not null unique,
  month_label text not null,
  amount numeric not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- =====================================================================
-- 3.1) Users management (Usuários screen)
-- =====================================================================
do $$ begin
  if not exists (select 1 from pg_type where typname = 'admin_user_status') then
    create type public.admin_user_status as enum ('active', 'pending', 'canceled', 'no_plan');
  end if;
end $$;

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  email text not null,
  status public.admin_user_status not null default 'no_plan',
  plan_name text,
  total_paid numeric not null default 0,
  access_blocked boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists admin_users_status_idx on public.admin_users (status);
create index if not exists admin_users_email_idx on public.admin_users (email);

create table if not exists public.admin_users_summary (
  id uuid primary key default gen_random_uuid(),
  total_filtered integer not null default 0,
  active_subscriptions integer not null default 0,
  blocked_access integer not null default 0,
  revenue_displayed numeric not null default 0,
  updated_at timestamptz not null default now()
);

-- =====================================================================
-- 3.2) Reports tables (Relatórios screen)
-- =====================================================================
create table if not exists public.report_summary (
  id uuid primary key default gen_random_uuid(),
  period_key text not null unique,
  top_plan_name text,
  revenue_last_7d numeric not null default 0,
  sales_today_amount numeric not null default 0,
  sales_today_count integer not null default 0,
  canceled_subscriptions integer not null default 0,
  users_count integer not null default 1,
  active_plans integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.recent_sales (
  id uuid primary key default gen_random_uuid(),
  period_key text not null,
  customer_name text,
  plan_name text,
  amount numeric not null default 0,
  sold_at timestamptz not null default now()
);
create index if not exists recent_sales_period_idx on public.recent_sales (period_key, sold_at desc);

-- =====================================================================
-- 3.3) Settings tables (Branding / E-mail / Capas)
-- =====================================================================
create table if not exists public.branding_settings (
  id integer primary key default 1,
  app_name text not null default 'Reino das Cores',
  alt_text text not null default 'Reino das Cores',
  logo_url text,
  favicon_url text,
  updated_at timestamptz not null default now(),
  constraint branding_singleton check (id = 1)
);

create table if not exists public.email_settings (
  id integer primary key default 1,
  sender_name text not null default 'Reino das Cores',
  sender_email text not null default '',
  updated_at timestamptz not null default now(),
  constraint email_singleton check (id = 1)
);

do $$ begin
  if not exists (select 1 from pg_type where typname = 'story_testament') then
    create type public.story_testament as enum ('parables', 'new', 'old');
  end if;
end $$;

create table if not exists public.story_covers (
  id text primary key,
  title text not null,
  subtitle text not null default '',
  slug text not null unique,
  testament public.story_testament not null default 'parables',
  is_new boolean not null default false,
  cover_url text,
  updated_at timestamptz not null default now()
);

-- =====================================================================
-- 4) Row Level Security
-- =====================================================================
alter table public.admin_profiles enable row level security;
alter table public.dashboard_kpis enable row level security;
alter table public.dashboard_series enable row level security;
alter table public.subscription_status_summary enable row level security;
alter table public.top_plans_summary enable row level security;
alter table public.monthly_recurring_summary enable row level security;
alter table public.admin_users enable row level security;
alter table public.admin_users_summary enable row level security;
alter table public.report_summary enable row level security;
alter table public.recent_sales enable row level security;
alter table public.branding_settings enable row level security;
alter table public.email_settings enable row level security;
alter table public.story_covers enable row level security;

-- admin_profiles policies
drop policy if exists "admin_profiles select self" on public.admin_profiles;
create policy "admin_profiles select self"
on public.admin_profiles for select to authenticated
using (id = auth.uid());

drop policy if exists "admin_profiles select admin" on public.admin_profiles;
create policy "admin_profiles select admin"
on public.admin_profiles for select to authenticated
using (public.is_active_admin(auth.uid()));

-- First-admin bootstrap insert: any authenticated user can insert their own row
-- only when there are still zero admins. After that, only existing admins.
drop policy if exists "admin_profiles insert bootstrap or admin" on public.admin_profiles;
create policy "admin_profiles insert bootstrap or admin"
on public.admin_profiles for insert to authenticated
with check (
  (id = auth.uid() and not exists (select 1 from public.admin_profiles))
  or public.is_active_admin(auth.uid())
);

drop policy if exists "admin_profiles update admin" on public.admin_profiles;
create policy "admin_profiles update admin"
on public.admin_profiles for update to authenticated
using (public.is_active_admin(auth.uid()))
with check (public.is_active_admin(auth.uid()));

drop policy if exists "admin_profiles delete admin" on public.admin_profiles;
create policy "admin_profiles delete admin"
on public.admin_profiles for delete to authenticated
using (public.is_active_admin(auth.uid()));

-- Apply admin-only CRUD policies on dashboard tables
do $$
declare
  t text;
begin
  for t in select unnest(array[
    'dashboard_kpis',
    'dashboard_series',
    'subscription_status_summary',
    'top_plans_summary',
    'monthly_recurring_summary',
    'admin_users',
    'admin_users_summary',
    'report_summary',
    'recent_sales',
    'branding_settings',
    'email_settings',
    'story_covers'
  ])
  loop
    execute format('drop policy if exists "%s admin select" on public.%I;', t, t);
    execute format(
      'create policy "%s admin select" on public.%I for select to authenticated using (public.is_active_admin(auth.uid()));',
      t, t
    );

    execute format('drop policy if exists "%s admin insert" on public.%I;', t, t);
    execute format(
      'create policy "%s admin insert" on public.%I for insert to authenticated with check (public.is_active_admin(auth.uid()));',
      t, t
    );

    execute format('drop policy if exists "%s admin update" on public.%I;', t, t);
    execute format(
      'create policy "%s admin update" on public.%I for update to authenticated using (public.is_active_admin(auth.uid())) with check (public.is_active_admin(auth.uid()));',
      t, t
    );

    execute format('drop policy if exists "%s admin delete" on public.%I;', t, t);
    execute format(
      'create policy "%s admin delete" on public.%I for delete to authenticated using (public.is_active_admin(auth.uid()));',
      t, t
    );
  end loop;
end $$;

-- =====================================================================
-- 5) updated_at trigger
-- =====================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_admin_profiles_updated_at on public.admin_profiles;
create trigger trg_admin_profiles_updated_at
before update on public.admin_profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_dashboard_kpis_updated_at on public.dashboard_kpis;
create trigger trg_dashboard_kpis_updated_at
before update on public.dashboard_kpis
for each row execute function public.set_updated_at();

-- =====================================================================
-- 6) Optional: auto-create admin profile on auth user creation (commented)
-- =====================================================================
-- create or replace function public.handle_new_auth_user()
-- returns trigger language plpgsql security definer set search_path = public
-- as $$
-- begin
--   insert into public.admin_profiles (id, email, name, role, is_active)
--   values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', new.email), 'viewer', false)
--   on conflict (id) do nothing;
--   return new;
-- end; $$;
--
-- drop trigger if exists on_auth_user_created on auth.users;
-- create trigger on_auth_user_created
-- after insert on auth.users
-- for each row execute function public.handle_new_auth_user();

-- =====================================================================
-- 7) Seeds — zeroed dashboard for "30d"
-- =====================================================================
insert into public.dashboard_kpis (period_key, revenue_amount, sales_count, mrr_amount, active_subscriptions, avg_ticket, top_plan_name)
values ('30d', 0, 0, 0, 0, 0, null)
on conflict (period_key) do nothing;

insert into public.dashboard_series (period_key, label, revenue_amount, sales_count, sort_order)
select
  '30d',
  to_char((now() - (i || ' day')::interval), 'DD/MM'),
  0,
  0,
  (30 - i)
from generate_series(0, 29) as g(i)
on conflict do nothing;

insert into public.subscription_status_summary (period_key, status_key, status_label, total, sort_order)
values ('30d', 'none', 'sem dados', 0, 0)
on conflict do nothing;

insert into public.monthly_recurring_summary (month_key, month_label, amount, sort_order)
values
  ('2025-01', 'JAN', 0, 1),
  ('2025-02', 'FEV', 0, 2),
  ('2025-03', 'MAR', 0, 3),
  ('2025-04', 'ABR', 0, 4),
  ('2025-05', 'MAI', 0, 5),
  ('2025-06', 'JUN', 0, 6)
on conflict (month_key) do nothing;

-- Users summary singleton (zeroed)
insert into public.admin_users_summary (total_filtered, active_subscriptions, blocked_access, revenue_displayed)
select 0, 0, 0, 0
where not exists (select 1 from public.admin_users_summary);

-- Report summary zeroed for all common periods
insert into public.report_summary
  (period_key, top_plan_name, revenue_last_7d, sales_today_amount, sales_today_count, canceled_subscriptions, users_count, active_plans)
values
  ('today', null, 0, 0, 0, 0, 1, 0),
  ('7d',    null, 0, 0, 0, 0, 1, 0),
  ('30d',   null, 0, 0, 0, 0, 1, 0),
  ('90d',   null, 0, 0, 0, 0, 1, 0),
  ('month', null, 0, 0, 0, 0, 1, 0)
on conflict (period_key) do nothing;

-- Branding & email singletons (zeroed)
insert into public.branding_settings (id, app_name, alt_text, logo_url, favicon_url)
values (1, 'Reino das Cores', 'Reino das Cores', null, null)
on conflict (id) do nothing;

insert into public.email_settings (id, sender_name, sender_email)
values (1, 'Reino das Cores', '')
on conflict (id) do nothing;

-- Story covers — initial placeholders
insert into public.story_covers (id, title, subtitle, slug, testament, is_new, cover_url)
values
  ('filho-prodigo',  'O Filho Pródigo', 'O abraço do perdão',  'o-filho-prodigo',  'parables', true, null),
  ('ovelha-perdida', 'A Ovelha Perdida', 'O pastor que procura', 'a-ovelha-perdida', 'parables', true, null)
on conflict (id) do nothing;

