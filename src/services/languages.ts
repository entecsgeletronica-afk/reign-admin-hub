import { supabase, supabaseAny } from "@/integrations/supabase/client";
import { SUPPORTED_LOCALES, type Locale } from "@/integrations/i18n/dictionary";

export interface LanguageUsageRow {
  locale: Locale | "default";
  count: number;
}

export interface LanguageOverrideUser {
  user_id: string;
  display_name: string | null;
  purchase_email: string | null;
  language_override: Locale;
  updated_at: string;
}

interface ProfileRow {
  user_id: string;
  display_name: string | null;
  purchase_email: string | null;
  language_override: string | null;
  updated_at: string;
}

function isLocale(value: string | null): value is Locale {
  return !!value && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export async function fetchLanguageUsage(): Promise<{
  totalProfiles: number;
  withOverride: number;
  byLocale: LanguageUsageRow[];
}> {
  if (!supabase) {
    return { totalProfiles: 0, withOverride: 0, byLocale: [] };
  }
  const { data, error } = await supabaseAny
    .from("profiles")
    .select("user_id, language_override")
    .limit(5000);
  if (error) throw error;

  const rows = (data ?? []) as Pick<ProfileRow, "user_id" | "language_override">[];
  const totalProfiles = rows.length;

  const counts = new Map<Locale | "default", number>();
  for (const loc of SUPPORTED_LOCALES) counts.set(loc, 0);
  counts.set("default", 0);

  let withOverride = 0;
  for (const row of rows) {
    if (isLocale(row.language_override)) {
      withOverride += 1;
      counts.set(row.language_override, (counts.get(row.language_override) ?? 0) + 1);
    } else {
      counts.set("default", (counts.get("default") ?? 0) + 1);
    }
  }

  const byLocale: LanguageUsageRow[] = Array.from(counts.entries()).map(([locale, count]) => ({
    locale,
    count,
  }));
  return { totalProfiles, withOverride, byLocale };
}

export async function fetchOverrideUsers(): Promise<LanguageOverrideUser[]> {
  if (!supabase) return [];
  const { data, error } = await supabaseAny
    .from("profiles")
    .select("user_id, display_name, purchase_email, language_override, updated_at")
    .not("language_override", "is", null)
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) throw error;

  const rows = (data ?? []) as ProfileRow[];
  return rows
    .filter((r) => isLocale(r.language_override))
    .map((r) => ({
      user_id: r.user_id,
      display_name: r.display_name,
      purchase_email: r.purchase_email,
      language_override: r.language_override as Locale,
      updated_at: r.updated_at,
    }));
}

export async function clearUserOverride(userId: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabaseAny
    .from("profiles")
    .update({ language_override: null })
    .eq("user_id", userId);
  if (error) throw error;
}
