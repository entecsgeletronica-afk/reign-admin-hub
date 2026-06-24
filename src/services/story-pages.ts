// Fetches the pages of a story by slug, plus per-user completion status.
// Used by the product detail page (/produto/$slug) to render the scene grid.

import { supabase } from "@/integrations/supabase/client";

export interface StoryPageRow {
  id: string;
  page_number: number;
  title: string | null;
  image_lineart_url: string | null;
  image_preview_url: string | null;
  image_colored_sample_url: string | null;
  is_active: boolean;
}

export interface StoryWithPages {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  short_description: string | null;
  age_range: string | null;
  age_min: number | null;
  age_max: number | null;
  cover_image_url: string | null;
  thumbnail_url: string | null;
  pages: StoryPageRow[];
}

interface RawStoryRow {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  short_description: string | null;
  age_range: string | null;
  age_min: number | null;
  age_max: number | null;
  cover_image_url: string | null;
  thumbnail_url: string | null;
  stories_pages: StoryPageRow[] | null;
}

const STORY_SELECT = `id, slug, title, subtitle, description, short_description,
   age_range, age_min, age_max, cover_image_url, thumbnail_url,
   stories_pages ( id, page_number, title, image_lineart_url,
                   image_preview_url, image_colored_sample_url, is_active )`;

function mapStoryRow(row: RawStoryRow): StoryWithPages {
  const pages = (row.stories_pages ?? [])
    .filter((p) => p.is_active)
    .sort((a, b) => a.page_number - b.page_number);
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    description: row.description,
    short_description: row.short_description,
    age_range: row.age_range,
    age_min: row.age_min,
    age_max: row.age_max,
    cover_image_url: row.cover_image_url,
    thumbnail_url: row.thumbnail_url,
    pages,
  };
}

/**
 * Loads a story for a given catalog product slug.
 *
 * Resolution order (this is the global fix that prevents "página não cadastrada"
 * from showing when the catalog product slug differs from the story slug — which
 * is the normal case, since the wizard auto-generates a unique story slug like
 * `mini-<slug>-<hash>` while the product keeps the user-friendly slug):
 *  1. Find catalog_products by slug → follow story_id to the stories row.
 *  2. Fallback: try matching stories.slug = slug (legacy / standalone stories).
 */
export async function getStoryBySlug(
  slug: string,
): Promise<StoryWithPages | null> {
  // Step 1 — resolve via catalog product → story_id
  const { data: product } = await supabase
    .from("catalog_products" as never)
    .select("story_id")
    .eq("slug", slug)
    .maybeSingle();

  const storyId = (product as { story_id: string | null } | null)?.story_id ?? null;

  if (storyId) {
    const { data, error } = await supabase
      .from("stories" as never)
      .select(STORY_SELECT)
      .eq("id", storyId)
      .maybeSingle();
    if (!error && data) return mapStoryRow(data as unknown as RawStoryRow);
  }

  // Step 2 — fallback to direct slug match on stories table
  const { data, error } = await supabase
    .from("stories" as never)
    .select(STORY_SELECT)
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) return null;
  return mapStoryRow(data as unknown as RawStoryRow);
}

export interface UserPageStatus {
  pageNumber: number;
  status: "completed" | "in_progress" | "not_started";
}

/** Returns per-page status for the given user/story slug. */
export async function getUserStoryPageStatus(
  userId: string,
  storySlug: string,
): Promise<Map<number, UserPageStatus["status"]>> {
  const { data, error } = await supabase
    .from("user_page_progress" as never)
    .select("page_index, status, completed_at")
    .eq("user_id", userId)
    .eq("story_slug", storySlug);

  const out = new Map<number, UserPageStatus["status"]>();
  if (error || !data) return out;

  type Row = { page_index: number; status: string; completed_at: string | null };
  for (const r of data as unknown as Row[]) {
    const done = r.status === "completed" || !!r.completed_at;
    out.set(r.page_index, done ? "completed" : "in_progress");
  }
  return out;
}
