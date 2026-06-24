
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
