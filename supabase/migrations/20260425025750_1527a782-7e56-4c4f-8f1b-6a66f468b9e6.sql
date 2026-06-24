-- Remove orphan catalog products that have no section_id
DELETE FROM public.catalog_products
WHERE section_id IS NULL;