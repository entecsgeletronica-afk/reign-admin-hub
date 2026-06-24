import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getAccessibleProductIds,
  type AccessibleProductsResult,
} from "@/services/entitlements";

/**
 * Detects whether the current page is being rendered inside the admin's
 * "Ver como usuário" preview iframe. Triggered by `?preview=user` in the URL.
 *
 * When true, the entitlements hook will SKIP the admin override so that
 * locked products show their lock badge exactly as a real customer would see.
 */
function useIsUserPreviewMode(): boolean {
  return React.useMemo(() => {
    if (typeof window === "undefined") return false;
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get("preview") === "user";
    } catch {
      return false;
    }
  }, []);
}

/**
 * Returns the Set of product IDs the user can open right now.
 * Includes:
 *  - all unlocked products
 *  - products the user owns (active entitlements)
 *  - everything (when the user is admin AND not previewing as a user)
 *
 * The hook is safe to call without a userId — it still returns the
 * unlocked-public set so anonymous visitors get a sensible UI.
 */
export function useEntitlements(userId: string | undefined) {
  const forceUserView = useIsUserPreviewMode();
  return useQuery<AccessibleProductsResult>({
    queryKey: ["entitlements", userId ?? "anon", forceUserView ? "user-preview" : "normal"],
    queryFn: () => getAccessibleProductIds(userId, { forceUserView }),
    staleTime: 60_000,
  });
}
