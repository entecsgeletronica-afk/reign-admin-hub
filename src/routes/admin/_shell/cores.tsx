import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Palette, RotateCcw, Check, Undo2, Redo2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { useTheme } from "@/integrations/theme/theme-context";
import { THEME_PRESETS, type ThemeSettings } from "@/services/theme";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  useActiveVariation,
  useVariations,
} from "@/integrations/variations/variation-context";

export const Route = createFileRoute("/admin/_shell/cores")({
  component: CoresPage,
});

function sameTheme(a: ThemeSettings, b: ThemeSettings) {
  return (Object.keys(a) as (keyof ThemeSettings)[]).every((k) => a[k] === b[k]);
}

const FIELDS: { key: keyof ThemeSettings; label: string; hint: string }[] = [
  { key: "primary", label: "Cor primária", hint: "Destaques, item ativo, ícones" },
  { key: "button", label: "Cor dos botões", hint: "Fundo dos botões de ação" },
  { key: "background", label: "Fundo geral", hint: "Cor base da aplicação" },
  { key: "card", label: "Cards e painéis", hint: "Cor dos cards e blocos" },
  { key: "sidebar", label: "Sidebar", hint: "Fundo do menu lateral" },
  { key: "accent", label: "Texto / contraste", hint: "Foreground principal" },
];

function CoresPage() {
  const { theme, setTheme, reset } = useTheme();
  const variation = useActiveVariation();
  const { variations, setActive } = useVariations();
  const [draft, setDraft] = React.useState<ThemeSettings>(theme);

  // Undo/redo history
  const [history, setHistory] = React.useState<ThemeSettings[]>([theme]);
  const [cursor, setCursor] = React.useState(0);
  const skipHistoryRef = React.useRef(false);

  React.useEffect(() => {
    skipHistoryRef.current = true;
    setDraft(theme);
  }, [theme]);

  // Push draft into history (debounced) on user edits
  React.useEffect(() => {
    if (skipHistoryRef.current) {
      skipHistoryRef.current = false;
      return;
    }
    const t = setTimeout(() => {
      setHistory((h) => {
        const trimmed = h.slice(0, cursor + 1);
        const last = trimmed[trimmed.length - 1];
        if (last && sameTheme(last, draft)) return h;
        const next = [...trimmed, draft].slice(-50);
        setCursor(next.length - 1);
        return next;
      });
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const canUndo = cursor > 0;
  const canRedo = cursor < history.length - 1;

  const dirty = React.useMemo(
    () => (Object.keys(draft) as (keyof ThemeSettings)[]).some((k) => draft[k] !== theme[k]),
    [draft, theme],
  );

  function update(key: keyof ThemeSettings, value: string) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function applyPreset(preset: ThemeSettings) {
    setDraft(preset);
    setTheme(preset);
    toast.success("Tema aplicado");
  }

  function handleSave() {
    setTheme(draft);
    toast.success("Cores salvas e aplicadas");
  }

  function handleReset() {
    reset();
    toast.success("Cores restauradas para o padrão");
  }

  function handleUndo() {
    if (!canUndo) return;
    const idx = cursor - 1;
    skipHistoryRef.current = true;
    setDraft(history[idx]);
    setCursor(idx);
  }

  function handleRedo() {
    if (!canRedo) return;
    const idx = cursor + 1;
    skipHistoryRef.current = true;
    setDraft(history[idx]);
    setCursor(idx);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Admin"
        title="Cores"
        description={`Personalize as cores da área "${variation.title}". Cada área de membros pode ter sua própria identidade visual.`}
        actions={
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-2 rounded-2xl border border-border bg-muted/40 px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted/70"
          >
            <RotateCcw className="h-4 w-4" /> Restaurar padrão
          </button>
        }
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
                As cores abaixo aplicam apenas a esta área.
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

      {/* Presets */}
      <section className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="mb-4 flex items-center gap-2">
          <Palette className="h-4 w-4 text-gold" />
          <h2 className="text-lg font-semibold text-foreground">Temas prontos</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {THEME_PRESETS.map((p) => {
            const active =
              p.theme.primary === theme.primary && p.theme.background === theme.background;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p.theme)}
                className={cn(
                  "group relative overflow-hidden rounded-2xl border-2 p-3 text-left transition-all",
                  active ? "border-gold" : "border-border hover:border-gold/40",
                )}
              >
                <div
                  className="mb-2 flex h-16 items-end gap-1 rounded-xl p-2"
                  style={{ background: p.theme.background }}
                >
                  <div className="h-3 w-3 rounded-full" style={{ background: p.theme.primary }} />
                  <div className="h-3 w-3 rounded-full" style={{ background: p.theme.card }} />
                  <div className="h-3 w-3 rounded-full" style={{ background: p.theme.sidebar }} />
                </div>
                <div className="text-sm font-semibold text-foreground">{p.name}</div>
                {active && (
                  <div className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-gold text-gold-foreground">
                    <Check className="h-3 w-3" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Custom colors */}
      <section className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">Personalizar</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleUndo}
              disabled={!canUndo}
              title="Desfazer (anterior)"
              aria-label="Desfazer"
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-muted/40 text-foreground transition-colors hover:bg-muted/70 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Undo2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={!canRedo}
              title="Refazer (avançar)"
              aria-label="Refazer"
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-muted/40 text-foreground transition-colors hover:bg-muted/70 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Redo2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty}
              className="inline-flex items-center gap-2 rounded-2xl bg-gold px-5 py-2.5 text-sm font-semibold text-gold-foreground shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Salvar cores
            </button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
          <div className="grid gap-3">
            {FIELDS.map((f) => (
              <div
                key={f.key}
                className="flex items-center gap-3 rounded-2xl border border-border bg-muted/30 p-3"
              >
                <label
                  htmlFor={`color-${f.key}`}
                  className="relative h-12 w-12 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-border"
                  style={{ background: draft[f.key] }}
                >
                  <input
                    id={`color-${f.key}`}
                    type="color"
                    value={draft[f.key]}
                    onChange={(e) => update(f.key, e.target.value)}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  />
                </label>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-foreground">{f.label}</div>
                  <div className="text-xs text-muted-foreground">{f.hint}</div>
                </div>
                <input
                  type="text"
                  value={draft[f.key]}
                  onChange={(e) => update(f.key, e.target.value)}
                  className="h-9 w-28 rounded-xl border border-border bg-background px-2 font-mono text-xs uppercase text-foreground outline-none focus:border-gold"
                />
              </div>
            ))}
          </div>

          {/* Preview */}
          <div
            className="overflow-hidden rounded-2xl border border-border"
            style={{ background: draft.background }}
          >
            <div className="grid h-full grid-cols-[160px_1fr]">
              <div
                className="flex flex-col gap-2 p-4"
                style={{ background: draft.sidebar }}
              >
                <div
                  className="text-[10px] font-bold uppercase tracking-wider"
                  style={{ color: draft.primary }}
                >
                  Admin
                </div>
                <div className="text-sm font-bold" style={{ color: draft.accent }}>
                  Reino das Cores
                </div>
                <div className="mt-3 flex flex-col gap-1">
                  <div
                    className="rounded-lg px-3 py-2 text-xs font-semibold"
                    style={{ background: draft.primary, color: "#0F1626" }}
                  >
                    Dashboard
                  </div>
                  <div
                    className="rounded-lg px-3 py-2 text-xs"
                    style={{ color: draft.accent, opacity: 0.7 }}
                  >
                    Usuários
                  </div>
                  <div
                    className="rounded-lg px-3 py-2 text-xs"
                    style={{ color: draft.accent, opacity: 0.7 }}
                  >
                    Relatórios
                  </div>
                </div>
              </div>
              <div className="p-4">
                <div
                  className="text-[10px] font-bold uppercase tracking-wider"
                  style={{ color: draft.primary }}
                >
                  Pré-visualização
                </div>
                <div
                  className="mt-1 text-lg font-bold"
                  style={{ color: draft.accent }}
                >
                  Dashboard
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="rounded-xl p-3"
                      style={{ background: draft.card }}
                    >
                      <div
                        className="text-[10px] uppercase"
                        style={{ color: draft.accent, opacity: 0.6 }}
                      >
                        KPI {i}
                      </div>
                      <div
                        className="text-base font-bold"
                        style={{ color: draft.accent }}
                      >
                        R$ 12.4k
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="mt-3 rounded-xl px-4 py-2 text-xs font-semibold"
                  style={{ background: draft.button, color: "#0F1626" }}
                >
                  Ação primária
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
