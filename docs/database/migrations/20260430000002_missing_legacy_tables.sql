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
