import { useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { persistDashboardPeriod, readPersistedDashboardPeriod } from "@/lib/dashboard-period";
import { DollarSign, Trophy, Repeat, Receipt } from "lucide-react";
import { PeriodFilter } from "@/components/admin/PeriodFilter";
import { LocalPeriodFilter } from "@/components/admin/LocalPeriodFilter";
import { KpiCard } from "@/components/admin/KpiCard";
import { RevenueChart } from "@/components/admin/RevenueChart";
import { SubscriptionDonut } from "@/components/admin/SubscriptionDonut";
import { TopPlansCard } from "@/components/admin/TopPlansCard";
import { TopPlansModeToggle } from "@/components/admin/TopPlansModeToggle";
import { RecurringCard } from "@/components/admin/RecurringCard";
import {
  useDashboardKpis,
  useDashboardSeries,
  useMonthlyRecurring,
  useSubscriptionStatus,
  useTopPlans,
} from "@/hooks/use-dashboard";
import {
  fetchDashboardKpis,
  fetchDashboardSeries,
  fetchMonthlyRecurring,
  fetchSubscriptionStatus,
  fetchTopPlans,
  type PeriodKey,
  type TopPlansMode,
} from "@/services/dashboard";
import { formatBRL, formatNumber } from "@/lib/format";

const PERIOD_LABEL: Record<PeriodKey, string> = {
  today: "Hoje",
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
  "90d": "Últimos 90 dias",
  month: "Este mês",
  custom: "Período personalizado",
};

const PERIOD_ENUM = z.enum(["today", "7d", "30d", "90d", "month", "custom"]);
const DEFAULT_PERIOD: PeriodKey = "30d";

// Mantemos `period` opcional no schema para distinguir "URL sem filtro"
// (primeira entrada / volta da sidebar) de "URL com filtro explícito"
// (compartilhamento, back/forward). Quando opcional, beforeLoad consegue
// detectar a ausência e redirecionar para o último valor persistido.
const searchSchema = z.object({
  period: fallback(PERIOD_ENUM, DEFAULT_PERIOD).optional(),
});

export const Route = createFileRoute("/admin/_shell/dashboard")({
  validateSearch: zodValidator(searchSchema),
  // Restaura o último período escolhido quando o usuário volta à rota
  // sem `?period=` na URL (ex.: clicou em "Dashboard" na sidebar depois
  // de visitar /admin/usuarios). Se houver período na URL, ele vence.
  beforeLoad: ({ search }) => {
    if (!search.period) {
      const persisted = readPersistedDashboardPeriod() ?? DEFAULT_PERIOD;
      throw redirect({
        to: "/admin/dashboard",
        search: { period: persisted },
        replace: true,
      });
    }
  },
  // Warm up React Query cache so the page renders instantly when navigated to.
  // Sidebar preload calls router.preloadRoute, which in turn runs this loader.
  loaderDeps: ({ search }) => ({ period: search.period ?? DEFAULT_PERIOD }),
  loader: ({ context: { queryClient }, deps: { period } }) => {
    const p = period as PeriodKey;
    // Sincroniza o storage com o que está na URL — assim links compartilhados
    // ou navegação back/forward também atualizam o "último período escolhido".
    persistDashboardPeriod(p);
    void queryClient.prefetchQuery({
      queryKey: ["dashboard", "kpis", p],
      queryFn: () => fetchDashboardKpis(p),
      staleTime: 60_000,
    });
    void queryClient.prefetchQuery({
      queryKey: ["dashboard", "series", p],
      queryFn: () => fetchDashboardSeries(p),
      staleTime: 60_000,
    });
    void queryClient.prefetchQuery({
      queryKey: ["dashboard", "subscription-status", p],
      queryFn: () => fetchSubscriptionStatus(p),
      staleTime: 60_000,
    });
    void queryClient.prefetchQuery({
      queryKey: ["dashboard", "top-plans", p, "sales"],
      queryFn: () => fetchTopPlans(p, "sales"),
      staleTime: 60_000,
    });
    void queryClient.prefetchQuery({
      queryKey: ["dashboard", "monthly-recurring"],
      queryFn: () => fetchMonthlyRecurring(),
      staleTime: 60_000,
    });
  },
  // Never show a pending UI for this route — keep current screen visible until ready.
  pendingComponent: () => null,
  component: DashboardPage,
});

function DashboardPage() {
  // beforeLoad garante que `period` sempre estará presente após o redirect.
  // O fallback aqui é só para satisfazer o type narrow (search.period é
  // marcado como opcional no schema).
  const search = Route.useSearch();
  const period: PeriodKey = search.period ?? DEFAULT_PERIOD;
  const periodLabel = PERIOD_LABEL[period];

  const kpis = useDashboardKpis(period);

  // Filtros independentes por card — começam sincronizados com o filtro
  // global, mas o usuário pode ajustar cada um separadamente sem afetar
  // os demais cards nem os KPIs do topo.
  const [seriesPeriod, setSeriesPeriod] = useState<PeriodKey>(period);
  const [subsPeriod, setSubsPeriod] = useState<PeriodKey>(period);
  const [topPlansPeriod, setTopPlansPeriod] = useState<PeriodKey>(period);
  const [topPlansMode, setTopPlansMode] = useState<TopPlansMode>("sales");

  const series = useDashboardSeries(seriesPeriod);
  const subs = useSubscriptionStatus(subsPeriod);
  const topPlans = useTopPlans(topPlansPeriod, topPlansMode);
  const recurring = useMonthlyRecurring();

  const k = kpis.data;
  const noPaidSale = !k || k.sales_count === 0;

  return (
    <div className="space-y-6">
      {/* Header card */}
      <header className="overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-gold">
              Visão geral
            </div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              Dashboard
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
              Vendas, planos, recorrência, usuários, idiomas e integrações em uma visão executiva.
            </p>
          </div>
          <PeriodFilter value={period} options={["custom"]} />
        </div>
      </header>

      {/* KPI grid */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={<DollarSign className="h-5 w-5" />}
          label="Receita do período"
          value={formatBRL(k?.revenue_amount ?? 0)}
          detail={`${formatNumber(k?.sales_count ?? 0)} vendas · ${periodLabel}`}
        />
        <KpiCard
          icon={<Trophy className="h-5 w-5" />}
          label="Plano campeão"
          value={
            <span className="text-base font-semibold sm:text-lg">
              {noPaidSale
                ? "Nenhuma venda paga encontrada no período."
                : (k?.top_plan_name ?? "—")}
            </span>
          }
          detail="Mais vendido no mês"
        />
        <KpiCard
          icon={<Repeat className="h-5 w-5" />}
          label="MRR"
          value={formatBRL(k?.mrr_amount ?? 0)}
          detail={`${formatNumber(k?.active_subscriptions ?? 0)} assinaturas ativas`}
        />
        <KpiCard
          icon={<Receipt className="h-5 w-5" />}
          label="Ticket médio"
          value={formatBRL(k?.avg_ticket ?? 0)}
          detail={`${formatNumber(k?.users_count ?? 1)} usuários cadastrados`}
        />
      </section>

      {/* Row 2: revenue chart + subscription donut */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card
          title="Receita e volume de vendas"
          subtitle={PERIOD_LABEL[seriesPeriod]}
          className="lg:col-span-2"
          actions={<LocalPeriodFilter value={seriesPeriod} onChange={setSeriesPeriod} />}
        >
          <RevenueChart data={series.data ?? []} />
        </Card>
        <Card
          title="Status das assinaturas"
          subtitle={PERIOD_LABEL[subsPeriod]}
          actions={<LocalPeriodFilter value={subsPeriod} onChange={setSubsPeriod} />}
        >
          <SubscriptionDonut data={subs.data ?? []} />
        </Card>
      </section>

      {/* Row 3: top plans + recurring */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card
          title="Planos que mais venderam"
          subtitle={PERIOD_LABEL[topPlansPeriod]}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <TopPlansModeToggle value={topPlansMode} onChange={setTopPlansMode} />
              <LocalPeriodFilter value={topPlansPeriod} onChange={setTopPlansPeriod} />
            </div>
          }
        >
          <TopPlansCard data={topPlans.data ?? []} mode={topPlansMode} />
        </Card>
        <Card title="Recorrência dos meses" subtitle="Últimos meses">
          <RecurringCard data={recurring.data ?? []} />
        </Card>
      </section>
    </div>
  );
}

function Card({
  title,
  subtitle,
  children,
  className,
  actions,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6 ${className ?? ""}`}
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
