import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listVariations, type Variation } from "@/services/variations";

/**
 * Variation = "Área de membros". Phase 2 wires this context to real Supabase
 * data (table `member_area_variations`). The active selection is persisted in
 * localStorage so reloads keep the same workspace context.
 */
export type { Variation } from "@/services/variations";

const STORAGE_KEY = "rdc:admin:active-variation";

const FALLBACK_VARIATION: Variation = {
  id: "fallback",
  account_id: "00000000-0000-0000-0000-000000000001",
  title: "Sem variação",
  slug: "sem-variacao",
  description: null,
  short_label: null,
  primary_type: "mixed",
  logo_url: null,
  hero_image_url: null,
  primary_color: null,
  secondary_color: null,
  accent_color: null,
  default_locale: "pt-BR",
  status: "draft",
  order_index: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  subdomain_key: null,
  root_domain: null,
  domain_mode: "subdomain",
  background_color: null,
  surface_color: null,
  text_color: null,
  button_color: null,
  button_text_color: null,
  favicon_url: null,
  login_image_url: null,
  login_title: null,
  login_subtitle: null,
  login_email_placeholder: null,
  login_password_placeholder: null,
  login_submit_label: null,
  login_helper_text: null,
  login_footer_text: null,
  login_layout_mode: "split-right",
  login_background_mode: "solid",
  sidebar_color: null,
  card_color: null,
  enabled_languages: ["pt-BR", "en-US", "es-ES"],
  // Phase 2 defaults
  is_primary: false,
  date_format: "DD/MM/YYYY",
  theme_mode: "auto",
  muted_text_color: null,
  support_email: null,
  app_name: null,
  logo_alt: null,
  access_type: "restricted_purchase",
  no_access_behavior: "show_locked",
  sales_page_url: null,
  microcopy_json: {},
};

type Ctx = {
  variations: Variation[];
  activeId: string;
  active: Variation;
  setActive: (id: string) => void;
  isLoading: boolean;
  refresh: () => Promise<void>;
};

const VariationContext = React.createContext<Ctx | null>(null);

export const VARIATIONS_QUERY_KEY = ["admin", "variations"] as const;

export function VariationProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { data: variations = [], isLoading } = useQuery({
    queryKey: VARIATIONS_QUERY_KEY,
    queryFn: listVariations,
    staleTime: 30_000,
  });

  const [activeId, setActiveId] = React.useState<string>(() => {
    if (typeof window === "undefined") return "";
    try {
      // URL param takes precedence so links like "/?variation=<id>" force
      // the correct workspace context (used by "Ver como aluno" in admin).
      const urlId = new URLSearchParams(window.location.search).get("variation");
      if (urlId) {
        try {
          window.localStorage.setItem(STORAGE_KEY, urlId);
        } catch {
          // ignore
        }
        return urlId;
      }
      return window.localStorage.getItem(STORAGE_KEY) ?? "";
    } catch {
      return "";
    }
  });

  // Once data loads, ensure activeId points at a real row.
  React.useEffect(() => {
    if (!variations.length) return;
    const valid = variations.some((v) => v.id === activeId);
    if (!valid) {
      const next = variations[0].id;
      setActiveId(next);
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignore
      }
    }
  }, [variations, activeId]);

  const setActive = React.useCallback((id: string) => {
    setActiveId(id);
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // ignore
    }
  }, []);

  const active =
    variations.find((v) => v.id === activeId) ??
    variations[0] ??
    FALLBACK_VARIATION;

  const refresh = React.useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: VARIATIONS_QUERY_KEY });
  }, [queryClient]);

  const value = React.useMemo<Ctx>(
    () => ({
      variations,
      activeId: active.id,
      active,
      setActive,
      isLoading,
      refresh,
    }),
    [variations, active, setActive, isLoading, refresh],
  );

  return (
    <VariationContext.Provider value={value}>{children}</VariationContext.Provider>
  );
}

export function useActiveVariation(): Variation {
  const ctx = React.useContext(VariationContext);
  if (!ctx) return FALLBACK_VARIATION;
  return ctx.active;
}

/**
 * Estado completo do carregamento da variação ativa.
 * Use quando precisar bloquear renderização até os dados reais existirem
 * (evita flash de tela genérica em refresh).
 */
export function useActiveVariationState(): {
  active: Variation;
  isLoading: boolean;
  isReady: boolean;
} {
  const ctx = React.useContext(VariationContext);
  if (!ctx) {
    return { active: FALLBACK_VARIATION, isLoading: false, isReady: false };
  }
  const isReady = !ctx.isLoading && ctx.active.id !== "fallback";
  return { active: ctx.active, isLoading: ctx.isLoading, isReady };
}

export function useVariations(): Ctx {
  const ctx = React.useContext(VariationContext);
  if (!ctx) {
    return {
      variations: [],
      activeId: "",
      active: FALLBACK_VARIATION,
      setActive: () => {},
      isLoading: false,
      refresh: async () => {},
    };
  }
  return ctx;
}
