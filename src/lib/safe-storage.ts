/**
 * Safe storage — drop-in replacement for `window.localStorage`
 * -----------------------------------------------------------
 * `window.localStorage` can be unavailable or throw in several real
 * scenarios that are NOT bugs in our code:
 *
 *   • SSR / Node:        `window` doesn't exist.
 *   • Safari Private:    `setItem` throws QuotaExceededError on every write.
 *   • Embedded WebViews / cross-origin iframes with storage disabled:
 *                        accessing `window.localStorage` itself throws
 *                        a SecurityError (not just the get/set calls).
 *   • Storage full:      `setItem` throws QuotaExceededError.
 *   • Browser flags:     "Block all cookies" or strict tracking
 *                        prevention disables localStorage entirely.
 *   • Corporate policy:  some managed browsers null out window.localStorage.
 *
 * Without a fallback, a single read/write can throw and break unrelated
 * UI flows (theme load, i18n preference, notification "mark all read",
 * generated suggestion cache, …). With this module, the same code paths
 * keep working — they just lose persistence across page reloads.
 *
 * Strategy:
 *   1. Try the real localStorage. If it works, use it directly.
 *   2. If anything throws (access OR a probe write), transparently fall
 *      back to an in-memory Map shared by the whole app for the lifetime
 *      of the tab. Reads written earlier in the same session still come
 *      back; only persistence across reloads is lost.
 *   3. Each individual call is also wrapped in try/catch — a previously
 *      working localStorage that suddenly throws QuotaExceededError mid-
 *      session (most common: Safari Private writing past 0 bytes, or a
 *      tab that just hit the 5 MB cap) silently falls through to memory
 *      for that single key without disabling persistence for others.
 *
 * Do NOT replace existing `try/catch` around storage calls when migrating
 * — this module already swallows errors. Just swap `window.localStorage`
 * for `safeStorage` and remove the now-redundant guards.
 */

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

// In-memory shim used when the platform localStorage is unavailable.
// Module-scoped so all consumers share the same view within a tab/SSR
// request — that's the property that lets `set` then `get` round-trip
// even when the browser refuses to persist anything.
const memoryStore = new Map<string, string>();

const memoryStorage: StorageLike = {
  getItem(key) {
    return memoryStore.has(key) ? (memoryStore.get(key) as string) : null;
  },
  setItem(key, value) {
    memoryStore.set(key, String(value));
  },
  removeItem(key) {
    memoryStore.delete(key);
  },
};

/**
 * Probe whether `window.localStorage` is actually usable. Just checking
 * `typeof window.localStorage !== "undefined"` is not enough — some
 * environments expose the object but throw on the first write. We do a
 * real round-trip with a unique key so we can't pollute user data.
 */
function detectPersistentStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  let ls: Storage | undefined;
  try {
    ls = window.localStorage;
  } catch {
    // Accessing the property itself can throw in sandboxed iframes /
    // strict cookie policies — treat as "no persistent storage".
    return null;
  }
  if (!ls) return null;
  try {
    const probeKey = "__rdc_storage_probe__";
    ls.setItem(probeKey, "1");
    ls.removeItem(probeKey);
    return ls;
  } catch {
    // Quota/Private mode etc. — bail out, caller will use memory.
    return null;
  }
}

// Resolve once; the result doesn't change within a tab session. We DO
// re-check on every individual operation (try/catch below) so a quota
// error mid-session doesn't break the next call to a different key.
const persistent = detectPersistentStorage();

/**
 * True when the browser provides usable persistent storage. Useful for
 * showing a "your preferences won't be saved" notice in privacy-sensitive
 * settings, but NOT required for normal read/write — those just work.
 */
export const isPersistentStorageAvailable = persistent !== null;

export const safeStorage: StorageLike = {
  getItem(key) {
    if (persistent) {
      try {
        const value = persistent.getItem(key);
        // If the persistent layer has nothing but we wrote to memory
        // earlier (e.g. a previous setItem fell back due to quota),
        // surface the in-memory value so the round-trip still works.
        return value !== null ? value : memoryStorage.getItem(key);
      } catch {
        return memoryStorage.getItem(key);
      }
    }
    return memoryStorage.getItem(key);
  },
  setItem(key, value) {
    if (persistent) {
      try {
        persistent.setItem(key, value);
        // Mirror to memory so a later read after a quota-hit doesn't
        // come back as null. Keeps within-session consistency.
        memoryStorage.setItem(key, value);
        return;
      } catch {
        // Fall through to memory-only for this key.
      }
    }
    memoryStorage.setItem(key, value);
  },
  removeItem(key) {
    if (persistent) {
      try {
        persistent.removeItem(key);
      } catch {
        // ignore — we'll still clear memory below
      }
    }
    memoryStorage.removeItem(key);
  },
};
