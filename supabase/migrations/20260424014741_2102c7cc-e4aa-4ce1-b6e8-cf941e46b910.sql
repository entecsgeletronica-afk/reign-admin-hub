UPDATE public.catalog_products
SET cover_image_url = NULL
WHERE cover_image_url LIKE '/catalog/%';