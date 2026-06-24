// Admin service for the Mini App de Desenhos.
// Manages the story (which holds the page artwork) attached to a
// "drawing" catalog product, plus page CRUD and bulk image uploads.

import { supabase } from "@/integrations/supabase/client";
import { slugify } from "@/services/catalog-db";

/* ---------------- Types ---------------- */

export interface DrawingStoryRow {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  cover_image_url: string | null;
  thumbnail_url: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface DrawingPageRow {
  id: string;
  story_id: string;
  page_number: number;
  title: string | null;
  image_lineart_url: string | null;
  image_preview_url: string | null;
  image_colored_sample_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/* ---------------- Story (container of pages) ---------------- */

export async function getStoryById(id: string): Promise<DrawingStoryRow | null> {
  const { data, error } = await supabase
    .from("stories" as never)
    .select(
      "id, slug, title, subtitle, description, cover_image_url, thumbnail_url, is_active, sort_order",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as DrawingStoryRow) ?? null;
}

export async function ensureStoryForProduct(args: {
  productId: string;
  title: string;
  baseSlug: string;
  description?: string | null;
  coverUrl?: string | null;
  existingStoryId?: string | null;
}): Promise<DrawingStoryRow> {
  // 1) If product already references a story, reuse it.
  if (args.existingStoryId) {
    const existing = await getStoryById(args.existingStoryId);
    if (existing) return existing;
  }

  // 2) Try to reuse an existing story whose slug matches the product slug.
  //    This avoids creating duplicated "mini-*" stories when one already
  //    exists with the canonical slug (e.g. populated by the seed scripts).
  const baseSlug = slugify(args.baseSlug || args.title);
  if (baseSlug) {
    const { data: matched } = await supabase
      .from("stories" as never)
      .select(
        "id, slug, title, subtitle, description, cover_image_url, thumbnail_url, is_active, sort_order",
      )
      .eq("slug", baseSlug)
      .maybeSingle();
    if (matched) {
      const story = matched as unknown as DrawingStoryRow;
      // Link the product to this canonical story
      await supabase
        .from("catalog_products" as never)
        .update({ story_id: story.id } as never)
        .eq("id", args.productId);
      return story;
    }
  }

  // 3) Otherwise create a fresh story for this product.
  const slug = `mini-${baseSlug || "story"}-${args.productId.slice(0, 6)}`;
  const insertPayload = {
    slug,
    title: args.title,
    description: args.description ?? null,
    cover_image_url: args.coverUrl ?? null,
    thumbnail_url: args.coverUrl ?? null,
    is_active: true,
    sort_order: 0,
  };

  const { data, error } = await supabase
    .from("stories" as never)
    .insert(insertPayload as never)
    .select("id, slug, title, subtitle, description, cover_image_url, thumbnail_url, is_active, sort_order")
    .single();
  if (error) throw error;

  const story = data as unknown as DrawingStoryRow;

  // Link the product to this story
  await supabase
    .from("catalog_products" as never)
    .update({ story_id: story.id } as never)
    .eq("id", args.productId);

  return story;
}

export async function updateStory(
  id: string,
  patch: Partial<DrawingStoryRow>,
): Promise<void> {
  const next: Record<string, unknown> = { ...patch };
  delete next.id;
  const { error } = await supabase
    .from("stories" as never)
    .update(next as never)
    .eq("id", id);
  if (error) throw error;
}

/* ---------------- Pages ---------------- */

export async function listPages(storyId: string): Promise<DrawingPageRow[]> {
  const { data, error } = await supabase
    .from("stories_pages" as never)
    .select("*")
    .eq("story_id", storyId)
    .order("page_number", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as DrawingPageRow[];
}

export async function createPage(input: {
  storyId: string;
  pageNumber: number;
  title?: string | null;
  imageLineartUrl?: string | null;
  imagePreviewUrl?: string | null;
}): Promise<DrawingPageRow> {
  const payload = {
    story_id: input.storyId,
    page_number: input.pageNumber,
    title: input.title ?? null,
    image_lineart_url: input.imageLineartUrl ?? null,
    image_preview_url: input.imagePreviewUrl ?? input.imageLineartUrl ?? null,
    is_active: true,
  };
  const { data, error } = await supabase
    .from("stories_pages" as never)
    .insert(payload as never)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as DrawingPageRow;
}

export async function updatePage(
  id: string,
  patch: Partial<DrawingPageRow>,
): Promise<void> {
  const next: Record<string, unknown> = { ...patch };
  delete next.id;
  delete next.created_at;
  delete next.updated_at;
  const { error } = await supabase
    .from("stories_pages" as never)
    .update(next as never)
    .eq("id", id);
  if (error) throw error;
}

export async function deletePage(id: string): Promise<void> {
  const { error } = await supabase
    .from("stories_pages" as never)
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function reorderPages(
  updates: { id: string; page_number: number }[],
): Promise<void> {
  await Promise.all(
    updates.map((u) =>
      supabase
        .from("stories_pages" as never)
        .update({ page_number: u.page_number } as never)
        .eq("id", u.id),
    ),
  );
}

/* ---------------- Storage uploads ---------------- */

function makePath(storyId: string, file: File): string {
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `${storyId}/${ts}-${rand}.${ext}`;
}

export async function uploadPageLineart(storyId: string, file: File): Promise<string> {
  const path = makePath(storyId, file);
  const { error } = await supabase.storage
    .from("story-pages-lineart")
    .upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) throw error;
  return supabase.storage.from("story-pages-lineart").getPublicUrl(path).data.publicUrl;
}

export async function uploadPagePreview(storyId: string, file: File): Promise<string> {
  const path = makePath(storyId, file);
  const { error } = await supabase.storage
    .from("story-pages-preview")
    .upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) throw error;
  return supabase.storage.from("story-pages-preview").getPublicUrl(path).data.publicUrl;
}

/**
 * Bulk upload: one file = one new page.
 * Files are sorted by name, then uploaded as line-art.
 * The same image is reused as preview (admin can refine later).
 */
export async function bulkUploadPages(args: {
  storyId: string;
  files: File[];
  startingPageNumber?: number;
  onProgress?: (done: number, total: number) => void;
}): Promise<DrawingPageRow[]> {
  const sorted = [...args.files].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }),
  );
  const created: DrawingPageRow[] = [];
  const start = args.startingPageNumber ?? 1;

  for (let i = 0; i < sorted.length; i++) {
    const file = sorted[i];
    const url = await uploadPageLineart(args.storyId, file);
    const page = await createPage({
      storyId: args.storyId,
      pageNumber: start + i,
      title: file.name.replace(/\.[^.]+$/, ""),
      imageLineartUrl: url,
      imagePreviewUrl: url,
    });
    created.push(page);
    args.onProgress?.(i + 1, sorted.length);
  }

  return created;
}
