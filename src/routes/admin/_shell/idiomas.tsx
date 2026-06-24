import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Globe, Check, Users, Eye, RotateCcw, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  SUPPORTED_LOCALES,
  LOCALE_LABELS,
  translate,
  type Locale,
} from "@/integrations/i18n/dictionary";
import { useI18n } from "@/integrations/i18n/i18n-context";
import {
  fetchLanguageUsage,
  fetchOverrideUsers,
  clearUserOverride,
} from "@/services/languages";
import {
  useActiveVariation,
  useVariations,
  VARIATIONS_QUERY_KEY,
} from "@/integrations/variations/variation-context";
import { updateLoginSettings } from "@/services/variations";

export const Route = createFileRoute("/admin/_shell/idiomas")({
  component: IdiomasPage,
});

const PREVIEW_KEYS: Array<{ key: string; vars?: Record<string, string | number> }> = [
  { key: "home.greeting" },
  { key: "home.subtitle" },
  { key: "header.notifications.title" },
  { key: "favorites.title" },
  { key: "profile.progress.coloured", vars: { done: 12, total: 30 } },
  { key: "common.save" },
];

function IdiomasPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const variation = useActiveVariation();
  const { variations, setActive } = useVariations();
  const usageQuery = useQuery({
    queryKey: ["admin", "languages", "usage"],
    queryFn: fetchLanguageUsage,
  });
  const overridesQuery = useQuery({
    queryKey: ["admin", "languages", "overrides"],
    queryFn: fetchOverrideUsers,
  });

  const [defaultLang, setDefaultLang] = React.useState<Locale>("pt-BR");
  const [enabled, setEnabled] = React.useState<Locale[]>([...SUPPORTED_LOCALES]);

  // Sync local state with the active variation.
  React.useEffect(() => {
    const def = (SUPPORTED_LOCALES as readonly string[]).includes(variation.default_locale)
      ? (variation.default_locale as Locale)
      : "pt-BR";
    setDefaultLang(def);
    const en = (variation.enabled_languages ?? []).filter((l): l is Locale =>
      (SUPPORTED_LOCALES as readonly string[]).includes(l),
    );
    setEnabled(en.length > 0 ? en : [...SUPPORTED_LOCALES]);
  }, [variation]);

  const saveMutation = useMutation({
    mutationFn: async (payload: {
      default_language: Locale;
      enabled_languages: Locale[];
    }) => {
      if (!supabase) throw new Error("Supabase indisponível");
      if (!variation.id || variation.id === "fallback") {
        throw new Error("Selecione uma área de membros antes de salvar");
      }
      await updateLoginSettings(variation.id, {
        default_locale: payload.default_language,
        enabled_languages: payload.enabled_languages,
      });
    },
    onSuccess: () => {
      toast.success(t("admin.idiomas.saved"));
      qc.invalidateQueries({ queryKey: VARIATIONS_QUERY_KEY });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetOverrideMutation = useMutation({
    mutationFn: (userId: string) => clearUserOverride(userId),
    onSuccess: () => {
      toast.success(t("admin.idiomas.overridesResetSuccess"));
      qc.invalidateQueries({ queryKey: ["admin", "languages", "overrides"] });
      qc.invalidateQueries({ queryKey: ["admin", "languages", "usage"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function toggleEnabled(lang: Locale) {
    if (lang === defaultLang) {
      toast.info(t("admin.idiomas.disabledDefaultWarning"));
      return;
    }
    setEnabled((prev) => {
      const next = prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang];
      if (next.length === 0) return prev;
      if (!next.includes(defaultLang)) return next;
      return next;
    });
  }

  function handleSave() {
    const finalEnabled = enabled.includes(defaultLang) ? enabled : [...enabled, defaultLang];
    saveMutation.mutate({ default_language: defaultLang, enabled_languages: finalEnabled });
  }

  const usage = usageQuery.data;
  const overrides = overridesQuery.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Admin"
        title={t("admin.idiomas.title")}
        description={`Configure os idiomas da área "${variation.title}". Cada área tem seus próprios idiomas.`}
      />

      {/* Variation switcher */}
      {variations.length > 1 && (
        <section className="rounded-3xl border border-gold/30 bg-gold/5 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-gold">
                Área de membros ativa
              </p>
              <p className="text-sm text-muted-foreground">
                As configurações abaixo aplicam apenas a esta área.
              </p>
            </div>
            <Select value={variation.id} onValueChange={(id) => setActive(id)}>
              <SelectTrigger className="h-11 w-full max-w-xs rounded-xl border-2 border-gold/40 bg-background text-sm font-semibold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {variations.map((v) => (
                  <SelectItem key={v.id} value={v.id} className="text-sm font-medium">
                    {v.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </section>
      )}


      {/* Default language */}
      <section className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted text-gold">
            <Globe className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {t("admin.idiomas.defaultTitle")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("admin.idiomas.defaultHint")}
            </p>
          </div>
        </div>

        <div className="mt-6 max-w-sm">
          <Select
            value={defaultLang}
            onValueChange={(v) => {
              const next = v as Locale;
              setDefaultLang(next);
              setEnabled((prev) => (prev.includes(next) ? prev : [...prev, next]));
            }}
          >
            <SelectTrigger className="h-12 rounded-2xl border-2 border-gold/30 bg-background text-base font-semibold text-foreground shadow-sm focus:ring-2 focus:ring-gold focus:border-gold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-2xl border-border bg-popover">
              {SUPPORTED_LOCALES.map((l) => (
                <SelectItem
                  key={l}
                  value={l}
                  className="rounded-xl text-base font-medium focus:bg-gold/10 focus:text-foreground"
                >
                  {LOCALE_LABELS[l]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      {/* Enabled languages */}
      <section className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold text-foreground">
          {t("admin.idiomas.enabledTitle")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("admin.idiomas.enabledHint")}</p>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {SUPPORTED_LOCALES.map((lang) => {
            const active = enabled.includes(lang);
            const isDefault = lang === defaultLang;
            return (
              <button
                key={lang}
                type="button"
                onClick={() => toggleEnabled(lang)}
                aria-pressed={active}
                className={cn(
                  "flex h-14 items-center justify-between rounded-2xl border-2 px-4 text-sm font-semibold transition-all",
                  active
                    ? "border-gold bg-gold/10 text-foreground"
                    : "border-border bg-muted text-muted-foreground hover:border-border/80",
                  isDefault && "ring-2 ring-gold/40",
                )}
              >
                <span className="flex items-center gap-2">
                  {LOCALE_LABELS[lang]}
                  {isDefault && (
                    <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gold">
                      Default
                    </span>
                  )}
                </span>
                {active && <Check className="h-4 w-4 text-gold" />}
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="rounded-2xl bg-gold px-6 py-3 text-sm font-semibold text-gold-foreground shadow-md transition-transform hover:-translate-y-0.5 disabled:opacity-60"
          >
            {saveMutation.isPending ? t("common.loading") : t("common.save")}
          </button>
        </div>
      </section>

      {/* Usage stats */}
      <section className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted text-gold">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {t("admin.idiomas.usageTitle")}
            </h2>
            <p className="text-sm text-muted-foreground">{t("admin.idiomas.usageHint")}</p>
          </div>
        </div>

        {usageQuery.isLoading ? (
          <p className="mt-6 text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : !usage || usage.totalProfiles === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">
            {t("admin.idiomas.usageDefault")} — 0
          </p>
        ) : (
          <div className="mt-6 space-y-4">
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span>{t("admin.idiomas.totalProfiles", { count: usage.totalProfiles })}</span>
              <span>•</span>
              <span>
                {t("admin.idiomas.usageOverride", { count: usage.withOverride })}
              </span>
            </div>

            <ul className="space-y-2">
              {usage.byLocale.map((row) => {
                const isDefault = row.locale === "default";
                const label = isDefault
                  ? t("admin.idiomas.usageDefault")
                  : LOCALE_LABELS[row.locale as Locale];
                const pct =
                  usage.totalProfiles > 0
                    ? Math.round((row.count / usage.totalProfiles) * 100)
                    : 0;
                return (
                  <li key={row.locale} className="flex items-center gap-3">
                    <span className="w-40 shrink-0 text-sm font-medium text-foreground">
                      {label}
                    </span>
                    <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-gold transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-20 shrink-0 text-right text-xs font-semibold text-muted-foreground">
                      {row.count} · {pct}%
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      {/* Preview */}
      <section className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted text-gold">
            <Eye className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {t("admin.idiomas.previewTitle")}
            </h2>
            <p className="text-sm text-muted-foreground">{t("admin.idiomas.previewHint")}</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {enabled.map((lang) => (
            <div
              key={lang}
              className={cn(
                "rounded-2xl border-2 p-4",
                lang === defaultLang ? "border-gold/50 bg-gold/5" : "border-border bg-muted/30",
              )}
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-bold text-foreground">{LOCALE_LABELS[lang]}</span>
                {lang === defaultLang && (
                  <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gold">
                    Default
                  </span>
                )}
              </div>
              <ul className="space-y-2 text-xs">
                {PREVIEW_KEYS.map((p) => (
                  <li key={p.key} className="border-t border-border/50 pt-2 first:border-t-0 first:pt-0">
                    <div className="font-mono text-[10px] text-muted-foreground">{p.key}</div>
                    <div className="mt-0.5 text-foreground">{translate(lang, p.key, p.vars)}</div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Overrides table */}
      <section className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted text-gold">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {t("admin.idiomas.overridesTitle")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("admin.idiomas.overridesHint")}
            </p>
          </div>
        </div>

        {overridesQuery.isLoading ? (
          <p className="mt-6 text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : overrides.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">
            {t("admin.idiomas.overridesEmpty")}
          </p>
        ) : (
          <div className="mt-6 overflow-hidden rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Usuário</th>
                  <th className="px-4 py-3 text-left font-semibold">Email</th>
                  <th className="px-4 py-3 text-left font-semibold">Idioma</th>
                  <th className="px-4 py-3 text-right font-semibold"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {overrides.map((u) => (
                  <tr key={u.user_id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium text-foreground">
                      {u.display_name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {u.purchase_email ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-gold/10 px-3 py-1 text-xs font-semibold text-gold">
                        {LOCALE_LABELS[u.language_override]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => resetOverrideMutation.mutate(u.user_id)}
                        disabled={resetOverrideMutation.isPending}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                      >
                        <RotateCcw className="h-3 w-3" />
                        {t("admin.idiomas.overridesReset")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!supabase && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-gold/30 bg-gold/10 p-3 text-xs text-foreground">
            <AlertTriangle className="h-4 w-4 shrink-0 text-gold" />
            <span>Conecte o Supabase para gerenciar idiomas em tempo real.</span>
          </div>
        )}
      </section>
    </div>
  );
}
