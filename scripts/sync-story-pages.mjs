#!/usr/bin/env node
/**
 * Sincroniza imagens de páginas das histórias com o Supabase.
 *
 * Uso:
 *   node scripts/sync-story-pages.mjs                  # sincroniza TODAS as histórias em public/lineart/
 *   node scripts/sync-story-pages.mjs slug-da-historia # sincroniza apenas uma história
 *   node scripts/sync-story-pages.mjs slug1 slug2 ...  # sincroniza várias específicas
 *
 * Como funciona:
 *   1. Lê pastas dentro de public/lineart/
 *   2. Para cada arquivo page-XX.png, faz upload (upsert) para o bucket
 *      story-pages-lineart no caminho <slug>/page-XX.png
 *   3. Cria/atualiza a linha em stories_pages com a URL pública
 *
 * Variáveis de ambiente necessárias (já configuradas no projeto):
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { join } from "path";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.STORY_SYNC_SERVICE_KEY;
const BUCKET = "story-pages-lineart";
const ROOT_DIR = "public/lineart";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

const argSlugs = process.argv.slice(2);

function listSlugDirs() {
  if (!existsSync(ROOT_DIR)) {
    console.error(`❌ Pasta ${ROOT_DIR} não encontrada.`);
    process.exit(1);
  }
  return readdirSync(ROOT_DIR).filter((name) => {
    const full = join(ROOT_DIR, name);
    return statSync(full).isDirectory();
  });
}

function listPageFiles(dir) {
  return readdirSync(dir)
    .filter((f) => /^page-\d{2,}\.(png|jpg|jpeg|webp)$/i.test(f))
    .sort();
}

function pageNumberFromFile(filename) {
  const match = filename.match(/^page-(\d+)\./i);
  return match ? parseInt(match[1], 10) : null;
}

function contentTypeFor(filename) {
  const ext = filename.split(".").pop().toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}

async function findStory(slug) {
  const { data, error } = await sb
    .from("stories")
    .select("id, slug, title")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function syncStory(slug) {
  const dir = join(ROOT_DIR, slug);
  if (!existsSync(dir)) {
    console.warn(`⚠️  ${slug}: pasta ${dir} não existe — pulando.`);
    return { uploaded: 0, skipped: 0, errors: 0 };
  }

  const story = await findStory(slug);
  if (!story) {
    console.warn(`⚠️  ${slug}: história não encontrada na tabela "stories" — pulando.`);
    return { uploaded: 0, skipped: 0, errors: 0 };
  }

  const files = listPageFiles(dir);
  if (files.length === 0) {
    console.warn(`⚠️  ${slug}: nenhum arquivo page-XX encontrado.`);
    return { uploaded: 0, skipped: 0, errors: 0 };
  }

  console.log(`\n📚 ${slug} (${story.title}) — ${files.length} arquivo(s)`);

  let uploaded = 0;
  let errors = 0;

  for (const file of files) {
    const pageNum = pageNumberFromFile(file);
    if (pageNum == null) continue;

    const localPath = join(dir, file);
    const remotePath = `${slug}/${file}`;
    const bytes = readFileSync(localPath);

    const { error: upErr } = await sb.storage
      .from(BUCKET)
      .upload(remotePath, bytes, {
        contentType: contentTypeFor(file),
        upsert: true,
      });

    if (upErr) {
      console.error(`  ❌ upload ${file}: ${upErr.message}`);
      errors++;
      continue;
    }

    const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(remotePath);
    const publicUrl = pub.publicUrl;

    const { data: existing, error: selErr } = await sb
      .from("stories_pages")
      .select("id")
      .eq("story_id", story.id)
      .eq("page_number", pageNum)
      .maybeSingle();

    if (selErr) {
      console.error(`  ❌ select ${file}: ${selErr.message}`);
      errors++;
      continue;
    }

    if (existing) {
      const { error: updErr } = await sb
        .from("stories_pages")
        .update({
          image_lineart_url: publicUrl,
          is_active: true,
        })
        .eq("id", existing.id);
      if (updErr) {
        console.error(`  ❌ update ${file}: ${updErr.message}`);
        errors++;
        continue;
      }
      console.log(`  🔄 page ${String(pageNum).padStart(2, "0")} atualizada`);
    } else {
      const { error: insErr } = await sb.from("stories_pages").insert({
        story_id: story.id,
        page_number: pageNum,
        title: `Página ${pageNum}`,
        image_lineart_url: publicUrl,
        is_active: true,
      });
      if (insErr) {
        console.error(`  ❌ insert ${file}: ${insErr.message}`);
        errors++;
        continue;
      }
      console.log(`  ➕ page ${String(pageNum).padStart(2, "0")} inserida`);
    }
    uploaded++;
  }

  return { uploaded, skipped: 0, errors };
}

async function main() {
  const slugs = argSlugs.length > 0 ? argSlugs : listSlugDirs();
  console.log(`🚀 Sincronizando ${slugs.length} história(s): ${slugs.join(", ")}`);

  const totals = { uploaded: 0, errors: 0 };
  for (const slug of slugs) {
    const r = await syncStory(slug);
    totals.uploaded += r.uploaded;
    totals.errors += r.errors;
  }

  console.log(`\n✅ Concluído: ${totals.uploaded} página(s) sincronizada(s), ${totals.errors} erro(s).`);
  if (totals.errors > 0) process.exit(1);
}

main().catch((err) => {
  console.error("❌ Erro fatal:", err);
  process.exit(1);
});
