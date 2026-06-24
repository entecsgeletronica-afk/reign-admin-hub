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