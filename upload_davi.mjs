import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) { console.error("missing env"); process.exit(1); }

const sb = createClient(url, serviceKey, { auth: { persistSession: false } });
const STORY_ID = "37a457ce-609b-4c22-abe8-0dae1f47eaa5";
const STORY_SLUG = "davi-e-golias";
const BUCKET = "story-pages-lineart";

const START = parseInt(process.env.START || "1", 10);
const END = parseInt(process.env.END || "10", 10);
const SRC_DIR = process.env.SRC_DIR || "/tmp/davi";

const results = [];
for (let i = START; i <= END; i++) {
  const num = String(i).padStart(2, "0");
  const local = `${SRC_DIR}/page-${num}.png`;
  const remote = `${STORY_SLUG}/page-${num}.png`;
  const bytes = readFileSync(local);

  const { error: upErr } = await sb.storage
    .from(BUCKET)
    .upload(remote, bytes, { contentType: "image/png", upsert: true });
  if (upErr) { console.error("upload fail", num, upErr.message); process.exit(1); }

  const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(remote);
  const publicUrl = pub.publicUrl;

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
