import * as React from "react";
import {
  applyTheme,
  DEFAULT_THEME,
  themeFromVariation,
  type ThemeSettings,
} from "@/services/theme";
import { useActiveVariation } from "@/integrations/variations/variation-context";
import { updateLoginSettings } from "@/services/variations";
import { useQueryClient } from "@tanstack/react-query";
import { VARIATIONS_QUERY_KEY } from "@/integrations/variations/variation-context";

interface ThemeContextValue {
  theme: ThemeSettings;
  setTheme: (value: ThemeSettings) => void;
  reset: () => void;
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const variation = useActiveVariation();
  const queryClient = useQueryClient();

  // Theme is derived from the active variation. Local state mirrors it so we
  // can apply optimistically while persisting.
  const derived = React.useMemo(() => themeFromVariation(variation), [variation]);
  const [theme, setThemeState] = React.useState<ThemeSettings>(derived);

  // Whenever the active variation changes (or its colors change), re-apply.
  React.useEffect(() => {
    setThemeState(derived);
    applyTheme(derived);
  }, [derived]);

  const setTheme = React.useCallback(
    (value: ThemeSettings) => {
      setThemeState(value);
      applyTheme(value);
      // Persist to the active variation row.
      if (variation && variation.id && variation.id !== "fallback") {
        void updateLoginSettings(variation.id, {
          primary_color: value.primary,
          background_color: value.background,
          card_color: value.card,
          sidebar_color: value.sidebar,
          text_color: value.accent,
          button_color: value.button,
        }).then(() => {
          queryClient.invalidateQueries({ queryKey: VARIATIONS_QUERY_KEY });
        });
      }
    },
    [variation, queryClient],
  );

  const reset = React.useCallback(() => {
    setThemeState(DEFAULT_THEME);
    applyTheme(DEFAULT_THEME);
    if (variation && variation.id && variation.id !== "fallback") {
      void updateLoginSettings(variation.id, {
        primary_color: DEFAULT_THEME.primary,
        background_color: DEFAULT_THEME.background,
        card_color: DEFAULT_THEME.card,
        sidebar_color: DEFAULT_THEME.sidebar,
        text_color: DEFAULT_THEME.accent,
        button_color: DEFAULT_THEME.button,
      }).then(() => {
        queryClient.invalidateQueries({ queryKey: VARIATIONS_QUERY_KEY });
      });
    }
  }, [variation, queryClient]);

  const value = React.useMemo(() => ({ theme, setTheme, reset }), [theme, setTheme, reset]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
