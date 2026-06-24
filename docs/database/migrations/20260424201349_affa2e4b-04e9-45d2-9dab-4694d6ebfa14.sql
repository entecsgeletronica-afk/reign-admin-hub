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