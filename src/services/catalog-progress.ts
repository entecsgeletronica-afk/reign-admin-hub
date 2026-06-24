// Calcula progresso de coloração por produto/história.
// Convenção atual: catalog_products.slug == stories.slug. Total de páginas vem
// de stories_pages.is_active. Páginas concluídas vêm de user_page_progress
// com status = 'completed' (ou completed_at não nulo) por story_slug.

import { supabase } from "@/integrations/supabase/client";

export interface ProductProgress {
  total: number;
  completed: number;
  percent: number; // 0..100, arredondado
}

/** Busca o total de páginas ativas de cada slug informado. */
async function fetchTotalsBySlug(slugs: string[]): Promise<Map<string, number>> {
  if (slugs.length === 0) return new Map();
  const { data, error } = await supabase
    .from("stories" as never)
    .select("slug, stories_pages!inner(id, is_active)")
    .in("slug", slugs);
  if (error) {
    return new Map();
  }
  const totals = new Map<string, number>();
  type Row = { slug: string; stories_pages: { id: string; is_active: boolean }[] };
  for (const r of (data as unknown as Row[]) ?? []) {
    const count = (r.stories_pages ?? []).filter((p) => p.is_active).length;
    totals.set(r.slug, count);
  }
  return totals;
}

/** Busca páginas concluídas pelo usuário, agrupadas por story_slug. */
async function fetchCompletedBySlug(
  userId: string,
  slugs: string[],
): Promise<Map<string, number>> {
  if (slugs.length === 0) return new Map();
  const { data, error } = await supabase
    .from("user_page_progress" as never)
    .select("story_slug, status, completed_at")
    .eq("user_id", userId)
    .in("story_slug", slugs);
  if (error) return new Map();
  const map = new Map<string, number>();
  type Row = { story_slug: string; status: string; completed_at: string | null };
  for (const r of (data as unknown as Row[]) ?? []) {
    const isDone = r.status === "completed" || !!r.completed_at;
    if (!isDone) continue;
    map.set(r.story_slug, (map.get(r.story_slug) ?? 0) + 1);
  }
  return map;
}

/**
 * Retorna um mapa slug → progresso para os produtos pedidos.
 * Quando `userId` é undefined, retorna 0% para todos (mas com `total` real).
 */
export async function getProgressBySlug(
  slugs: string[],
  userId: string | undefined,
): Promise<Map<string, ProductProgress>> {
  const unique = Array.from(new Set(slugs.filter(Boolean)));
  const [totals, completed] = await Promise.all([
    fetchTotalsBySlug(unique),
    userId ? fetchCompletedBySlug(userId, unique) : Promise.resolve(new Map<string, number>()),
  ]);
  const out = new Map<string, ProductProgress>();
  for (const slug of unique) {
    const total = totals.get(slug) ?? 0;
    const done = Math.min(completed.get(slug) ?? 0, total);
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;
    out.set(slug, { total, completed: done, percent });
  }
  return out;
}
