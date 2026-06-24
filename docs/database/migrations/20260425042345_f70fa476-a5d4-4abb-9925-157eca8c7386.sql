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
