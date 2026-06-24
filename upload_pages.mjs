import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) { console.error("missing env"); process.exit(1); }

const sb = createClient(url, serviceKey, { auth: { persistSession: false } });
const BUCKET = "story-pages-lineart";

const STORIES = [
  { id: "fa812d78-9b27-44f7-8ce0-f1a645f681ee", slug: "a-criacao-do-mundo", dir: "public/lineart/a-criacao-do-mundo" },
  { id: "ddc1d944-2ceb-401a-b1e0-a3519e0fc1e7", slug: "ester-rainha-corajosa", dir: "public/lineart/ester-rainha-corajosa" },
];

for (const story of STORIES) {
  console.log(`\n=== ${story.slug} ===`);
  for (let i = 1; i <= 30; i++) {
    const num = String(i).padStart(2, "0");
    const local = `${story.dir}/page-${num}.png`;
    const remote = `${story.slug}/page-${num}.png`;
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
      .eq("story_id", story.id)
      .eq("page_number", i)
      .maybeSingle();

    if (existing) {
      const { error: updErr } = await sb
        .from("stories_pages")
        .update({ image_lineart_url: publicUrl, title: `Página ${i}`, is_active: true })
        .eq("id", existing.id);
      if (updErr) { console.error("update fail", num, updErr.message); process.exit(1); }
      console.log(`  page ${num} updated`);
    } else {
      const { error: insErr } = await sb.from("stories_pages").insert({
        story_id: story.id,
        page_number: i,
        title: `Página ${i}`,
        image_lineart_url: publicUrl,
        is_active: true,
      });
      if (insErr) { console.error("insert fail", num, insErr.message); process.exit(1); }
      console.log(`  page ${num} inserted`);
    }
  }
}
console.log("\ndone");
