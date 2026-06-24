import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, supabaseAny } from "@/integrations/supabase/client";
import { useAuth } from "@/integrations/supabase/auth-context";
import { useActiveVariation } from "@/integrations/variations/variation-context";
import { safeStorage } from "@/lib/safe-storage";
import {
  SUPPORTED_LOCALES,
  type Locale,
  translate,
} from "./dictionary";

interface ProfileLangRow {
  language_override: string | null;
}

interface I18nContextValue {
  locale: Locale;
  defaultLocale: Locale;
  enabledLocales: Locale[];
  isOverridden: boolean;
  setLocale: (next: Locale) => Promise<void>;
  resetLocale: () => Promise<void>;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = React.createContext<I18nContextValue | null>(null);

const FALLBACK: Locale = "pt-BR";
const LS_GUEST_KEY = "rdc.guest.locale";

function normalize(value: string | null | undefined): Locale | null {
  if (!value) return null;
  return (SUPPORTED_LOCALES as readonly string[]).includes(value) ? (value as Locale) : null;
}

async function fetchProfileLanguage(userId: string | undefined): Promise<ProfileLangRow | null> {
  if (!userId || !supabase) return null;
  const { data } = await supabaseAny
    .from("profiles")
    .select("language_override")
    .eq("user_id", userId)
    .maybeSingle();
  return (data ?? null) as ProfileLangRow | null;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const qc = useQueryClient();
  const variation = useActiveVariation();

  const profileQuery = useQuery({
    queryKey: ["i18n", "profile_language", userId ?? "guest"],
    queryFn: () => fetchProfileLanguage(userId),
    enabled: !!userId,
    staleTime: 60_000,
  });

  // Default + enabled locales now come from the active member-area variation.
  const defaultLocale: Locale = normalize(variation?.default_locale) ?? FALLBACK;

  const enabledLocales: Locale[] = React.useMemo(() => {
    const list =
      variation?.enabled_languages
        ?.map(normalize)
        .filter((v): v is Locale => v !== null) ?? [];
    return list.length > 0 ? list : [...SUPPORTED_LOCALES];
  }, [variation]);

  // guest override (localStorage with safe in-memory fallback) for
  // unauthenticated users — never throws on private mode / quota.
  const [guestLocale, setGuestLocale] = React.useState<Locale | null>(() =>
    normalize(safeStorage.getItem(LS_GUEST_KEY)),
  );

  const userOverride = normalize(profileQuery.data?.language_override ?? null);
  const effectiveOverride = userId ? userOverride : guestLocale;

  const locale: Locale = effectiveOverride ?? defaultLocale;

  // Reflect in <html lang>
  React.useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const saveMutation = useMutation({
    mutationFn: async (next: Locale | null) => {
      if (userId && supabase) {
        await supabaseAny
          .from("profiles")
          .upsert(
            { user_id: userId, language_override: next },
            { onConflict: "user_id" },
          );
      } else {
        if (next) safeStorage.setItem(LS_GUEST_KEY, next);
        else safeStorage.removeItem(LS_GUEST_KEY);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["i18n", "profile_language"] });
    },
  });

  const setLocale = React.useCallback(
    async (next: Locale) => {
      if (!userId) {
        setGuestLocale(next);
      }
      await saveMutation.mutateAsync(next);
    },
    [userId, saveMutation],
  );

  const resetLocale = React.useCallback(async () => {
    if (!userId) setGuestLocale(null);
    await saveMutation.mutateAsync(null);
  }, [userId, saveMutation]);

  const value = React.useMemo<I18nContextValue>(
    () => ({
      locale,
      defaultLocale,
      enabledLocales,
      isOverridden: !!effectiveOverride && effectiveOverride !== defaultLocale,
      setLocale,
      resetLocale,
      t: (key, vars) => translate(locale, key, vars),
    }),
    [locale, defaultLocale, enabledLocales, effectiveOverride, setLocale, resetLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = React.useContext(I18nContext);
  if (!ctx) {
    // Safe fallback — should never happen if provider is mounted at root.
    return {
      locale: FALLBACK,
      defaultLocale: FALLBACK,
      enabledLocales: [...SUPPORTED_LOCALES],
      isOverridden: false,
      setLocale: async () => {},
      resetLocale: async () => {},
      t: (key, vars) => translate(FALLBACK, key, vars),
    };
  }
  return ctx;
}

export function useT() {
  return useI18n().t;
}
