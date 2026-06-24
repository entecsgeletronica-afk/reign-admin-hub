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