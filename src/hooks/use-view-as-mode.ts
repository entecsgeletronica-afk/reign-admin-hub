import * as React from "react";
import { safeStorage } from "@/lib/safe-storage";

/**
 * Single source of truth for the admin "Ver como admin / Ver como aluno"
 * toggle. Persists in localStorage and notifies all hook subscribers (across
 * any component, route, or tab) whenever the value changes.
 *
 * - "admin" → admin override: sees everything, no lock badges.
 * - "user"  → preview as a real customer: locked products are blurred, etc.
 */
export type ViewAsMode = "admin" | "user";

export const VIEW_AS_MODE_STORAGE_KEY = "admin:view-as-mode";
const DEFAULT_MODE: ViewAsMode = "user";

function readStoredMode(): ViewAsMode {
  const raw = safeStorage.getItem(VIEW_AS_MODE_STORAGE_KEY);
  return raw === "admin" ? "admin" : DEFAULT_MODE;
}

// In-memory broadcast channel so multiple components in the same tab stay in
// sync without relying on the `storage` event (which only fires across tabs).
const listeners = new Set<(mode: ViewAsMode) => void>();

function notify(mode: ViewAsMode) {
  for (const fn of listeners) fn(mode);
}

/**
 * Append the persisted view-mode to a preview URL, so the iframe / new tab
 * loads with the same mode the admin last selected.
 */
export function appendViewAsMode(url: string, mode: ViewAsMode = readStoredMode()): string {
  const sep = url.includes("?") ? "&" : "?";
  const parts = [`as=${mode}`];
  if (mode === "user") parts.push("preview=user");
  return `${url}${sep}${parts.join("&")}`;
}

/**
 * React hook returning [mode, setMode]. Reading is SSR-safe (returns the
 * default during render on the server). Writing persists to localStorage and
 * broadcasts to every other useViewAsMode() consumer in the page.
 */
export function useViewAsMode(): [ViewAsMode, (mode: ViewAsMode) => void] {
  const [mode, setMode] = React.useState<ViewAsMode>(() =>
    typeof window === "undefined" ? DEFAULT_MODE : readStoredMode(),
  );

  React.useEffect(() => {
    // Subscribe to in-page broadcasts.
    const onChange = (next: ViewAsMode) => setMode(next);
    listeners.add(onChange);

    // Subscribe to cross-tab changes via the standard storage event.
    const onStorage = (e: StorageEvent) => {
      if (e.key !== VIEW_AS_MODE_STORAGE_KEY) return;
      setMode(e.newValue === "admin" ? "admin" : DEFAULT_MODE);
    };
    window.addEventListener("storage", onStorage);

    return () => {
      listeners.delete(onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const update = React.useCallback((next: ViewAsMode) => {
    safeStorage.setItem(VIEW_AS_MODE_STORAGE_KEY, next);
    notify(next);
  }, []);

  return [mode, update];
}
