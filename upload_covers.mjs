import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const mapping = [
  { file: 'nascimento-jesus.png',     slug: 'o-nascimento-de-jesus' },
  { file: 'jesus-criancas.png',       slug: 'jesus-e-as-criancas' },
  { file: 'multiplicacao-paes.png',   slug: 'a-multiplicacao-dos-paes' },
  { file: 'bom-samaritano.png',       slug: 'o-bom-samaritano' },
  { file: 'jesus-tempestade.png',     slug: 'jesus-acalma-a-tempestade' },
  { file: 'arca-de-noe.png',          slug: 'arca-de-noe' },
  { file: 'davi-e-golias.png',        slug: 'davi-e-golias' },
  { file: 'jonas-baleia.png',         slug: 'jonas-e-a-baleia' },
  { file: 'moises-mar-vermelho.png',  slug: 'moises-e-o-mar-vermelho' },
  { file: 'daniel-leoes.png',         slug: 'daniel-na-cova-dos-leoes' },
  { file: 'criacao-do-mundo.png',     slug: 'a-criacao-do-mundo' },
  { file: 'ester-rainha.png',         slug: 'ester-rainha-corajosa' },
];

for (const { file, slug } of mapping) {
  const localPath = path.join('/dev-server/public/catalog', file);
  const buf = fs.readFileSync(localPath);
  const storagePath = `products/${file}`;
  const { error: upErr } = await supabase.storage
    .from('catalog-covers')
    .upload(storagePath, buf, { contentType: 'image/png', upsert: true, cacheControl: '3600' });
  if (upErr) { console.error('upload', file, upErr); continue; }
  const { data: pub } = supabase.storage.from('catalog-covers').getPublicUrl(storagePath);
  const url = pub.publicUrl;
  const { error: updErr } = await supabase
    .from('catalog_products')
    .update({ cover_image_url: url })
    .eq('slug', slug);
  if (updErr) { console.error('update', slug, updErr); continue; }
  console.log('OK', slug, '->', url);
}
