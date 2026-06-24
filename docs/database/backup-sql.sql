-- =============================================================================
-- BACKUP SQL · Reino das Cores · Admin Panel
-- =============================================================================
-- Gerado automaticamente a partir de db/0001_init.sql + docs/database/migrations/*.sql
-- Data: 2026-04-30T15:00:00Z
--
-- FIX REMIX: este backup agora inclui CREATE TABLE para tabelas legadas
-- que existiam apenas no Supabase original (app_settings_kv, email_templates,
-- plans, subscriptions, webhook_events, webhook_integrations, stories,
-- story_categories, stories_pages, user_artworks, user_page_progress,
-- achievements, user_rewards). Sem isso, remixes com Supabase novo
-- quebravam ao executar este script porque migrations posteriores
-- referenciavam tabelas inexistentes.
--
-- INCLUI: Espelhamento de produtos entre áreas (catalog_products.is_mirror,
-- source_product_id, mirror_type, content_source, inherited_cover),
-- duplicação de seções (client-side), seção "Continue colorindo" na home
-- (usa user_recent_products + home_settings.continue_fallback_product_id),
-- has_role com herança: super_admin satisfaz qualquer checagem por 'admin'
-- (resolve falhas em "Liberar produto manualmente" e demais ações de admin)
-- E auto-seleção da área de membros do aluno na home — quando o aluno tem
-- entitlement em uma variação específica, /home usa a área liberada mais
-- recentemente, ignora acessos expirados e resolve produtos antigos pela
-- seção quando variation_id estiver ausente. Sem mudanças de schema.
--
-- COMO USAR (deploy próprio na Vercel + Supabase):
--   1) Crie um projeto Supabase novo em supabase.com (NÃO use o do professor).
--   2) SQL Editor → New Query → cole TODO este arquivo → Run.
--   3) Confira buckets em docs/database/storage_buckets.md e secrets em docs/database/secrets.md.
--   4) Siga docs/deploy-vercel.md para publicar o front na Vercel.
--
-- NOTA · Criação de admins pelo painel:
--   A tela /admin/usuarios usa a checkbox "Criar como administrador" para
--   inserir um registro em public.user_roles (role='admin') logo após o
--   signUp. Isso depende exclusivamente das policies definidas abaixo
--   (Admins manage roles em user_roles) — nenhuma migration extra é
--   necessária.
-- =============================================================================

-- ===== PRÉ-REQUISITOS · Auth helpers (roles + profiles) =====
-- Estas definições são esperadas pelas migrations subsequentes (has_role,
-- app_role, public.profiles, public.user_roles) mas não estavam em nenhum
-- arquivo de migration — vivem como baseline do projeto Supabase.

-- Enum de papéis
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tabela de papéis (NUNCA armazenar role na tabela profiles — segurança)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Função SECURITY DEFINER para evitar recursão em RLS.
-- super_admin herda automaticamente todos os direitos de admin: ao
-- perguntar por 'admin', a função também aceita quem tem 'super_admin'.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND (
        role = _role
        OR (_role = 'admin'::public.app_role AND role = 'super_admin'::public.app_role)
      )
  );
$$;

-- Policies básicas em user_roles
DROP POLICY IF EXISTS "Users view own roles" ON public.user_roles;
CREATE POLICY "Users view own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
CREATE POLICY "Admins manage roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Tabela de perfis públicos (espelho leve de auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
CREATE POLICY "Users view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Admins manage profiles" ON public.profiles;
CREATE POLICY "Admins manage profiles"
  ON public.profiles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Trigger genérico de updated_at usado por várias migrations
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Auto-criar profile + role 'user' quando um auth.user é criado
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===== LEGACY TABLES (faltavam create table no /docs/database/migrations) =====
-- =============================================================================
-- Tabelas legadas que não tinham CREATE TABLE em /docs/database/migrations
-- =============================================================================
-- Essas tabelas existem no Supabase original do projeto, mas as migrations
-- que as criaram nunca foram exportadas para o repositório. Sem elas,
-- qualquer remix/instalação nova falha ao executar backup-sql.sql porque
-- migrations posteriores e o código em runtime fazem referência a elas.
--
-- Schema reconstruído a partir de src/integrations/supabase/types.ts
-- (Database['public']['Tables']).
-- =============================================================================

-- ----------------------------------------------------------------------------
-- app_settings_kv : pares chave/valor de configuração global
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_settings_kv (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text NOT NULL UNIQUE,
  value_json  jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  updated_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_settings_kv ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage app settings kv" ON public.app_settings_kv;
CREATE POLICY "Admins manage app settings kv" ON public.app_settings_kv
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
DROP TRIGGER IF EXISTS trg_app_settings_kv_updated ON public.app_settings_kv;
CREATE TRIGGER trg_app_settings_kv_updated BEFORE UPDATE ON public.app_settings_kv
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------------------------------------------
-- email_templates : modelos de e-mail editáveis pelo admin
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.email_templates (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text NOT NULL UNIQUE,
  name         text NOT NULL,
  subject      text NOT NULL,
  body_html    text NOT NULL,
  variables    jsonb NOT NULL DEFAULT '[]'::jsonb,
  enabled      boolean NOT NULL DEFAULT true,
  updated_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage email templates" ON public.email_templates;
CREATE POLICY "Admins can manage email templates" ON public.email_templates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
DROP TRIGGER IF EXISTS trg_email_templates_updated ON public.email_templates;
CREATE TRIGGER trg_email_templates_updated BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------------------------------------------
-- plans : planos comerciais (mensal/anual/etc)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.plans (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code             text NOT NULL UNIQUE,
  name             text NOT NULL,
  description      text,
  price_cents      integer NOT NULL DEFAULT 0,
  currency         text NOT NULL DEFAULT 'BRL',
  billing_interval text NOT NULL DEFAULT 'month',
  native_language  text NOT NULL DEFAULT 'pt-BR',
  active           boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read active plans" ON public.plans;
CREATE POLICY "Anyone can read active plans" ON public.plans
  FOR SELECT TO authenticated USING (active = true OR public.has_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS "Admins manage plans" ON public.plans;
CREATE POLICY "Admins manage plans" ON public.plans
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
DROP TRIGGER IF EXISTS trg_plans_updated ON public.plans;
CREATE TRIGGER trg_plans_updated BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------------------------------------------
-- subscriptions : assinaturas ativas/canceladas vindas do gateway
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  plan_id                  uuid REFERENCES public.plans(id) ON DELETE SET NULL,
  provider                 text NOT NULL DEFAULT 'perfectpay',
  external_subscription_id text,
  external_customer_id     text,
  customer_email           text,
  status                   text NOT NULL DEFAULT 'active',
  amount_cents             integer NOT NULL DEFAULT 0,
  currency                 text NOT NULL DEFAULT 'BRL',
  started_at               timestamptz,
  current_period_end       timestamptz,
  canceled_at              timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own subscriptions" ON public.subscriptions;
CREATE POLICY "Users read own subscriptions" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS "Admins manage subscriptions" ON public.subscriptions;
CREATE POLICY "Admins manage subscriptions" ON public.subscriptions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
DROP TRIGGER IF EXISTS trg_subscriptions_updated ON public.subscriptions;
CREATE TRIGGER trg_subscriptions_updated BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------------------------------------------
-- webhook_integrations : configurações por área de membros (PerfectPay etc.)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.webhook_integrations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  provider         text NOT NULL DEFAULT 'perfectpay',
  endpoint_url     text NOT NULL,
  signing_secret   text,
  active           boolean NOT NULL DEFAULT true,
  last_received_at timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.webhook_integrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage webhook integrations" ON public.webhook_integrations;
CREATE POLICY "Admins manage webhook integrations" ON public.webhook_integrations
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
DROP TRIGGER IF EXISTS trg_webhook_integrations_updated ON public.webhook_integrations;
CREATE TRIGGER trg_webhook_integrations_updated BEFORE UPDATE ON public.webhook_integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------------------------------------------
-- webhook_events : log de eventos recebidos
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider          text NOT NULL DEFAULT 'perfectpay',
  event_type        text,
  external_event_id text,
  payload           jsonb NOT NULL DEFAULT '{}'::jsonb,
  status            text NOT NULL DEFAULT 'pending',
  processed         boolean NOT NULL DEFAULT false,
  reason            text,
  error_message     text,
  received_at       timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_webhook_events_provider ON public.webhook_events(provider);
CREATE INDEX IF NOT EXISTS idx_webhook_events_received ON public.webhook_events(received_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_webhook_events_external
  ON public.webhook_events(provider, external_event_id)
  WHERE external_event_id IS NOT NULL;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read webhook events" ON public.webhook_events;
CREATE POLICY "Admins read webhook events" ON public.webhook_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ----------------------------------------------------------------------------
-- story_categories : categorias para stories (FK referenciado abaixo)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.story_categories (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             text NOT NULL UNIQUE,
  title            text NOT NULL,
  description      text,
  emoji            text,
  color            text,
  icon_url         text,
  cover_image_url  text,
  sort_order       integer NOT NULL DEFAULT 0,
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.story_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read active story categories" ON public.story_categories;
CREATE POLICY "Anyone can read active story categories" ON public.story_categories
  FOR SELECT TO authenticated USING (is_active = true OR public.has_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS "Admins manage story categories" ON public.story_categories;
CREATE POLICY "Admins manage story categories" ON public.story_categories
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
DROP TRIGGER IF EXISTS trg_story_categories_updated ON public.story_categories;
CREATE TRIGGER trg_story_categories_updated BEFORE UPDATE ON public.story_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------------------------------------------
-- stories : histórias bíblicas / desenhos
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stories (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                text NOT NULL UNIQUE,
  title               text NOT NULL,
  subtitle            text,
  description         text,
  short_description   text,
  cover_image_url     text,
  thumbnail_url       text,
  testament           text,
  age_range           text,
  age_min             integer,
  age_max             integer,
  difficulty_level    integer,
  estimated_minutes   integer,
  category_id         uuid REFERENCES public.story_categories(id) ON DELETE SET NULL,
  loved               integer NOT NULL DEFAULT 0,
  sort_order          integer NOT NULL DEFAULT 0,
  is_featured         boolean NOT NULL DEFAULT false,
  is_new              boolean NOT NULL DEFAULT false,
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stories_active ON public.stories(is_active);
CREATE INDEX IF NOT EXISTS idx_stories_category ON public.stories(category_id);
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read active stories" ON public.stories;
CREATE POLICY "Anyone can read active stories" ON public.stories
  FOR SELECT TO authenticated USING (is_active = true OR public.has_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS "Admins manage stories" ON public.stories;
CREATE POLICY "Admins manage stories" ON public.stories
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
DROP TRIGGER IF EXISTS trg_stories_updated ON public.stories;
CREATE TRIGGER trg_stories_updated BEFORE UPDATE ON public.stories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------------------------------------------
-- stories_pages : páginas (lineart) de cada história
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stories_pages (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id                   uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  page_number                integer NOT NULL,
  title                      text,
  image_lineart_url          text,
  image_preview_url          text,
  image_colored_sample_url   text,
  svg_markup                 text,
  recommended_zoom           numeric,
  mobile_focus_x             numeric,
  mobile_focus_y             numeric,
  is_active                  boolean NOT NULL DEFAULT true,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now(),
  UNIQUE (story_id, page_number)
);
CREATE INDEX IF NOT EXISTS idx_stories_pages_story ON public.stories_pages(story_id);
ALTER TABLE public.stories_pages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read active story pages" ON public.stories_pages;
CREATE POLICY "Anyone can read active story pages" ON public.stories_pages
  FOR SELECT TO authenticated USING (is_active = true OR public.has_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS "Admins manage story pages" ON public.stories_pages;
CREATE POLICY "Admins manage story pages" ON public.stories_pages
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
DROP TRIGGER IF EXISTS trg_stories_pages_updated ON public.stories_pages;
CREATE TRIGGER trg_stories_pages_updated BEFORE UPDATE ON public.stories_pages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------------------------------------------
-- user_artworks : desenhos pintados pelo aluno
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_artworks (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  story_id                 uuid REFERENCES public.stories(id) ON DELETE SET NULL,
  story_slug               text NOT NULL,
  page_id                  uuid REFERENCES public.stories_pages(id) ON DELETE SET NULL,
  page_index               integer NOT NULL,
  title                    text,
  canvas_data_json         jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_color_palette_json  jsonb,
  rendered_image_url       text,
  thumbnail_url            text,
  is_finished              boolean NOT NULL DEFAULT false,
  version                  integer NOT NULL DEFAULT 1,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, story_slug, page_index)
);
CREATE INDEX IF NOT EXISTS idx_user_artworks_user ON public.user_artworks(user_id);
ALTER TABLE public.user_artworks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own artworks" ON public.user_artworks;
CREATE POLICY "Users manage own artworks" ON public.user_artworks
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));
DROP TRIGGER IF EXISTS trg_user_artworks_updated ON public.user_artworks;
CREATE TRIGGER trg_user_artworks_updated BEFORE UPDATE ON public.user_artworks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------------------------------------------
-- user_page_progress : progresso por página
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_page_progress (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  story_id            uuid REFERENCES public.stories(id) ON DELETE SET NULL,
  story_slug          text NOT NULL,
  page_id             uuid REFERENCES public.stories_pages(id) ON DELETE SET NULL,
  page_index          integer NOT NULL,
  status              text NOT NULL DEFAULT 'in_progress',
  time_spent_seconds  integer NOT NULL DEFAULT 0,
  started_at          timestamptz,
  last_opened_at      timestamptz,
  completed_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, story_slug, page_index)
);
CREATE INDEX IF NOT EXISTS idx_user_page_progress_user ON public.user_page_progress(user_id);
ALTER TABLE public.user_page_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own page progress" ON public.user_page_progress;
CREATE POLICY "Users manage own page progress" ON public.user_page_progress
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));
DROP TRIGGER IF EXISTS trg_user_page_progress_updated ON public.user_page_progress;
CREATE TRIGGER trg_user_page_progress_updated BEFORE UPDATE ON public.user_page_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------------------------------------------
-- achievements : catálogo de conquistas
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.achievements (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              text NOT NULL UNIQUE,
  title             text NOT NULL,
  description       text,
  icon_url          text,
  reward_type       text,
  reward_value_json jsonb,
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read active achievements" ON public.achievements;
CREATE POLICY "Anyone can read active achievements" ON public.achievements
  FOR SELECT TO authenticated USING (is_active = true OR public.has_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS "Admins manage achievements" ON public.achievements;
CREATE POLICY "Admins manage achievements" ON public.achievements
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
DROP TRIGGER IF EXISTS trg_achievements_updated ON public.achievements;
CREATE TRIGGER trg_achievements_updated BEFORE UPDATE ON public.achievements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------------------------------------------
-- user_rewards : recompensas concedidas a usuários
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_rewards (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        text NOT NULL,
  source      text,
  value_json  jsonb NOT NULL DEFAULT '{}'::jsonb,
  granted_at  timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_rewards_user ON public.user_rewards(user_id);
ALTER TABLE public.user_rewards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own rewards" ON public.user_rewards;
CREATE POLICY "Users read own rewards" ON public.user_rewards
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS "Admins insert rewards" ON public.user_rewards;
CREATE POLICY "Admins insert rewards" ON public.user_rewards
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


-- ===== BASE SCHEMA (db/0001_init.sql) =====
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



-- ===== MIGRATION: 20260424013127_cfd1e9ce-6934-4f88-ba0a-fbf532b8ef4a.sql =====
-- =====================================================
-- CATALOG SECTIONS
-- =====================================================
CREATE TABLE public.catalog_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  subtitle text,
  description text,
  order_index integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.catalog_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active catalog sections"
  ON public.catalog_sections FOR SELECT
  USING (is_active = true OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage catalog sections"
  ON public.catalog_sections FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_catalog_sections_updated_at
  BEFORE UPDATE ON public.catalog_sections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- CATALOG PRODUCTS
-- =====================================================
CREATE TABLE public.catalog_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid REFERENCES public.catalog_sections(id) ON DELETE SET NULL,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  subtitle text,
  description text,
  cover_image_url text,
  thumbnail_url text,
  hero_image_url text,
  is_featured boolean NOT NULL DEFAULT false,
  is_published boolean NOT NULL DEFAULT true,
  is_locked boolean NOT NULL DEFAULT false,
  external_url text,
  badge_text text,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Espelhamento entre áreas de membros (29/04/2026):
  -- is_mirror = true → linha é uma "cópia leve" de outro produto.
  -- source_product_id aponta para o produto original (mesma tabela).
  -- content_source = 'mirror' → leitura de aulas/PDFs/páginas resolve pelo
  -- source. Já entitlement, oferta, plano, capa e publicação são da própria
  -- linha — para manter independência comercial entre áreas.
  is_mirror boolean NOT NULL DEFAULT false,
  source_product_id uuid REFERENCES public.catalog_products(id) ON DELETE SET NULL,
  mirror_type text CHECK (mirror_type IN ('product','section')),
  content_source text NOT NULL DEFAULT 'own' CHECK (content_source IN ('own','mirror')),
  inherited_cover boolean NOT NULL DEFAULT true,
  CONSTRAINT catalog_products_no_self_mirror
    CHECK (source_product_id IS NULL OR source_product_id <> id)
);

CREATE INDEX idx_catalog_products_section ON public.catalog_products(section_id);
CREATE INDEX idx_catalog_products_published ON public.catalog_products(is_published);
CREATE INDEX idx_catalog_products_source ON public.catalog_products(source_product_id);
CREATE INDEX idx_catalog_products_is_mirror ON public.catalog_products(is_mirror);

ALTER TABLE public.catalog_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published catalog products"
  ON public.catalog_products FOR SELECT
  USING (is_published = true OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage catalog products"
  ON public.catalog_products FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_catalog_products_updated_at
  BEFORE UPDATE ON public.catalog_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- HOME SETTINGS (singleton)
-- =====================================================
CREATE TABLE public.home_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  featured_product_id uuid REFERENCES public.catalog_products(id) ON DELETE SET NULL,
  continue_fallback_product_id uuid REFERENCES public.catalog_products(id) ON DELETE SET NULL,
  hero_label text DEFAULT 'EM DESTAQUE',
  hero_title text,
  hero_subtitle text,
  hero_button_label text DEFAULT 'Colorir agora',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.home_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view home settings"
  ON public.home_settings FOR SELECT
  USING (true);

CREATE POLICY "Admins manage home settings"
  ON public.home_settings FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_home_settings_updated_at
  BEFORE UPDATE ON public.home_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- USER RECENT PRODUCTS
-- =====================================================
CREATE TABLE public.user_recent_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.catalog_products(id) ON DELETE CASCADE,
  last_opened_at timestamptz NOT NULL DEFAULT now(),
  progress_percent integer NOT NULL DEFAULT 0,
  UNIQUE (user_id, product_id)
);

CREATE INDEX idx_user_recent_products_user ON public.user_recent_products(user_id, last_opened_at DESC);

ALTER TABLE public.user_recent_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own recent products"
  ON public.user_recent_products FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own recent products"
  ON public.user_recent_products FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own recent products"
  ON public.user_recent_products FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own recent products"
  ON public.user_recent_products FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all recent products"
  ON public.user_recent_products FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- CATALOG USER FAVORITES
-- =====================================================
CREATE TABLE public.catalog_user_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.catalog_products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);

CREATE INDEX idx_catalog_user_favorites_user ON public.catalog_user_favorites(user_id);

ALTER TABLE public.catalog_user_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own catalog favorites"
  ON public.catalog_user_favorites FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own catalog favorites"
  ON public.catalog_user_favorites FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own catalog favorites"
  ON public.catalog_user_favorites FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all catalog favorites"
  ON public.catalog_user_favorites FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- STORAGE BUCKET FOR CATALOG COVERS
-- =====================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('catalog-covers', 'catalog-covers', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view catalog covers"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'catalog-covers');

CREATE POLICY "Admins can upload catalog covers"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'catalog-covers' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update catalog covers"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'catalog-covers' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete catalog covers"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'catalog-covers' AND has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- SEED DATA
-- =====================================================
INSERT INTO public.catalog_sections (title, slug, subtitle, order_index) VALUES
  ('Antigo Testamento', 'antigo-testamento', 'Aventuras de fé e coragem', 0),
  ('Novo Testamento', 'novo-testamento', 'A vida e os ensinamentos de Jesus', 1),
  ('Parábolas', 'parabolas', 'Lições que Jesus ensinou', 2);

-- Antigo Testamento
INSERT INTO public.catalog_products (section_id, title, slug, order_index)
SELECT s.id, p.title, p.slug, p.order_index
FROM public.catalog_sections s
CROSS JOIN (VALUES
  ('Arca de Noé', 'arca-de-noe', 0),
  ('Davi e Golias', 'davi-e-golias', 1),
  ('Jonas e a Baleia', 'jonas-e-a-baleia', 2),
  ('Moisés e o Mar Vermelho', 'moises-e-o-mar-vermelho', 3),
  ('Daniel na Cova dos Leões', 'daniel-na-cova-dos-leoes', 4),
  ('A Criação do Mundo', 'a-criacao-do-mundo', 5),
  ('Ester, Rainha Corajosa', 'ester-rainha-corajosa', 6)
) AS p(title, slug, order_index)
WHERE s.slug = 'antigo-testamento';

-- Novo Testamento
INSERT INTO public.catalog_products (section_id, title, slug, order_index)
SELECT s.id, p.title, p.slug, p.order_index
FROM public.catalog_sections s
CROSS JOIN (VALUES
  ('O Nascimento de Jesus', 'o-nascimento-de-jesus', 0),
  ('Jesus e as Crianças', 'jesus-e-as-criancas', 1),
  ('A Multiplicação dos Pães', 'a-multiplicacao-dos-paes', 2),
  ('O Bom Samaritano', 'o-bom-samaritano', 3),
  ('Jesus Acalma a Tempestade', 'jesus-acalma-a-tempestade', 4)
) AS p(title, slug, order_index)
WHERE s.slug = 'novo-testamento';

-- Parábolas
INSERT INTO public.catalog_products (section_id, title, slug, order_index)
SELECT s.id, p.title, p.slug, p.order_index
FROM public.catalog_sections s
CROSS JOIN (VALUES
  ('O Filho Pródigo', 'o-filho-prodigo', 0),
  ('A Ovelha Perdida', 'a-ovelha-perdida', 1)
) AS p(title, slug, order_index)
WHERE s.slug = 'parabolas';

-- Mark Arca de Noé as featured
UPDATE public.catalog_products SET is_featured = true WHERE slug = 'arca-de-noe';

-- Home settings singleton
INSERT INTO public.home_settings (
  featured_product_id,
  continue_fallback_product_id,
  hero_label,
  hero_title,
  hero_subtitle,
  hero_button_label
)
SELECT
  (SELECT id FROM public.catalog_products WHERE slug = 'arca-de-noe'),
  (SELECT id FROM public.catalog_products WHERE slug = 'davi-e-golias'),
  'EM DESTAQUE',
  'Embarque na maior aventura da Bíblia',
  'Colore a Arca de Noé com todos os seus animais favoritos.',
  'Colorir agora';

-- ===== MIGRATION: 20260424013949_4420fce7-f513-41fe-88f6-ff8b4caa0f1f.sql =====
UPDATE public.catalog_products SET cover_image_url = '/catalog/nascimento-jesus.png' WHERE slug = 'o-nascimento-de-jesus';
UPDATE public.catalog_products SET cover_image_url = '/catalog/jesus-criancas.png' WHERE slug = 'jesus-e-as-criancas';
UPDATE public.catalog_products SET cover_image_url = '/catalog/multiplicacao-paes.png' WHERE slug = 'a-multiplicacao-dos-paes';
UPDATE public.catalog_products SET cover_image_url = '/catalog/bom-samaritano.png' WHERE slug = 'o-bom-samaritano';
UPDATE public.catalog_products SET cover_image_url = '/catalog/jesus-acalma-a-tempestade.png' WHERE slug = 'jesus-acalma-a-tempestade';
UPDATE public.catalog_products SET cover_image_url = '/catalog/jesus-tempestade.png' WHERE slug = 'jesus-acalma-a-tempestade';

-- ===== MIGRATION: 20260424014741_2102c7cc-e4aa-4ce1-b6e8-cf941e46b910.sql =====
UPDATE public.catalog_products
SET cover_image_url = NULL
WHERE cover_image_url LIKE '/catalog/%';

-- ===== MIGRATION: 20260424021955_d0114697-cc5c-4c95-af92-79e8b273f8d0.sql =====
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS language_override text;

COMMENT ON COLUMN public.profiles.language_override IS
  'User-selected app language (pt-BR/en-US/es-ES). Overrides app_settings.default_language when set.';

-- ===== MIGRATION: 20260424023157_2d9f489e-ce61-459a-bce5-0aff26da7650.sql =====
-- Insere as 10 primeiras páginas (line-art) da história "Arca de Noé"
-- Páginas servidas como assets estáticos a partir de /public/stories/noe-e-a-arca/
INSERT INTO public.stories_pages (story_id, page_number, title, image_lineart_url, is_active)
VALUES
  ('c0d683b5-e7c4-4f7e-9e9c-ec068c064715', 1,  'Página 1',  '/stories/noe-e-a-arca/page-01.jpg', true),
  ('c0d683b5-e7c4-4f7e-9e9c-ec068c064715', 2,  'Página 2',  '/stories/noe-e-a-arca/page-02.jpg', true),
  ('c0d683b5-e7c4-4f7e-9e9c-ec068c064715', 3,  'Página 3',  '/stories/noe-e-a-arca/page-03.jpg', true),
  ('c0d683b5-e7c4-4f7e-9e9c-ec068c064715', 4,  'Página 4',  '/stories/noe-e-a-arca/page-04.jpg', true),
  ('c0d683b5-e7c4-4f7e-9e9c-ec068c064715', 5,  'Página 5',  '/stories/noe-e-a-arca/page-05.jpg', true),
  ('c0d683b5-e7c4-4f7e-9e9c-ec068c064715', 6,  'Página 6',  '/stories/noe-e-a-arca/page-06.jpg', true),
  ('c0d683b5-e7c4-4f7e-9e9c-ec068c064715', 7,  'Página 7',  '/stories/noe-e-a-arca/page-07.jpg', true),
  ('c0d683b5-e7c4-4f7e-9e9c-ec068c064715', 8,  'Página 8',  '/stories/noe-e-a-arca/page-08.jpg', true),
  ('c0d683b5-e7c4-4f7e-9e9c-ec068c064715', 9,  'Página 9',  '/stories/noe-e-a-arca/page-09.jpg', true),
  ('c0d683b5-e7c4-4f7e-9e9c-ec068c064715', 10, 'Página 10', '/stories/noe-e-a-arca/page-10.jpg', true);

-- ===== MIGRATION: 20260424023541_8979665f-6f0c-4683-a965-eb235839b9b8.sql =====
INSERT INTO public.stories_pages (story_id, page_number, title, image_lineart_url, is_active)
VALUES
  ('c0d683b5-e7c4-4f7e-9e9c-ec068c064715', 11, 'Página 11', '/stories/noe-e-a-arca/page-11.jpg', true),
  ('c0d683b5-e7c4-4f7e-9e9c-ec068c064715', 12, 'Página 12', '/stories/noe-e-a-arca/page-12.jpg', true),
  ('c0d683b5-e7c4-4f7e-9e9c-ec068c064715', 13, 'Página 13', '/stories/noe-e-a-arca/page-13.jpg', true),
  ('c0d683b5-e7c4-4f7e-9e9c-ec068c064715', 14, 'Página 14', '/stories/noe-e-a-arca/page-14.jpg', true),
  ('c0d683b5-e7c4-4f7e-9e9c-ec068c064715', 15, 'Página 15', '/stories/noe-e-a-arca/page-15.jpg', true),
  ('c0d683b5-e7c4-4f7e-9e9c-ec068c064715', 16, 'Página 16', '/stories/noe-e-a-arca/page-16.jpg', true),
  ('c0d683b5-e7c4-4f7e-9e9c-ec068c064715', 17, 'Página 17', '/stories/noe-e-a-arca/page-17.jpg', true),
  ('c0d683b5-e7c4-4f7e-9e9c-ec068c064715', 18, 'Página 18', '/stories/noe-e-a-arca/page-18.jpg', true),
  ('c0d683b5-e7c4-4f7e-9e9c-ec068c064715', 19, 'Página 19', '/stories/noe-e-a-arca/page-19.jpg', true),
  ('c0d683b5-e7c4-4f7e-9e9c-ec068c064715', 20, 'Página 20', '/stories/noe-e-a-arca/page-20.jpg', true);

-- ===== MIGRATION: 20260424023712_d01191fe-4445-477f-b6f1-b36518c71b92.sql =====
INSERT INTO public.stories_pages (story_id, page_number, title, image_lineart_url, is_active)
VALUES
  ('c0d683b5-e7c4-4f7e-9e9c-ec068c064715', 21, 'Página 21', '/stories/noe-e-a-arca/page-21.jpg', true),
  ('c0d683b5-e7c4-4f7e-9e9c-ec068c064715', 22, 'Página 22', '/stories/noe-e-a-arca/page-22.jpg', true),
  ('c0d683b5-e7c4-4f7e-9e9c-ec068c064715', 23, 'Página 23', '/stories/noe-e-a-arca/page-23.jpg', true),
  ('c0d683b5-e7c4-4f7e-9e9c-ec068c064715', 24, 'Página 24', '/stories/noe-e-a-arca/page-24.jpg', true),
  ('c0d683b5-e7c4-4f7e-9e9c-ec068c064715', 25, 'Página 25', '/stories/noe-e-a-arca/page-25.jpg', true),
  ('c0d683b5-e7c4-4f7e-9e9c-ec068c064715', 26, 'Página 26', '/stories/noe-e-a-arca/page-26.jpg', true),
  ('c0d683b5-e7c4-4f7e-9e9c-ec068c064715', 27, 'Página 27', '/stories/noe-e-a-arca/page-27.jpg', true),
  ('c0d683b5-e7c4-4f7e-9e9c-ec068c064715', 28, 'Página 28', '/stories/noe-e-a-arca/page-28.jpg', true),
  ('c0d683b5-e7c4-4f7e-9e9c-ec068c064715', 29, 'Página 29', '/stories/noe-e-a-arca/page-29.jpg', true),
  ('c0d683b5-e7c4-4f7e-9e9c-ec068c064715', 30, 'Página 30', '/stories/noe-e-a-arca/page-30.jpg', true);

-- ===== MIGRATION: 20260424024423_411e92de-1b29-4449-9809-492f1473aebf.sql =====
-- Seed admin bootstrap
-- 1) Store the seed admin email in app_settings_kv (idempotent upsert)
INSERT INTO public.app_settings_kv (key, value_json, description)
VALUES (
  'seed_admin_email',
  to_jsonb('ericvinicius1987@gmail.com'::text),
  'E-mail promovido automaticamente a admin no signup (bootstrap).'
)
ON CONFLICT (key) DO UPDATE
  SET value_json = EXCLUDED.value_json,
      description = EXCLUDED.description,
      updated_at = now();

-- 2) Trigger function: on new auth user, if email matches the seed,
--    grant the admin role and ensure a profile exists.
CREATE OR REPLACE FUNCTION public.handle_seed_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  seed_email text;
BEGIN
  SELECT (value_json #>> '{}')
    INTO seed_email
    FROM public.app_settings_kv
   WHERE key = 'seed_admin_email'
   LIMIT 1;

  IF seed_email IS NULL OR seed_email = '' THEN
    RETURN NEW;
  END IF;

  IF lower(NEW.email) = lower(seed_email) THEN
    -- Ensure profile row exists (handle_new_user_profile already does this,
    -- but we keep it idempotent in case the order of triggers changes).
    INSERT INTO public.profiles (user_id, display_name, purchase_email)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data ->> 'display_name', 'Administrador'),
      NEW.email
    )
    ON CONFLICT (user_id) DO NOTHING;

    -- Grant admin role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- 3) Attach trigger to auth.users (Supabase-supported pattern)
DROP TRIGGER IF EXISTS on_auth_user_created_seed_admin ON auth.users;
CREATE TRIGGER on_auth_user_created_seed_admin
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_seed_admin();

-- 4) Promote immediately if the seed user already exists
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::public.app_role
  FROM auth.users u
  JOIN public.app_settings_kv s ON s.key = 'seed_admin_email'
 WHERE lower(u.email) = lower(s.value_json #>> '{}')
ON CONFLICT (user_id, role) DO NOTHING;

-- ===== MIGRATION: 20260424025349_fb77ee7d-9c21-4548-ac8a-67e43c9667d1.sql =====
-- Align story slug with catalog product slug
UPDATE public.stories
   SET slug = 'arca-de-noe',
       updated_at = now()
 WHERE id = 'c0d683b5-e7c4-4f7e-9e9c-ec068c064715';

-- Update page asset URLs to the aligned folder
UPDATE public.stories_pages
   SET image_lineart_url = REPLACE(image_lineart_url,
                                   '/stories/noe-e-a-arca/',
                                   '/stories/arca-de-noe/'),
       updated_at = now()
 WHERE story_id = 'c0d683b5-e7c4-4f7e-9e9c-ec068c064715'
   AND image_lineart_url LIKE '/stories/noe-e-a-arca/%';

-- ===== MIGRATION: 20260424032314_e5a718a7-0c16-455b-b393-ee821a29d5e8.sql =====
-- ============================================================
-- USER PRODUCT ENTITLEMENTS + USER ORDERS
-- ============================================================
-- Two new tables:
--   user_product_entitlements: which products a user actually owns/has access to
--   user_orders: commercial purchase history (independent of entitlement)

-- ---------- user_product_entitlements ----------
CREATE TABLE IF NOT EXISTS public.user_product_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.catalog_products(id) ON DELETE CASCADE,
  source_type text NOT NULL DEFAULT 'purchase', -- purchase | plan | manual | bonus
  status text NOT NULL DEFAULT 'active',         -- active | expired | cancelled | refunded
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NULL,
  external_purchase_id text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_upe_user ON public.user_product_entitlements (user_id);
CREATE INDEX IF NOT EXISTS idx_upe_product ON public.user_product_entitlements (product_id);
CREATE INDEX IF NOT EXISTS idx_upe_status ON public.user_product_entitlements (status);

ALTER TABLE public.user_product_entitlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own entitlements"
  ON public.user_product_entitlements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins manage all entitlements"
  ON public.user_product_entitlements FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_user_product_entitlements_updated_at
  BEFORE UPDATE ON public.user_product_entitlements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- user_orders ----------
CREATE TABLE IF NOT EXISTS public.user_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NULL REFERENCES public.catalog_products(id) ON DELETE SET NULL,
  plan_id uuid NULL REFERENCES public.plans(id) ON DELETE SET NULL,
  order_number text NULL,
  external_order_id text NULL,
  payment_provider text NOT NULL DEFAULT 'perfectpay',
  purchase_status text NOT NULL DEFAULT 'pending', -- pending | approved | refunded | cancelled
  amount_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BRL',
  purchased_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz NULL,
  refunded_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_orders_user ON public.user_orders (user_id);
CREATE INDEX IF NOT EXISTS idx_user_orders_product ON public.user_orders (product_id);
CREATE INDEX IF NOT EXISTS idx_user_orders_status ON public.user_orders (purchase_status);

ALTER TABLE public.user_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own orders"
  ON public.user_orders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins manage all orders"
  ON public.user_orders FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_user_orders_updated_at
  BEFORE UPDATE ON public.user_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ===== MIGRATION: 20260424124019_c286e72c-2324-46ca-9bc5-efb3d7af9354.sql =====

-- 1) email_templates: remove leitura geral por authenticated
DROP POLICY IF EXISTS "Authenticated can view email templates" ON public.email_templates;
-- A política "Admins can manage email templates" (ALL) já cobre SELECT para admins.

-- 2) user_rewards: remover INSERT por usuários (deve ser concedido só via server-side/admin)
DROP POLICY IF EXISTS "Users insert own rewards" ON public.user_rewards;

-- Permitir que admins concedam recompensas
CREATE POLICY "Admins insert rewards"
  ON public.user_rewards
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 3) Realtime: adicionar RLS em realtime.messages com escopo por usuário
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

-- Limpar políticas anteriores idempotentemente
DROP POLICY IF EXISTS "Users receive own realtime messages" ON realtime.messages;
DROP POLICY IF EXISTS "Users send own realtime messages" ON realtime.messages;

-- Cada usuário só pode receber mensagens de canais cujo tópico contenha o seu user_id
CREATE POLICY "Users receive own realtime messages"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND (
      realtime.topic() LIKE ('user:' || auth.uid()::text || '%')
      OR realtime.topic() LIKE ('%:' || auth.uid()::text)
      OR realtime.topic() = auth.uid()::text
    )
  );

-- Cada usuário só pode enviar mensagens em canais do próprio escopo
CREATE POLICY "Users send own realtime messages"
  ON realtime.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      realtime.topic() LIKE ('user:' || auth.uid()::text || '%')
      OR realtime.topic() LIKE ('%:' || auth.uid()::text)
      OR realtime.topic() = auth.uid()::text
    )
  );


-- ===== MIGRATION: 20260424140513_8d4a74e8-aebf-478a-bbdf-3d639411ab4b.sql =====
DO $$
DECLARE
  v_story_id uuid;
  v_slug text;
  v_stories text[] := ARRAY['davi-e-golias', 'jonas-e-a-baleia'];
  i int;
  v_url text;
BEGIN
  FOREACH v_slug IN ARRAY v_stories LOOP
    SELECT id INTO v_story_id FROM public.stories WHERE slug = v_slug LIMIT 1;
    IF v_story_id IS NULL THEN
      RAISE NOTICE 'Story % not found, skipping', v_slug;
      CONTINUE;
    END IF;

    FOR i IN 1..30 LOOP
      v_url := '/lineart/' || v_slug || '/page-' || lpad(i::text, 2, '0') || '.png';

      INSERT INTO public.stories_pages (story_id, page_number, image_lineart_url, image_preview_url, is_active)
      VALUES (v_story_id, i, v_url, v_url, true)
      ON CONFLICT DO NOTHING;

      -- Garante atualização caso já exista (sem unique constraint conhecida, fazemos update manual)
      UPDATE public.stories_pages
         SET image_lineart_url = v_url,
             image_preview_url = COALESCE(image_preview_url, v_url),
             is_active = true,
             updated_at = now()
       WHERE story_id = v_story_id AND page_number = i;
    END LOOP;
  END LOOP;
END $$;

-- ===== MIGRATION: 20260424141513_324ac0fd-83f3-4110-9ca4-d8527c45ef6b.sql =====
DO $$
DECLARE
  v_story_id uuid := '35de27c4-679a-4f2c-8ce6-8243d9db2f66';
  v_slug text := 'moises-e-o-mar-vermelho';
  i int;
  v_url text;
  v_existing uuid;
BEGIN
  FOR i IN 1..30 LOOP
    v_url := '/lineart/' || v_slug || '/page-' || lpad(i::text, 2, '0') || '.png';

    SELECT id INTO v_existing
      FROM public.stories_pages
     WHERE story_id = v_story_id AND page_number = i
     LIMIT 1;

    IF v_existing IS NULL THEN
      INSERT INTO public.stories_pages (story_id, page_number, title, image_lineart_url, is_active)
      VALUES (v_story_id, i, 'Página ' || i, v_url, true);
    ELSE
      UPDATE public.stories_pages
         SET image_lineart_url = v_url,
             title = COALESCE(title, 'Página ' || i),
             is_active = true,
             updated_at = now()
       WHERE id = v_existing;
    END IF;
  END LOOP;
END $$;

-- ===== MIGRATION: 20260424142517_f7d93e1e-9300-4eee-b17c-8ec88701d486.sql =====
DO $$
DECLARE
  v_story_id uuid := 'fe828154-7ef7-4708-9d12-e6b0dab8bfa9';
  i int;
  v_url text;
BEGIN
  FOR i IN 1..30 LOOP
    v_url := '/lineart/daniel-na-cova-dos-leoes/page-' || lpad(i::text, 2, '0') || '.png';
    IF EXISTS (SELECT 1 FROM public.stories_pages WHERE story_id = v_story_id AND page_number = i) THEN
      UPDATE public.stories_pages
        SET image_lineart_url = v_url,
            title = 'Página ' || i,
            is_active = true,
            updated_at = now()
        WHERE story_id = v_story_id AND page_number = i;
    ELSE
      INSERT INTO public.stories_pages (story_id, page_number, title, image_lineart_url, is_active)
      VALUES (v_story_id, i, 'Página ' || i, v_url, true);
    END IF;
  END LOOP;
END $$;

-- ===== MIGRATION: 20260424150322_289a56df-3d68-44ac-8bf5-9c02d6ab5f55.sql =====
DO $$
DECLARE
  s RECORD;
  i INT;
  num TEXT;
BEGIN
  FOR s IN
    SELECT id, slug FROM public.stories
    WHERE slug IN ('a-criacao-do-mundo', 'ester-rainha-corajosa')
  LOOP
    FOR i IN 1..30 LOOP
      num := LPAD(i::text, 2, '0');
      INSERT INTO public.stories_pages (story_id, page_number, title, image_lineart_url, is_active)
      VALUES (
        s.id,
        i,
        'Página ' || i,
        '/lineart/' || s.slug || '/page-' || num || '.png',
        true
      )
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- ===== MIGRATION: 20260424160930_10cc923d-70ab-4f69-82d4-854ebdbbe9b0.sql =====
INSERT INTO public.stories_pages (story_id, page_number, title, image_lineart_url, is_active)
SELECT s.id, n, 'Página ' || n,
       '/lineart/' || s.slug || '/page-' || lpad(n::text, 2, '0') || '.png',
       true
FROM (VALUES
  ('6ed8f50c-278f-414c-a805-e249f1b8c3a0'::uuid, 'o-bom-samaritano'),
  ('5a72ccda-1fcc-4b72-8981-a5435cc965b8'::uuid, 'jesus-e-as-criancas'),
  ('92ef2f37-b4c3-4333-a1d7-c976623cc6dd'::uuid, 'a-multiplicacao-dos-paes')
) AS s(id, slug)
CROSS JOIN generate_series(1, 30) AS n
ON CONFLICT DO NOTHING;

-- Garante que páginas existentes recebam o caminho correto
UPDATE public.stories_pages sp
SET image_lineart_url = '/lineart/' || s.slug || '/page-' || lpad(sp.page_number::text, 2, '0') || '.png',
    is_active = true,
    title = COALESCE(sp.title, 'Página ' || sp.page_number)
FROM public.stories s
WHERE sp.story_id = s.id
  AND s.slug IN ('o-bom-samaritano','jesus-e-as-criancas','a-multiplicacao-dos-paes')
  AND (sp.image_lineart_url IS NULL OR sp.image_lineart_url = '' OR sp.image_lineart_url NOT LIKE '/lineart/%');

-- ===== MIGRATION: 20260424161740_0fa1778b-f8ac-4a13-81a4-89af71b41b28.sql =====
DO $$
DECLARE
  v_story_id uuid := '9aec65c1-8a39-456e-ad96-daabef303ada';
  i int;
  v_num text;
  v_url text;
  v_existing uuid;
BEGIN
  FOR i IN 1..30 LOOP
    v_num := lpad(i::text, 2, '0');
    v_url := '/lineart/jesus-acalma-a-tempestade/page-' || v_num || '.png';

    SELECT id INTO v_existing
      FROM public.stories_pages
     WHERE story_id = v_story_id AND page_number = i
     LIMIT 1;

    IF v_existing IS NOT NULL THEN
      UPDATE public.stories_pages
         SET image_lineart_url = v_url,
             is_active = true,
             updated_at = now()
       WHERE id = v_existing;
    ELSE
      INSERT INTO public.stories_pages (story_id, page_number, title, image_lineart_url, is_active)
      VALUES (v_story_id, i, 'Página ' || i, v_url, true);
    END IF;
  END LOOP;
END $$;

-- ===== MIGRATION: 20260424162604_e0899d69-6519-4369-87c3-45a3c170ea9d.sql =====

WITH s AS (SELECT 'eb899ab3-ec42-4177-a30a-d7b323d3ea79'::uuid AS id),
nums AS (SELECT generate_series(1, 30) AS n)
INSERT INTO public.stories_pages (story_id, page_number, title, image_lineart_url, is_active)
SELECT s.id, n, 'Página ' || n,
       '/lineart/o-filho-prodigo/page-' || lpad(n::text, 2, '0') || '.png',
       true
FROM s, nums
ON CONFLICT (story_id, page_number) DO UPDATE
  SET image_lineart_url = EXCLUDED.image_lineart_url,
      is_active = true,
      updated_at = now();


-- ===== MIGRATION: 20260424163934_27dc3348-ce19-4a9d-a021-b1401da3735e.sql =====
INSERT INTO public.stories_pages (story_id, page_number, title, image_lineart_url, is_active)
SELECT
  '6facbbcb-8cf0-4fce-9bb0-9068d18cd05f'::uuid,
  gs,
  'Página ' || gs,
  '/lineart/a-ovelha-perdida/page-' || lpad(gs::text, 2, '0') || '.png',
  true
FROM generate_series(1, 30) AS gs
ON CONFLICT DO NOTHING;

UPDATE public.stories_pages
SET image_lineart_url = '/lineart/a-ovelha-perdida/page-' || lpad(page_number::text, 2, '0') || '.png',
    is_active = true,
    updated_at = now()
WHERE story_id = '6facbbcb-8cf0-4fce-9bb0-9068d18cd05f'
  AND page_number BETWEEN 1 AND 30;

-- ===== MIGRATION: 20260424200947_345574f8-bc70-4503-b0e4-3e7e1bee85b2.sql =====
-- Default account id for single-tenant phase (multi-tenant leve)
-- This UUID is fixed so all current data belongs to the same logical "account".
-- Phase later: introduce real `accounts` table and migrate this column.

CREATE TABLE public.member_area_variations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  title text NOT NULL,
  slug text NOT NULL,
  description text,
  short_label text,
  primary_type text NOT NULL DEFAULT 'mixed', -- mixed | drawing | course | download
  logo_url text,
  hero_image_url text,
  primary_color text,
  secondary_color text,
  accent_color text,
  default_locale text NOT NULL DEFAULT 'pt-BR',
  status text NOT NULL DEFAULT 'draft', -- active | draft | paused
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT member_area_variations_slug_account_unique UNIQUE (account_id, slug),
  CONSTRAINT member_area_variations_status_check CHECK (status IN ('active', 'draft', 'paused')),
  CONSTRAINT member_area_variations_primary_type_check CHECK (primary_type IN ('mixed', 'drawing', 'course', 'download'))
);

CREATE INDEX idx_member_area_variations_account ON public.member_area_variations(account_id);
CREATE INDEX idx_member_area_variations_status ON public.member_area_variations(status);

-- Enable RLS
ALTER TABLE public.member_area_variations ENABLE ROW LEVEL SECURITY;

-- Anyone can view active variations (needed for public student area)
CREATE POLICY "Anyone can view active variations"
ON public.member_area_variations
FOR SELECT
USING (status = 'active' OR has_role(auth.uid(), 'admin'::app_role));

-- Admins can manage everything
CREATE POLICY "Admins manage member area variations"
ON public.member_area_variations
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Auto-update timestamps
CREATE TRIGGER update_member_area_variations_updated_at
BEFORE UPDATE ON public.member_area_variations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enforce maximum of 5 variations per account
CREATE OR REPLACE FUNCTION public.enforce_member_area_variation_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  current_count integer;
BEGIN
  SELECT count(*) INTO current_count
  FROM public.member_area_variations
  WHERE account_id = NEW.account_id;

  IF current_count >= 5 THEN
    RAISE EXCEPTION 'Limite de 5 variações por conta atingido.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_variation_limit_before_insert
BEFORE INSERT ON public.member_area_variations
FOR EACH ROW
EXECUTE FUNCTION public.enforce_member_area_variation_limit();

-- Seed the initial variation matching the current mocked one in the UI
INSERT INTO public.member_area_variations (
  id, title, slug, short_label, primary_type, status, order_index, accent_color
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Reino das Cores Kids',
  'reino-das-cores-kids',
  'Kids',
  'drawing',
  'active',
  0,
  '#D4AF37'
);

-- ===== MIGRATION: 20260424201349_affa2e4b-04e9-45d2-9dab-4694d6ebfa14.sql =====
-- Add product_type column with check constraint
ALTER TABLE public.catalog_products
ADD COLUMN product_type text NOT NULL DEFAULT 'drawing';

ALTER TABLE public.catalog_products
ADD CONSTRAINT catalog_products_product_type_check
CHECK (product_type IN ('drawing', 'course', 'download'));

-- Add variation_id linking each product to a member area
ALTER TABLE public.catalog_products
ADD COLUMN variation_id uuid REFERENCES public.member_area_variations(id) ON DELETE SET NULL;

CREATE INDEX idx_catalog_products_variation ON public.catalog_products(variation_id);
CREATE INDEX idx_catalog_products_type ON public.catalog_products(product_type);

-- Backfill existing rows to point at the seed variation
UPDATE public.catalog_products
SET variation_id = '11111111-1111-1111-1111-111111111111'
WHERE variation_id IS NULL;

-- ===== MIGRATION: 20260424201845_098aa80b-2ffd-4c65-a7ff-360ac33c11d7.sql =====

-- Add story_id linking drawing products to a story (which holds pages)
ALTER TABLE public.catalog_products
ADD COLUMN story_id uuid REFERENCES public.stories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_catalog_products_story ON public.catalog_products(story_id);

-- Storage policies for the existing story-pages-lineart bucket so admins
-- can upload page artwork directly from the admin panel (browser).
-- The bucket is already public for read access, so we only add admin write/update/delete policies.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Admins upload story page artwork'
  ) THEN
    CREATE POLICY "Admins upload story page artwork"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id IN ('story-pages-lineart', 'story-pages-preview', 'story-pages-samples', 'story-covers')
      AND public.has_role(auth.uid(), 'admin'::public.app_role)
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Admins update story page artwork'
  ) THEN
    CREATE POLICY "Admins update story page artwork"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
      bucket_id IN ('story-pages-lineart', 'story-pages-preview', 'story-pages-samples', 'story-covers')
      AND public.has_role(auth.uid(), 'admin'::public.app_role)
    )
    WITH CHECK (
      bucket_id IN ('story-pages-lineart', 'story-pages-preview', 'story-pages-samples', 'story-covers')
      AND public.has_role(auth.uid(), 'admin'::public.app_role)
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Admins delete story page artwork'
  ) THEN
    CREATE POLICY "Admins delete story page artwork"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
      bucket_id IN ('story-pages-lineart', 'story-pages-preview', 'story-pages-samples', 'story-covers')
      AND public.has_role(auth.uid(), 'admin'::public.app_role)
    );
  END IF;
END $$;


-- ===== MIGRATION: 20260424202621_e7bc6701-6c1d-4667-9a9a-0138a2ae7e83.sql =====

-- 1. Plan → Products grants (which products a plan unlocks)
CREATE TABLE IF NOT EXISTS public.plan_product_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.catalog_products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_plan_product_grants_plan ON public.plan_product_grants(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_product_grants_product ON public.plan_product_grants(product_id);

ALTER TABLE public.plan_product_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view plan-product grants"
ON public.plan_product_grants FOR SELECT
USING (true);

CREATE POLICY "Admins manage plan-product grants"
ON public.plan_product_grants FOR ALL
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 2. Optional plan codes on a product (alternative to grants table for simple cases)
ALTER TABLE public.catalog_products
  ADD COLUMN IF NOT EXISTS required_plan_codes text[] NOT NULL DEFAULT ARRAY[]::text[];

CREATE INDEX IF NOT EXISTS idx_catalog_products_required_plan_codes
  ON public.catalog_products USING GIN (required_plan_codes);

-- 3. Webhook events status/reason columns (the UI already reads them)
ALTER TABLE public.webhook_events
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ok',
  ADD COLUMN IF NOT EXISTS reason text;

CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON public.webhook_events(status);

-- 4. Helper function for the entitlement check used by the app
CREATE OR REPLACE FUNCTION public.user_has_product_access(
  _user_id uuid,
  _product_id uuid
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_product_entitlements
    WHERE user_id = _user_id
      AND product_id = _product_id
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > now())
  )
  OR EXISTS (
    SELECT 1 FROM public.catalog_products
    WHERE id = _product_id AND is_locked = false
  )
  OR public.has_role(_user_id, 'admin'::public.app_role);
$$;


-- ===== MIGRATION: 20260424212727_08abd497-ceb1-4716-a8f6-fe5e46e94366.sql =====
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles(phone) WHERE phone IS NOT NULL;

-- ===== MIGRATION: 20260424212822_3298c21b-946e-4ecd-bc4c-2677ef394302.sql =====
CREATE TABLE IF NOT EXISTS public.access_resend_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL,
  target_user_id uuid NOT NULL,
  product_id uuid,
  order_id uuid,
  channel text NOT NULL DEFAULT 'email',
  recipient text,
  status text NOT NULL DEFAULT 'queued',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_access_resend_log_target_user ON public.access_resend_log(target_user_id);
CREATE INDEX IF NOT EXISTS idx_access_resend_log_created_at ON public.access_resend_log(created_at DESC);

ALTER TABLE public.access_resend_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view access resend log"
  ON public.access_resend_log
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert access resend log"
  ON public.access_resend_log
  FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND admin_user_id = auth.uid());

-- ===== MIGRATION: 20260424234815_2cdf0281-c94a-4be6-b70d-dc0dd7bb262b.sql =====
-- Estender member_area_variations com campos de subdomínio, branding extra e login
ALTER TABLE public.member_area_variations
  ADD COLUMN IF NOT EXISTS subdomain_key text,
  ADD COLUMN IF NOT EXISTS root_domain text,
  ADD COLUMN IF NOT EXISTS domain_mode text NOT NULL DEFAULT 'subdomain',
  ADD COLUMN IF NOT EXISTS background_color text,
  ADD COLUMN IF NOT EXISTS surface_color text,
  ADD COLUMN IF NOT EXISTS text_color text,
  ADD COLUMN IF NOT EXISTS button_color text,
  ADD COLUMN IF NOT EXISTS button_text_color text,
  ADD COLUMN IF NOT EXISTS favicon_url text,
  ADD COLUMN IF NOT EXISTS login_image_url text,
  ADD COLUMN IF NOT EXISTS login_title text,
  ADD COLUMN IF NOT EXISTS login_subtitle text,
  ADD COLUMN IF NOT EXISTS login_email_placeholder text,
  ADD COLUMN IF NOT EXISTS login_password_placeholder text,
  ADD COLUMN IF NOT EXISTS login_submit_label text,
  ADD COLUMN IF NOT EXISTS login_helper_text text,
  ADD COLUMN IF NOT EXISTS login_footer_text text,
  ADD COLUMN IF NOT EXISTS login_layout_mode text NOT NULL DEFAULT 'split-right',
  ADD COLUMN IF NOT EXISTS login_background_mode text NOT NULL DEFAULT 'solid';

-- Backfill: subdomain_key derivado do slug existente (sem hífens)
UPDATE public.member_area_variations
SET subdomain_key = regexp_replace(lower(slug), '[^a-z0-9]', '', 'g')
WHERE subdomain_key IS NULL;

-- Garantir unicidade de subdomain_key por conta
CREATE UNIQUE INDEX IF NOT EXISTS member_area_variations_account_subdomain_idx
  ON public.member_area_variations (account_id, subdomain_key);

-- Tabela de domínios para futura conexão na Vercel (wildcard, custom domains, etc.)
CREATE TABLE IF NOT EXISTS public.member_area_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_area_id uuid NOT NULL REFERENCES public.member_area_variations(id) ON DELETE CASCADE,
  root_domain text NOT NULL,
  subdomain_key text NOT NULL,
  full_domain text NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (full_domain)
);

CREATE INDEX IF NOT EXISTS member_area_domains_area_idx
  ON public.member_area_domains (member_area_id);

ALTER TABLE public.member_area_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage member area domains"
  ON public.member_area_domains
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Anyone can view member area domains"
  ON public.member_area_domains
  FOR SELECT
  USING (true);

CREATE TRIGGER trg_member_area_domains_updated_at
  BEFORE UPDATE ON public.member_area_domains
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ===== MIGRATION: 20260425000022_e43dba65-e193-4652-becd-0528a551ca47.sql =====
-- =====================================================
-- COMMERCIAL OFFERS MODULE
-- =====================================================

-- Main offers table
CREATE TABLE public.commercial_offers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  variation_id uuid NOT NULL REFERENCES public.member_area_variations(id) ON DELETE CASCADE,
  gateway text NOT NULL DEFAULT 'perfectpay',
  offer_name text NOT NULL,
  sale_mode text NOT NULL DEFAULT 'one_time',
  token text,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.commercial_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage commercial offers"
ON public.commercial_offers
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_commercial_offers_updated_at
BEFORE UPDATE ON public.commercial_offers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_commercial_offers_variation ON public.commercial_offers(variation_id);
CREATE INDEX idx_commercial_offers_gateway ON public.commercial_offers(gateway);
CREATE INDEX idx_commercial_offers_status ON public.commercial_offers(status);

-- Codes (multi-codes per offer)
CREATE TABLE public.commercial_offer_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  offer_id uuid NOT NULL REFERENCES public.commercial_offers(id) ON DELETE CASCADE,
  code text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(offer_id, code)
);

ALTER TABLE public.commercial_offer_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage offer codes"
ON public.commercial_offer_codes
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_offer_codes_offer ON public.commercial_offer_codes(offer_id);
CREATE INDEX idx_offer_codes_code ON public.commercial_offer_codes(lower(code));

-- Products linked to each offer
CREATE TABLE public.commercial_offer_products (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  offer_id uuid NOT NULL REFERENCES public.commercial_offers(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.catalog_products(id) ON DELETE CASCADE,
  access_duration_type text NOT NULL DEFAULT 'lifetime',
  access_duration_days integer,
  release_mode text NOT NULL DEFAULT 'immediate',
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(offer_id, product_id)
);

ALTER TABLE public.commercial_offer_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage offer products"
ON public.commercial_offer_products
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_commercial_offer_products_updated_at
BEFORE UPDATE ON public.commercial_offer_products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_offer_products_offer ON public.commercial_offer_products(offer_id);
CREATE INDEX idx_offer_products_product ON public.commercial_offer_products(product_id);

-- ===== MIGRATION: 20260425011112_f1bc315d-d880-49a6-8bb8-4696b8bfd17c.sql =====
-- =====================================================
-- COURSE MODULES
-- =====================================================
CREATE TABLE public.course_modules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.catalog_products(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_course_modules_product ON public.course_modules(product_id, order_index);

ALTER TABLE public.course_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage course modules"
  ON public.course_modules
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Anyone can view course modules"
  ON public.course_modules
  FOR SELECT
  USING (true);

CREATE TRIGGER update_course_modules_updated_at
  BEFORE UPDATE ON public.course_modules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- COURSE LESSONS
-- =====================================================
CREATE TABLE public.course_lessons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  module_id UUID NOT NULL REFERENCES public.course_modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  provider TEXT NOT NULL DEFAULT 'youtube',
  video_url TEXT,
  embed_code TEXT,
  body_text TEXT,
  complementary_url TEXT,
  complementary_label TEXT,
  pdf_url TEXT,
  pdf_label TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_course_lessons_module ON public.course_lessons(module_id, order_index);

ALTER TABLE public.course_lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage course lessons"
  ON public.course_lessons
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Anyone can view published course lessons"
  ON public.course_lessons
  FOR SELECT
  USING (status = 'published' OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER update_course_lessons_updated_at
  BEFORE UPDATE ON public.course_lessons
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- COURSE LESSON PROGRESS
-- =====================================================
CREATE TABLE public.course_lesson_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  lesson_id UUID NOT NULL REFERENCES public.course_lessons(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ,
  last_position_seconds INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, lesson_id)
);

CREATE INDEX idx_course_lesson_progress_user ON public.course_lesson_progress(user_id);
CREATE INDEX idx_course_lesson_progress_lesson ON public.course_lesson_progress(lesson_id);

ALTER TABLE public.course_lesson_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view all lesson progress"
  ON public.course_lesson_progress
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Users view own lesson progress"
  ON public.course_lesson_progress
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own lesson progress"
  ON public.course_lesson_progress
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own lesson progress"
  ON public.course_lesson_progress
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own lesson progress"
  ON public.course_lesson_progress
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_course_lesson_progress_updated_at
  BEFORE UPDATE ON public.course_lesson_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ===== MIGRATION: 20260425013404_afc5daf5-3bed-43e7-9fa0-fb6530f9578b.sql =====
-- 1) Cria as 3 seções de histórias para a área "Reino das Cores Kids"
--    (escopo é global em catalog_sections, mas só serão usadas pelos produtos
--    da variação 11111111-1111-1111-1111-111111111111).
INSERT INTO public.catalog_sections (id, title, slug, subtitle, description, is_active, order_index)
VALUES
  (gen_random_uuid(), 'Antigo Testamento', 'antigo-testamento',
   'Histórias do Antigo Testamento',
   'Coleção de histórias bíblicas do Antigo Testamento para colorir.',
   true, 0),
  (gen_random_uuid(), 'Novo Testamento', 'novo-testamento',
   'Histórias do Novo Testamento',
   'Coleção de histórias bíblicas do Novo Testamento para colorir.',
   true, 1),
  (gen_random_uuid(), 'Parábolas de Jesus', 'parabolas-de-jesus',
   'As parábolas que Jesus contou',
   'Parábolas ensinadas por Jesus, transformadas em desenhos para colorir.',
   true, 2)
ON CONFLICT (slug) DO NOTHING;

-- 2) Vincula os 14 produtos de colorir (variation Reino das Cores Kids) às seções
WITH s AS (
  SELECT
    (SELECT id FROM public.catalog_sections WHERE slug = 'antigo-testamento')   AS antigo,
    (SELECT id FROM public.catalog_sections WHERE slug = 'novo-testamento')     AS novo,
    (SELECT id FROM public.catalog_sections WHERE slug = 'parabolas-de-jesus')  AS parabolas
)
UPDATE public.catalog_products p
SET section_id = CASE
  WHEN p.slug IN (
    'arca-de-noe','davi-e-golias','moises-e-o-mar-vermelho',
    'daniel-na-cova-dos-leoes','a-criacao-do-mundo',
    'ester-rainha-corajosa','jonas-e-a-baleia'
  ) THEN (SELECT antigo FROM s)
  WHEN p.slug IN (
    'o-nascimento-de-jesus','jesus-e-as-criancas',
    'jesus-acalma-a-tempestade','a-multiplicacao-dos-paes'
  ) THEN (SELECT novo FROM s)
  WHEN p.slug IN (
    'o-filho-prodigo','a-ovelha-perdida','o-bom-samaritano'
  ) THEN (SELECT parabolas FROM s)
  ELSE p.section_id
END,
updated_at = now()
WHERE p.variation_id = '11111111-1111-1111-1111-111111111111'
  AND p.product_type = 'drawing';

-- 3) Remove as seções de teste vazias (dscsac, v2) — só se não estiverem
--    sendo usadas por nenhum produto, garantindo zero impacto em outras áreas.
DELETE FROM public.catalog_sections
WHERE slug IN ('dscsac','v2')
  AND NOT EXISTS (
    SELECT 1 FROM public.catalog_products WHERE section_id = catalog_sections.id
  );

-- ===== MIGRATION: 20260425024346_fee1e82f-1aa9-45ff-a9cc-aadc4bcb8dd5.sql =====
-- 1) Adiciona coluna variation_id em catalog_sections
ALTER TABLE public.catalog_sections
  ADD COLUMN IF NOT EXISTS variation_id uuid
    REFERENCES public.member_area_variations(id) ON DELETE CASCADE;

-- 2) Vincula seções existentes à variação "Reino das Cores Kids"
UPDATE public.catalog_sections
   SET variation_id = '11111111-1111-1111-1111-111111111111'
 WHERE slug IN ('antigo-testamento', 'novo-testamento', 'parabolas-de-jesus');

-- 3) Remove produto e seção "dscsac"
DELETE FROM public.catalog_products
 WHERE section_id = '76752456-5779-415a-a0a9-e056bd04033b';

DELETE FROM public.catalog_sections
 WHERE id = '76752456-5779-415a-a0a9-e056bd04033b';

-- 4) Índice para filtros por variação
CREATE INDEX IF NOT EXISTS catalog_sections_variation_id_idx
  ON public.catalog_sections(variation_id);

-- ===== MIGRATION: 20260425025750_1527a782-7e56-4c4f-8f1b-6a66f468b9e6.sql =====
-- Remove orphan catalog products that have no section_id
DELETE FROM public.catalog_products
WHERE section_id IS NULL;

-- ===== MIGRATION: 20260425032141_7304e54b-bc1d-43eb-a7f3-7326f0bfa8a2.sql =====
ALTER TABLE public.home_settings
  ADD COLUMN IF NOT EXISTS hero_image_url TEXT;


-- ===== MIGRATION: 20260425035332_777f17ff-530c-46eb-bb4c-c1367cdc733b.sql =====
ALTER TABLE public.home_settings
ADD COLUMN IF NOT EXISTS hero_overlay_opacity numeric NOT NULL DEFAULT 0.7
CHECK (hero_overlay_opacity >= 0 AND hero_overlay_opacity <= 1);

-- ===== MIGRATION: 20260425040029_e0640940-7eb2-44f3-b43d-e90cc54fa112.sql =====
-- Scope home_settings per member-area variation
ALTER TABLE public.home_settings
  ADD COLUMN IF NOT EXISTS variation_id uuid REFERENCES public.member_area_variations(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS home_settings_variation_id_unique
  ON public.home_settings (variation_id)
  WHERE variation_id IS NOT NULL;

-- Backfill: attach the existing single global row to the first (oldest) variation
-- so the historical hero stays attached to that area only.
UPDATE public.home_settings hs
SET variation_id = (
  SELECT id FROM public.member_area_variations
  ORDER BY created_at ASC
  LIMIT 1
)
WHERE hs.variation_id IS NULL
  AND EXISTS (SELECT 1 FROM public.member_area_variations);

-- Create one empty home_settings row for every other variation that doesn't have one yet
INSERT INTO public.home_settings (variation_id)
SELECT v.id
FROM public.member_area_variations v
WHERE NOT EXISTS (
  SELECT 1 FROM public.home_settings h WHERE h.variation_id = v.id
);

-- ===== MIGRATION: 20260425040811_424eddf7-fa13-456e-bf55-1aea77fa9c7b.sql =====
-- Add enabled_languages array to member_area_variations
ALTER TABLE public.member_area_variations
  ADD COLUMN IF NOT EXISTS enabled_languages text[] NOT NULL DEFAULT ARRAY['pt-BR','en-US','es-ES']::text[],
  ADD COLUMN IF NOT EXISTS sidebar_color text,
  ADD COLUMN IF NOT EXISTS card_color text;

-- Backfill sidebar_color/card_color with existing surface_color when null
UPDATE public.member_area_variations
   SET sidebar_color = COALESCE(sidebar_color, surface_color, background_color),
       card_color    = COALESCE(card_color, surface_color, background_color)
 WHERE sidebar_color IS NULL OR card_color IS NULL;

-- ===== MIGRATION: 20260425042345_f70fa476-a5d4-4abb-9925-157eca8c7386.sql =====
-- 1) Mover páginas das stories "mini-..." duplicadas para a story original (mesmo título/slug base)
--    e re-apontar os produtos para a story original.

-- 1a) O Nascimento de Jesus
UPDATE public.stories_pages
SET story_id = '8cfe169f-e45a-466f-9528-826541240ca3'  -- original
WHERE story_id = '1a4c89e1-54ab-453c-b672-ff5db1639ab1'; -- mini

UPDATE public.catalog_products
SET story_id = '8cfe169f-e45a-466f-9528-826541240ca3'
WHERE id = '3a7b2a7f-1ff0-4c1a-9be3-0243b2793ddb';

DELETE FROM public.stories WHERE id = '1a4c89e1-54ab-453c-b672-ff5db1639ab1';

-- 1b) Arca de Noé — re-apontar para a original e remover a mini vazia
UPDATE public.catalog_products
SET story_id = 'c0d683b5-e7c4-4f7e-9e9c-ec068c064715'
WHERE id = 'a4def457-393e-4d2e-ac95-f0d397d15b96';

DELETE FROM public.stories WHERE id = '47a4cf3e-826f-4737-8c19-70edcc5b34a7';

-- 1c) O Filho Pródigo — re-apontar para a original e remover a mini vazia
UPDATE public.catalog_products
SET story_id = 'eb899ab3-ec42-4177-a30a-d7b323d3ea79'
WHERE id = 'bec2ba35-3f5c-476a-9192-4b2ace7a61a2';

DELETE FROM public.stories WHERE id = '484d6f94-1e3f-43dd-ab8c-f063ccb4ed4e';

-- 2) Para todos os demais produtos do tipo "drawing" sem story_id,
--    vincular automaticamente à story que tem o mesmo slug.
UPDATE public.catalog_products cp
SET story_id = s.id
FROM public.stories s
WHERE cp.product_type = 'drawing'
  AND cp.story_id IS NULL
  AND s.slug = cp.slug;


-- ===== MIGRATION: 20260425110415_8b4ed1d6-5482-4ca6-a0de-af989fca1034.sql =====
-- Backfill: garantir que toda história tenha 30 páginas (1..30)
-- Usa o padrão de URL existente: /stories/{slug}/page-NN.jpg
-- Apenas insere páginas que faltam (não sobrescreve as existentes)

INSERT INTO public.stories_pages (story_id, page_number, title, image_lineart_url, image_preview_url, is_active)
SELECT
  s.id,
  n.page_number,
  'Página ' || n.page_number,
  '/stories/' || s.slug || '/page-' || LPAD(n.page_number::text, 2, '0') || '.jpg',
  '/stories/' || s.slug || '/page-' || LPAD(n.page_number::text, 2, '0') || '.jpg',
  true
FROM public.stories s
CROSS JOIN generate_series(1, 30) AS n(page_number)
WHERE s.slug IN ('o-nascimento-de-jesus', 'a-casa-na-rocha', 'o-semeador')
  AND NOT EXISTS (
    SELECT 1 FROM public.stories_pages p
    WHERE p.story_id = s.id AND p.page_number = n.page_number
  );

-- ===== MIGRATION: 20260425143429_ee300f32-6ad0-4582-8f4d-a79a4d55c034.sql =====
-- Phase 2: add per-area configuration fields
ALTER TABLE public.member_area_variations
  ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS date_format text NOT NULL DEFAULT 'DD/MM/YYYY',
  ADD COLUMN IF NOT EXISTS theme_mode text NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS muted_text_color text,
  ADD COLUMN IF NOT EXISTS support_email text,
  ADD COLUMN IF NOT EXISTS app_name text,
  ADD COLUMN IF NOT EXISTS logo_alt text,
  ADD COLUMN IF NOT EXISTS access_type text NOT NULL DEFAULT 'restricted_purchase',
  ADD COLUMN IF NOT EXISTS no_access_behavior text NOT NULL DEFAULT 'show_locked',
  ADD COLUMN IF NOT EXISTS sales_page_url text,
  ADD COLUMN IF NOT EXISTS microcopy_json jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Ensure only one primary per account
CREATE UNIQUE INDEX IF NOT EXISTS member_area_variations_one_primary_per_account
  ON public.member_area_variations (account_id)
  WHERE is_primary = true;

-- Trigger: when one area becomes primary, clear the others within the same account
CREATE OR REPLACE FUNCTION public.enforce_single_primary_member_area()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.is_primary = true THEN
    UPDATE public.member_area_variations
       SET is_primary = false
     WHERE account_id = NEW.account_id
       AND id <> NEW.id
       AND is_primary = true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_single_primary_member_area ON public.member_area_variations;
CREATE TRIGGER trg_enforce_single_primary_member_area
BEFORE INSERT OR UPDATE OF is_primary ON public.member_area_variations
FOR EACH ROW
WHEN (NEW.is_primary = true)
EXECUTE FUNCTION public.enforce_single_primary_member_area();

-- Mark "reino-das-cores-kids" (or first area) as primary if no primary exists yet
DO $$
DECLARE
  v_account_id uuid;
  v_first_id uuid;
  v_kids_id uuid;
BEGIN
  FOR v_account_id IN
    SELECT DISTINCT account_id FROM public.member_area_variations
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.member_area_variations
       WHERE account_id = v_account_id AND is_primary = true
    ) THEN
      SELECT id INTO v_kids_id
        FROM public.member_area_variations
       WHERE account_id = v_account_id AND slug = 'reino-das-cores-kids'
       LIMIT 1;

      IF v_kids_id IS NOT NULL THEN
        UPDATE public.member_area_variations
           SET is_primary = true
         WHERE id = v_kids_id;
      ELSE
        SELECT id INTO v_first_id
          FROM public.member_area_variations
         WHERE account_id = v_account_id
         ORDER BY order_index ASC, created_at ASC
         LIMIT 1;
        IF v_first_id IS NOT NULL THEN
          UPDATE public.member_area_variations
             SET is_primary = true
           WHERE id = v_first_id;
        END IF;
      END IF;
    END IF;
  END LOOP;
END $$;

-- ===== MIGRATION: 20260425145655_4101b478-8976-4b87-b366-ae54d58292c5.sql =====
-- Add 'subscription_active' duration support: when set, access lifetime
-- mirrors the subscription state and is revoked on cancel/refund/chargeback.
-- We don't add a CHECK because the column is currently a free text column.
COMMENT ON COLUMN public.commercial_offer_products.access_duration_type IS
  'lifetime | days | custom | subscription_active. When subscription_active, expires_at follows subscriptions.current_period_end and is revoked when subscription becomes inactive.';

-- Index that helps the webhook revoke entitlements tied to a subscription quickly.
CREATE INDEX IF NOT EXISTS idx_user_product_entitlements_user_status
  ON public.user_product_entitlements (user_id, status);

CREATE INDEX IF NOT EXISTS idx_subscriptions_external_subscription_id
  ON public.subscriptions (external_subscription_id);

-- ===== MIGRATION: 20260425145815_056f5557-e214-4b8f-9ee5-cf9018af9e82.sql =====
CREATE TABLE IF NOT EXISTS public.email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text NOT NULL DEFAULT 'access_granted',
  recipient_email text NOT NULL,
  recipient_name text,
  subject text NOT NULL,
  body_html text NOT NULL,
  body_text text,
  status text NOT NULL DEFAULT 'pending',
  reason text,
  user_id uuid,
  offer_id uuid,
  variation_id uuid,
  external_order_id text,
  product_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  area_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_outbox_status_created
  ON public.email_outbox (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_outbox_recipient
  ON public.email_outbox (recipient_email);

ALTER TABLE public.email_outbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage email outbox"
  ON public.email_outbox
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_email_outbox_updated_at ON public.email_outbox;
CREATE TRIGGER trg_email_outbox_updated_at
  BEFORE UPDATE ON public.email_outbox
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ===== MIGRATION: 20260425221715_d11010cf-ecda-4ad7-8e36-4884b0e1dc58.sql =====
ALTER TABLE public.course_lessons
  ADD COLUMN IF NOT EXISTS youtube_settings jsonb NOT NULL DEFAULT jsonb_build_object(
    'whiteLabelMode', true,
    'showControls', true,
    'hideRelated', true,
    'hideAnnotations', true,
    'disableKeyboard', true,
    'customPlayButton', true,
    'hideInitialBottomBar', true
  );

-- ===== MIGRATION: 20260425230122_905b6ed2-c12e-481b-8725-78efee9f087b.sql =====
-- 1) Adicionar valor 'super_admin' ao enum app_role (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'super_admin'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'super_admin';
  END IF;
END$$;


-- ===== MIGRATION: 20260425230231_7abf6f38-b682-4442-8f5e-1083eb069589.sql =====
-- 2) Função auxiliar: is_super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'super_admin'::public.app_role
  );
$$;

-- 3) Tabela de configurações protegidas
CREATE TABLE IF NOT EXISTS public.protected_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value text,
  is_protected boolean NOT NULL DEFAULT true,
  editable_by_role text NOT NULL DEFAULT 'super_admin',
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.protected_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view protected settings" ON public.protected_settings;
CREATE POLICY "Anyone can view protected settings"
  ON public.protected_settings
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Super admins manage protected settings" ON public.protected_settings;
CREATE POLICY "Super admins manage protected settings"
  ON public.protected_settings
  FOR ALL
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

DROP TRIGGER IF EXISTS trg_protected_settings_updated_at ON public.protected_settings;
CREATE TRIGGER trg_protected_settings_updated_at
  BEFORE UPDATE ON public.protected_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Tabela de auditoria de segurança
CREATE TABLE IF NOT EXISTS public.security_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  user_email text,
  action text NOT NULL,
  resource text,
  status text NOT NULL DEFAULT 'blocked',
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.security_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins view audit logs" ON public.security_audit_logs;
CREATE POLICY "Super admins view audit logs"
  ON public.security_audit_logs
  FOR SELECT
  USING (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated can insert audit logs" ON public.security_audit_logs;
CREATE POLICY "Authenticated can insert audit logs"
  ON public.security_audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_security_audit_logs_user_id ON public.security_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_created_at ON public.security_audit_logs(created_at DESC);

-- 5) Conceder super_admin ao e-mail autorizado, se já existir
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'super_admin'::public.app_role
FROM auth.users u
WHERE lower(u.email) = lower('ericvinicius1@hotmail.com')
ON CONFLICT (user_id, role) DO NOTHING;

-- 6) Sementes de configurações institucionais protegidas
INSERT INTO public.protected_settings (key, value, description) VALUES
  ('sidebar_footer_enabled', 'true', 'Exibe rodapé institucional no menu lateral'),
  ('sidebar_footer_text', 'Feito com amor em Salvador', 'Texto principal do rodapé do menu'),
  ('sidebar_footer_copyright', '© comunidade InfoApps', 'Linha de copyright'),
  ('community_url', 'https://www.comunidadeinfoapps.com.br', 'Site oficial da comunidade'),
  ('community_label', 'www.comunidadeinfoapps.com.br', 'Texto exibido para o link da comunidade'),
  ('perfectpay_referral_url', 'https://app.perfectpay.com.br/refer/REFPPU15CH55ZP', 'Link de afiliado para a Perfect Pay'),
  ('tool_url_replic', 'https://replic.com.br', 'URL oficial Replic'),
  ('tool_url_funnelx', 'https://funnelx.com.br/', 'URL oficial FunnelX'),
  ('tool_url_hostvsl', 'https://www.hostvsl.com.br', 'URL oficial Host VSL'),
  ('tool_url_adsniper', 'https://www.adsniper.com.br/', 'URL oficial AdSniper')
ON CONFLICT (key) DO NOTHING;

-- 7) Garantir trigger handle_seed_admin que conceda super_admin (já existe outro para admin via app_settings_kv).
--    Aqui adicionamos um trigger leve para sempre que o usuário ericvinicius1@hotmail.com for criado, vire super_admin.
CREATE OR REPLACE FUNCTION public.handle_seed_super_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF lower(NEW.email) = lower('ericvinicius1@hotmail.com') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'super_admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_seed_super_admin ON auth.users;
CREATE TRIGGER on_auth_user_created_seed_super_admin
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_seed_super_admin();


-- ===== MIGRATION: 20260425230328_b5be3025-9223-456e-9e95-dd6550c29171.sql =====
DROP POLICY IF EXISTS "Authenticated can insert audit logs" ON public.security_audit_logs;
CREATE POLICY "Authenticated can insert own audit logs"
  ON public.security_audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());


-- ===== MIGRATION: 20260425231410_955da3cd-2df3-4a6a-99c5-99b071d4b70a.sql =====
UPDATE public.protected_settings
   SET value = ''
 WHERE key IN (
   'sidebar_footer_enabled',
   'sidebar_footer_text',
   'sidebar_footer_copyright',
   'community_url',
   'community_label'
 );

-- ===== MIGRATION: 20260426014644_ab860cc9-942f-4b12-9628-18c102a96814.sql =====
-- ============================================================
-- 1) Coluna ebook_mode em catalog_products
-- ============================================================
ALTER TABLE public.catalog_products
  ADD COLUMN IF NOT EXISTS ebook_mode text;

-- Permite drawing/course/ebook/download
ALTER TABLE public.catalog_products
  DROP CONSTRAINT IF EXISTS catalog_products_product_type_check;
ALTER TABLE public.catalog_products
  ADD CONSTRAINT catalog_products_product_type_check
  CHECK (product_type IN ('drawing','course','ebook','download'));

-- ebook_mode só aceita single_pdf | modules quando preenchido
ALTER TABLE public.catalog_products
  DROP CONSTRAINT IF EXISTS catalog_products_ebook_mode_check;
ALTER TABLE public.catalog_products
  ADD CONSTRAINT catalog_products_ebook_mode_check
  CHECK (ebook_mode IS NULL OR ebook_mode IN ('single_pdf','modules'));

-- ============================================================
-- 2) ebook_modules
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ebook_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.catalog_products(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'published',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ebook_modules_status_check CHECK (status IN ('draft','published'))
);
CREATE INDEX IF NOT EXISTS ebook_modules_product_idx
  ON public.ebook_modules(product_id, sort_order);

ALTER TABLE public.ebook_modules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage ebook modules" ON public.ebook_modules;
CREATE POLICY "Admins manage ebook modules"
  ON public.ebook_modules
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Users view accessible ebook modules" ON public.ebook_modules;
CREATE POLICY "Users view accessible ebook modules"
  ON public.ebook_modules
  FOR SELECT
  USING (
    status = 'published'
    AND public.user_has_product_access(auth.uid(), product_id)
  );

CREATE TRIGGER ebook_modules_set_updated_at
  BEFORE UPDATE ON public.ebook_modules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 3) ebook_files
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ebook_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.catalog_products(id) ON DELETE CASCADE,
  module_id uuid REFERENCES public.ebook_modules(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  file_path text NOT NULL,           -- path within the private bucket
  file_name text,
  file_size bigint,
  total_pages integer,
  allow_download boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'published',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ebook_files_status_check CHECK (status IN ('draft','published'))
);
CREATE INDEX IF NOT EXISTS ebook_files_product_idx
  ON public.ebook_files(product_id, sort_order);
CREATE INDEX IF NOT EXISTS ebook_files_module_idx
  ON public.ebook_files(module_id, sort_order);

ALTER TABLE public.ebook_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage ebook files" ON public.ebook_files;
CREATE POLICY "Admins manage ebook files"
  ON public.ebook_files
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Users view accessible ebook files" ON public.ebook_files;
CREATE POLICY "Users view accessible ebook files"
  ON public.ebook_files
  FOR SELECT
  USING (
    status = 'published'
    AND public.user_has_product_access(auth.uid(), product_id)
  );

CREATE TRIGGER ebook_files_set_updated_at
  BEFORE UPDATE ON public.ebook_files
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 4) ebook_progress
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ebook_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.catalog_products(id) ON DELETE CASCADE,
  ebook_file_id uuid NOT NULL REFERENCES public.ebook_files(id) ON DELETE CASCADE,
  last_page integer NOT NULL DEFAULT 1,
  total_pages integer,
  progress_percentage integer NOT NULL DEFAULT 0,
  last_opened_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, ebook_file_id)
);
CREATE INDEX IF NOT EXISTS ebook_progress_user_product_idx
  ON public.ebook_progress(user_id, product_id, last_opened_at DESC);

ALTER TABLE public.ebook_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own ebook progress" ON public.ebook_progress;
CREATE POLICY "Users view own ebook progress"
  ON public.ebook_progress
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own ebook progress" ON public.ebook_progress;
CREATE POLICY "Users insert own ebook progress"
  ON public.ebook_progress
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own ebook progress" ON public.ebook_progress;
CREATE POLICY "Users update own ebook progress"
  ON public.ebook_progress
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins view all ebook progress" ON public.ebook_progress;
CREATE POLICY "Admins view all ebook progress"
  ON public.ebook_progress
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER ebook_progress_set_updated_at
  BEFORE UPDATE ON public.ebook_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 5) Bucket privado para PDFs
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('ebook-files', 'ebook-files', false)
ON CONFLICT (id) DO NOTHING;

-- Admin pode tudo
DROP POLICY IF EXISTS "Admins manage ebook-files objects" ON storage.objects;
CREATE POLICY "Admins manage ebook-files objects"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (
    bucket_id = 'ebook-files'
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  )
  WITH CHECK (
    bucket_id = 'ebook-files'
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- Alunos com acesso ao produto podem LER o objeto correspondente.
-- O front nunca expõe o file_path direto: o leitor recebe uma URL assinada
-- gerada via service role no servidor. Mesmo assim, esta policy garante
-- que se algum cliente autenticado tentar baixar um path de um produto que
-- não tem entitlement, o storage retorna 403.
DROP POLICY IF EXISTS "Users read entitled ebook-files objects" ON storage.objects;
CREATE POLICY "Users read entitled ebook-files objects"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'ebook-files'
    AND EXISTS (
      SELECT 1
      FROM public.ebook_files ef
      WHERE ef.file_path = storage.objects.name
        AND ef.status = 'published'
        AND public.user_has_product_access(auth.uid(), ef.product_id)
    )
  );

-- ===== MIGRATION: 20260426131242_ba8c2fa6-ee2c-4054-86ca-d4df3e335882.sql =====
DROP TRIGGER IF EXISTS enforce_variation_limit_before_insert ON public.member_area_variations;
DROP FUNCTION IF EXISTS public.enforce_member_area_variation_limit() CASCADE;
