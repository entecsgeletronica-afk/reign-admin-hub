// Theme utilities. Per-area persistence is now done via member_area_variations
// (see themeFromVariation + updateLoginSettings in services/variations.ts).

export interface ThemeSettings {
  primary: string; // hex (#RRGGBB)
  background: string;
  card: string;
  sidebar: string;
  accent: string; // used as foreground/text accent
  button: string; // background color for primary buttons
}

export const DEFAULT_THEME: ThemeSettings = {
  primary: "#E8B84A", // gold
  background: "#0F1626", // dark navy
  card: "#1A2236",
  sidebar: "#121A2C",
  accent: "#F5F7FA",
  button: "#E8B84A",
};

export const THEME_PRESETS: { id: string; name: string; theme: ThemeSettings }[] = [
  { id: "gold-dark", name: "Dourado (padrão)", theme: DEFAULT_THEME },
  {
    id: "ocean",
    name: "Oceano",
    theme: {
      primary: "#3DA5FF",
      background: "#0B1220",
      card: "#161F33",
      sidebar: "#101828",
      accent: "#F5F7FA",
      button: "#3DA5FF",
    },
  },
  {
    id: "forest",
    name: "Floresta",
    theme: {
      primary: "#5BD08A",
      background: "#0E1A14",
      card: "#172821",
      sidebar: "#11201A",
      accent: "#F2F6F3",
      button: "#5BD08A",
    },
  },
  {
    id: "rose",
    name: "Rosé",
    theme: {
      primary: "#F472B6",
      background: "#1A0F18",
      card: "#261624",
      sidebar: "#1F1220",
      accent: "#FAF3F7",
      button: "#F472B6",
    },
  },
  {
    id: "light",
    name: "Claro",
    theme: {
      primary: "#D4A02A",
      background: "#F7F8FB",
      card: "#FFFFFF",
      sidebar: "#FFFFFF",
      accent: "#1A2236",
      button: "#D4A02A",
    },
  },
];

import { safeStorage } from "@/lib/safe-storage";
import type { Variation } from "@/services/variations";

const LS_KEY = "rdc.admin.theme";

function readLS(): ThemeSettings | null {
  try {
    const raw = safeStorage.getItem(LS_KEY);
    return raw ? { ...DEFAULT_THEME, ...JSON.parse(raw) } : null;
  } catch {
    return null;
  }
}

function writeLS(value: ThemeSettings) {
  try {
    safeStorage.setItem(LS_KEY, JSON.stringify(value));
  } catch {
    /* no-op */
  }
}

/**
 * Derive a ThemeSettings from a member-area variation row.
 * Falls back to DEFAULT_THEME when fields are not set on the variation.
 */
export function themeFromVariation(variation: Variation | null | undefined): ThemeSettings {
  if (!variation) return DEFAULT_THEME;
  return {
    primary: variation.primary_color || DEFAULT_THEME.primary,
    background: variation.background_color || DEFAULT_THEME.background,
    card: variation.card_color || variation.surface_color || DEFAULT_THEME.card,
    sidebar: variation.sidebar_color || variation.surface_color || DEFAULT_THEME.sidebar,
    accent: variation.text_color || DEFAULT_THEME.accent,
    button: variation.button_color || variation.primary_color || DEFAULT_THEME.button,
  };
}

export async function getThemeSettings(): Promise<ThemeSettings> {
  // Legacy: kept for backwards compatibility with components outside the
  // variation-aware flow. Prefer themeFromVariation(active).
  return readLS() ?? DEFAULT_THEME;
}

export async function saveThemeSettings(value: ThemeSettings): Promise<void> {
  writeLS(value);
}

// ---------- Color math (hex -> oklch string) ----------
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(v, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function srgbToLinear(c: number) {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}

function rgbToOklch(r: number, g: number, b: number): { l: number; c: number; h: number } {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);
  // Linear sRGB -> LMS
  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
  const C = Math.sqrt(a * a + bb * bb);
  let h = (Math.atan2(bb, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l: L, c: C, h };
}

export function hexToOklchStr(hex: string, alpha?: number): string {
  const [r, g, b] = hexToRgb(hex);
  const { l, c, h } = rgbToOklch(r, g, b);
  const base = `${l.toFixed(3)} ${c.toFixed(3)} ${h.toFixed(1)}`;
  return alpha != null ? `oklch(${base} / ${alpha})` : `oklch(${base})`;
}

export function getLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

export function pickForeground(hex: string): string {
  return getLuminance(hex) > 0.5 ? "#0F1626" : "#FFFFFF";
}

// ---------- Apply to :root ----------
export function applyTheme(theme: ThemeSettings) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const set = (name: string, value: string) => root.style.setProperty(name, value);

  const primaryFg = pickForeground(theme.primary);
  const buttonFg = pickForeground(theme.button);
  const isLight = getLuminance(theme.background) > 0.5;
  const fg = isLight ? "#0F1626" : "#F5F7FA";
  const muted = isLight ? "#5A6678" : "#9AA5B8";

  set("--background", hexToOklchStr(theme.background));
  set("--foreground", hexToOklchStr(fg));
  set("--card", hexToOklchStr(theme.card));
  set("--card-foreground", hexToOklchStr(fg));
  set("--popover", hexToOklchStr(theme.card));
  set("--popover-foreground", hexToOklchStr(fg));
  set("--surface", hexToOklchStr(theme.card));
  set("--surface-elevated", hexToOklchStr(theme.card));

  // Primary = botões (shadcn usa --primary para Button)
  set("--primary", hexToOklchStr(theme.button));
  set("--primary-foreground", hexToOklchStr(buttonFg));
  set("--button", hexToOklchStr(theme.button));
  set("--button-foreground", hexToOklchStr(buttonFg));

  // Gold = destaque/highlight (item ativo no sidebar, ícones)
  set("--gold", hexToOklchStr(theme.primary));
  set("--gold-foreground", hexToOklchStr(primaryFg));
  set("--gold-soft", hexToOklchStr(theme.primary, 0.15));

  set("--secondary", hexToOklchStr(theme.card));
  set("--secondary-foreground", hexToOklchStr(fg));
  set("--muted", hexToOklchStr(theme.card));
  set("--muted-foreground", hexToOklchStr(muted));
  set("--accent", hexToOklchStr(theme.card));
  set("--accent-foreground", hexToOklchStr(fg));

  set("--ring", hexToOklchStr(theme.button, 0.5));

  set("--sidebar", hexToOklchStr(theme.sidebar));
  set("--sidebar-foreground", hexToOklchStr(muted));
  set("--sidebar-primary", hexToOklchStr(theme.primary));
  set("--sidebar-primary-foreground", hexToOklchStr(primaryFg));
  set("--sidebar-accent", hexToOklchStr(theme.card));
  set("--sidebar-accent-foreground", hexToOklchStr(fg));
  set("--sidebar-ring", hexToOklchStr(theme.primary, 0.5));
}
