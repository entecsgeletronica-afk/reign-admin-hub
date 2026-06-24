import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) { console.error("missing env"); process.exit(1); }

const sb = createClient(url, serviceKey, { auth: { persistSession: false } });
const STORY_ID = "c0d683b5-e7c4-4f7e-9e9c-ec068c064715";
const STORY_SLUG = "noe-e-a-arca";
const BUCKET = "story-pages-lineart";

const results = [];
for (let i = 1; i <= 10; i++) {
  const num = String(i).padStart(2, "0");
  const local = `/tmp/arca/page-${num}.png`;
  const remote = `${STORY_SLUG}/page-${num}.png`;
  const bytes = readFileSync(local);

  const { error: upErr } = await sb.storage
    .from(BUCKET)
    .upload(remote, bytes, { contentType: "image/png", upsert: true });
  if (upErr) { console.error("upload fail", num, upErr.message); process.exit(1); }

  const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(remote);
  const publicUrl = pub.publicUrl;

  // Upsert row in stories_pages by (story_id, page_number)
  const { data: existing } = await sb
    .from("stories_pages")
    .select("id")
    .eq("story_id", STORY_ID)
    .eq("page_number", i)
    .maybeSingle();

  if (existing) {
    const { error: updErr } = await sb
      .from("stories_pages")
      .update({
        image_lineart_url: publicUrl,
        title: `Página ${i}`,
        is_active: true,
      })
      .eq("id", existing.id);
    if (updErr) { console.error("update fail", num, updErr.message); process.exit(1); }
    results.push({ page: i, action: "updated", url: publicUrl });
  } else {
    const { error: insErr } = await sb.from("stories_pages").insert({
      story_id: STORY_ID,
      page_number: i,
      title: `Página ${i}`,
      image_lineart_url: publicUrl,
      is_active: true,
    });
    if (insErr) { console.error("insert fail", num, insErr.message); process.exit(1); }
    results.push({ page: i, action: "inserted", url: publicUrl });
  }
}

console.log(JSON.stringify(results, null, 2));
