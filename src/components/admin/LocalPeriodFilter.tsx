import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import type { PeriodKey } from "@/services/dashboard";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * Filtro de período LOCAL (por card), versão compacta do PeriodFilter global.
 *
 * Diferenças do PeriodFilter:
 *  - Não persiste em storage nem mexe na URL.
 *  - Estado controlado por props (value/onChange).
 *  - UI menor para caber no header de cada card.
 */
const OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: "today", label: "Hoje" },
  { key: "7d", label: "7d" },
  { key: "30d", label: "30d" },
  { key: "90d", label: "90d" },
];

export function LocalPeriodFilter({
  value,
  onChange,
}: {
  value: PeriodKey;
  onChange: (p: PeriodKey) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {OPTIONS.map((opt) => {
        const active = opt.key === value;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
              active
                ? "border-gold bg-gold text-gold-foreground shadow-sm"
                : "border-border bg-surface-elevated text-muted-foreground hover:text-foreground",
            )}
          >
            {opt.label}
          </button>
        );
      })}
      <CalendarRangeButton
        isActive={value === "custom"}
        onApply={() => onChange("custom")}
      />
    </div>
  );
}

function CalendarRangeButton({
  isActive,
  onApply,
}: {
  isActive: boolean;
  onApply: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [range, setRange] = React.useState<DateRange | undefined>(() => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - 29);
    return { from: start, to: today };
  });

  const label = React.useMemo(() => {
    if (!range?.from) return "Datas";
    const fmt = (d: Date) => format(d, "dd MMM", { locale: ptBR });
    if (range.to && range.to.getTime() !== range.from.getTime()) {
      return `${fmt(range.from)} – ${fmt(range.to)}`;
    }
    return fmt(range.from);
  }, [range]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
            isActive
              ? "border-gold bg-gold text-gold-foreground shadow-sm"
              : "border-border bg-surface-elevated text-muted-foreground hover:text-foreground",
          )}
        >
          <CalendarIcon className="h-3 w-3" />
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-auto rounded-2xl border border-border bg-card p-0 shadow-xl"
      >
        <Calendar
          mode="range"
          selected={range}
          onSelect={setRange}
          numberOfMonths={2}
          locale={ptBR}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
        <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
          <button
            type="button"
            onClick={() => setRange(undefined)}
            className="rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Limpar
          </button>
          <button
            type="button"
            disabled={!range?.from}
            onClick={() => {
              onApply();
              setOpen(false);
            }}
            className="rounded-full bg-gold px-4 py-1.5 text-xs font-semibold text-gold-foreground shadow transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Aplicar
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
