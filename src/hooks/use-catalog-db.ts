import { useQuery } from "@tanstack/react-query";
import {
  getHomeSettings,
  getMostRecentProduct,
  getProductById,
  listProducts,
  listRecentProductIds,
  listSections,
  listUserFavoriteIds,
  type CatalogProductRow,
  type CatalogSectionRow,
  type HomeSettingsRow,
} from "@/services/catalog-db";

export function useCatalogProductById(id: string | null | undefined) {
  return useQuery<CatalogProductRow | null>({
    queryKey: ["catalog", "product-by-id", id ?? null],
    queryFn: () => (id ? getProductById(id) : Promise.resolve(null)),
    enabled: !!id,
  });
}

export function useCatalogSections(opts?: {
  includeInactive?: boolean;
  variationId?: string | null;
}) {
  return useQuery<CatalogSectionRow[]>({
    queryKey: [
      "catalog",
      "sections",
      opts?.includeInactive ?? false,
      opts?.variationId ?? null,
    ],
    queryFn: () => listSections(opts),
  });
}

export function useCatalogProducts(opts?: {
  includeUnpublished?: boolean;
  variationId?: string | null;
}) {
  return useQuery<CatalogProductRow[]>({
    queryKey: [
      "catalog",
      "products",
      opts?.includeUnpublished ?? false,
      opts?.variationId ?? null,
    ],
    queryFn: () => listProducts(opts),
  });
}

export function useHomeSettings(variationId?: string | null) {
  return useQuery<HomeSettingsRow | null>({
    queryKey: ["catalog", "home_settings", variationId ?? null],
    queryFn: () => getHomeSettings(variationId ?? null),
  });
}

export function useMostRecentProductId(userId: string | undefined) {
  return useQuery<string | null>({
    queryKey: ["catalog", "recent", userId],
    queryFn: () => (userId ? getMostRecentProduct(userId) : Promise.resolve(null)),
    enabled: !!userId,
  });
}

/** Lista IDs de produtos recentes do usuário (Continue colorindo). */
export function useRecentProductIds(userId: string | undefined, limit = 12) {
  return useQuery<string[]>({
    queryKey: ["catalog", "recent-list", userId, limit],
    queryFn: () => (userId ? listRecentProductIds(userId, limit) : Promise.resolve([])),
    enabled: !!userId,
  });
}

export function useUserFavoriteIds(userId: string | undefined) {
  return useQuery<Set<string>>({
    queryKey: ["catalog", "favorites", userId],
    queryFn: () =>
      userId ? listUserFavoriteIds(userId) : Promise.resolve(new Set<string>()),
    enabled: !!userId,
  });
}
