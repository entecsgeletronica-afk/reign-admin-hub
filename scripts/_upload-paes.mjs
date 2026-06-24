import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';

const url = process.env.SUPABASE_URL;
const key = process.env.STORY_SYNC_SERVICE_KEY;
if (!url || !key) { console.error('Missing env'); process.exit(1); }

const sb = createClient(url, key, { auth: { persistSession: false } });
const SLUG = 'a-multiplicacao-dos-paes';
const BUCKET = 'story-pages-lineart';

const { data: story, error: sErr } = await sb.from('stories').select('id, slug').eq('slug', SLUG).maybeSingle();
if (sErr || !story) { console.error('story not found', sErr); process.exit(1); }
console.log('story', story.id);

let uploaded = 0, inserted = 0, updated = 0, errors = [];
for (let i = 1; i <= 30; i++) {
  const num = String(i).padStart(2, '0');
  const fname = `page-${num}.png`;
  const localPath = `/tmp/paes/${fname}`;
  let bytes;
  try { bytes = await readFile(localPath); } catch (e) { errors.push(`read ${fname}: ${e.message}`); continue; }
  const remote = `${SLUG}/${fname}`;
  const { error: upErr } = await sb.storage.from(BUCKET).upload(remote, bytes, {
    contentType: 'image/png', upsert: true,
  });
  if (upErr) { errors.push(`upload ${fname}: ${upErr.message}`); continue; }
  uploaded++;
  const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(remote);
  const publicUrl = pub.publicUrl;

  const { data: existing } = await sb.from('stories_pages').select('id').eq('story_id', story.id).eq('page_number', i).maybeSingle();
  if (existing) {
    const { error } = await sb.from('stories_pages').update({ image_lineart_url: publicUrl, is_active: true }).eq('id', existing.id);
    if (error) errors.push(`update ${fname}: ${error.message}`); else updated++;
  } else {
    const { error } = await sb.from('stories_pages').insert({
      story_id: story.id, page_number: i, title: `Página ${i}`,
      image_lineart_url: publicUrl, is_active: true,
    });
    if (error) errors.push(`insert ${fname}: ${error.message}`); else inserted++;
  }
}
console.log(JSON.stringify({ uploaded, inserted, updated, errors }, null, 2));
