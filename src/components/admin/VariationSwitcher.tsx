import * as React from "react";
import { ChevronDown, Check, Layers, Plus } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { useVariations } from "@/integrations/variations/variation-context";

/**
 * Top-of-admin "Variação ativa" switcher. Phase 1 only ships one mock
 * variation so the dropdown stays disabled-looking but already exposes the
 * surface — Phase 2 will plug in real CRUD + the 5-variation cap.
 */
export function VariationSwitcher() {
  const { variations, active, setActive } = useVariations();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const totalAreas = variations.length;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-2.5 rounded-xl border border-border bg-surface px-3 py-2 text-left text-sm shadow-sm transition-colors hover:bg-accent",
          open && "ring-1 ring-gold/40",
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gold/10 text-gold">
          <Layers className="h-3.5 w-3.5" />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Variação ativa
          </span>
          <span className="truncate text-sm font-semibold text-foreground">
            {active.title}
          </span>
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
        >
          <div className="border-b border-border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Áreas de membros
          </div>
          <ul className="max-h-72 overflow-y-auto py-1">
            {variations.map((v) => {
              const isActive = v.id === active.id;
              return (
                <li key={v.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onClick={() => {
                      setActive(v.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-accent",
                      isActive && "bg-accent/60",
                    )}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: v.accent_color ?? "hsl(var(--gold))" }}
                      aria-hidden
                    />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium text-foreground">
                        {v.title}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        /{v.slug}
                      </span>
                    </span>
                    {isActive && <Check className="h-4 w-4 text-gold" />}
                  </button>
                </li>
              );
            })}
          </ul>
          <Link
            to="/admin/areas"
            onClick={() => setOpen(false)}
            className="flex items-center justify-between gap-2 border-t border-border bg-surface-elevated px-3 py-2.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <span className="inline-flex items-center gap-1.5 font-medium">
              <Plus className="h-3.5 w-3.5" />
              Gerenciar áreas
            </span>
            <span>
              {totalAreas} {totalAreas === 1 ? "área criada" : "áreas criadas"}
            </span>
          </Link>
        </div>
      )}
    </div>
  );
}
