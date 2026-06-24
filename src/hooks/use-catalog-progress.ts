import { useQuery } from "@tanstack/react-query";
import { getProgressBySlug, type ProductProgress } from "@/services/catalog-progress";

/**
 * Carrega o progresso de coloração para uma lista de slugs do catálogo.
 * Retorna um Map vazio enquanto carrega — UI deve assumir 0% como fallback.
 */
export function useCatalogProgress(slugs: string[], userId: string | undefined) {
  const key = [...slugs].sort().join("|");
  return useQuery<Map<string, ProductProgress>>({
    queryKey: ["catalog", "progress", userId ?? "anon", key],
    queryFn: () => getProgressBySlug(slugs, userId),
    enabled: slugs.length > 0,
    staleTime: 30_000,
  });
}
