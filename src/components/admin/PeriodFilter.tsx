import * as React from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { persistDashboardPeriod } from "@/lib/dashboard-period";
import type { PeriodKey } from "@/services/dashboard";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: "today", label: "Hoje" },
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "90d", label: "90 dias" },
  { key: "month", label: "Mês" },
  // "custom" é renderizado pelo CalendarRangeButton abaixo (não como pílula).
];

export function PeriodFilter({
  value,
  options,
}: {
  value: PeriodKey;
  options?: PeriodKey[];
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const visible = options ? OPTIONS.filter((o) => options.includes(o.key)) : OPTIONS;
  const showCustom = !options || options.includes("custom");

  function setPeriod(p: PeriodKey) {
    persistDashboardPeriod(p);
    navigate({
      to: location.pathname,
      search: (prev: Record<string, unknown>) => ({ ...prev, period: p }),
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {visible.map((opt) => {
        const active = opt.key === value;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => setPeriod(opt.key)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
              active
                ? "border-gold bg-gold text-gold-foreground shadow"
                : "border-border bg-surface-elevated text-muted-foreground hover:text-foreground",
            )}
          >
            {opt.label}
          </button>
        );
      })}
      {showCustom && (
        <CalendarRangeButton
          isActive={value === "custom"}
          onApply={() => setPeriod("custom")}
        />
      )}
    </div>
  );
}

/**
 * Botão de calendário (date range picker).
 *
 * Por enquanto é puramente visual: ao confirmar um intervalo, alteramos o
 * `period` para "custom" — o backend continua devolvendo os dados da view
 * `period_key=custom` já existente. Quando quisermos filtro real por data,
 * é só passar o range escolhido para o serviço (fetchDashboardKpis etc.).
 */
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
    if (!range?.from) return "Escolher datas";
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
            "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
            isActive
              ? "border-gold bg-gold text-gold-foreground shadow"
              : "border-border bg-surface-elevated text-muted-foreground hover:text-foreground",
          )}
        >
          <CalendarIcon className="h-3.5 w-3.5" />
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
            onClick={() => {
              setRange(undefined);
            }}
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

export const _ = Link;
