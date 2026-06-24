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
