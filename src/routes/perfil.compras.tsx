// "Minhas Compras" — lists products the user has unlocked (entitlements),
// joined with their order history. Empty state guides them to /perfil/explorar.

import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ShoppingBag, Search, Package, Calendar, ArrowRight, Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/integrations/supabase/auth-context";
import {
  joinOwnedProducts,
  useAllProducts,
  useUserEntitlements,
  useUserOrders,
  type OwnedProduct,
} from "@/services/purchases";
import { resolveProductCover } from "@/lib/catalog-covers";
import { cn } from "@/lib/utils";
import { useI18n } from "@/integrations/i18n/i18n-context";

export const Route = createFileRoute("/perfil/compras")({
  head: () => ({
    meta: [
      { title: "Minhas compras — Reino das Cores" },
      {
        name: "description",
        content:
          "Veja todos os produtos e histórias já liberados para sua conta.",
      },
    ],
  }),
  component: ComprasPage,
});

type StatusFilter = "all" | "active" | "expired" | "cancelled" | "refunded";
type SortKey = "recent" | "oldest" | "name";

function ComprasPage() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const { locale } = useI18n();

  const { data: entitlements = [], isLoading: entLoading } =
    useUserEntitlements(userId);
  const { data: orders = [], isLoading: ordLoading } = useUserOrders(userId);
  const { data: products = [], isLoading: prodLoading } = useAllProducts();

  const owned = React.useMemo(
    () => joinOwnedProducts(entitlements, products, orders),
    [entitlements, products, orders],
  );

  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<StatusFilter>("all");
  const [sort, setSort] = React.useState<SortKey>("recent");

  const filtered = React.useMemo(() => {
    let list = owned;
    if (status !== "all") {
      list = list.filter((o) => o.entitlement.status === status);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((o) =>
        o.product.title.toLowerCase().includes(q),
      );
    }
    list = [...list].sort((a, b) => {
      if (sort === "name") return a.product.title.localeCompare(b.product.title);
      const ta = new Date(a.entitlement.granted_at).getTime();
      const tb = new Date(b.entitlement.granted_at).getTime();
      return sort === "oldest" ? ta - tb : tb - ta;
    });
    return list;
  }, [owned, status, search, sort]);

  const totalUnlocked = owned.length;
  const totalActive = owned.filter((o) => o.entitlement.status === "active").length;
  const lastPurchase = owned[0]?.entitlement.granted_at ?? null;
  const fmtDate = (iso: string | null) =>
    iso ? new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(iso)) : "—";

  const isLoading = entLoading || ordLoading || prodLoading;

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-8 px-4 py-8 sm:px-6 lg:px-10">
      <header>
        <div className="inline-flex items-center gap-2 rounded-full bg-gold/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-gold">
          <ShoppingBag className="h-3.5 w-3.5" />
          Sua biblioteca
        </div>
        <h1 className="mt-3 text-3xl font-bold text-foreground">Minhas compras</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Veja tudo o que já foi liberado para sua conta.
        </p>
      </header>

      {/* Resumo superior */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard
          icon={<Package className="h-5 w-5" />}
          label="Produtos adquiridos"
          value={totalUnlocked}
        />
        <SummaryCard
          icon={<Sparkles className="h-5 w-5" />}
          label="Histórias liberadas"
          value={totalActive}
        />
        <SummaryCard
          icon={<Calendar className="h-5 w-5" />}
          label="Última compra"
          value={fmtDate(lastPurchase)}
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome…"
            className="w-full rounded-xl border border-border bg-surface-elevated py-2.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          className="rounded-xl border border-border bg-surface-elevated px-3 py-2.5 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-gold"
        >
          <option value="all">Todos status</option>
          <option value="active">Ativas</option>
          <option value="expired">Expiradas</option>
          <option value="cancelled">Canceladas</option>
          <option value="refunded">Reembolsadas</option>
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="rounded-xl border border-border bg-surface-elevated px-3 py-2.5 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-gold"
        >
          <option value="recent">Mais recentes</option>
          <option value="oldest">Mais antigos</option>
          <option value="name">Nome (A-Z)</option>
        </select>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-48 animate-pulse rounded-2xl border border-border bg-surface"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState hasAny={owned.length > 0} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((o) => (
            <PurchaseCard key={o.entitlement.id} item={o} locale={locale} />
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center gap-2 text-gold">
        {icon}
        <span className="text-[11px] font-bold uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className="mt-3 text-2xl font-bold text-foreground">{value}</div>
    </div>
  );
}

const STATUS_LABELS: Record<string, { text: string; cls: string }> = {
  active: { text: "Ativa", cls: "bg-emerald-500/10 text-emerald-400" },
  expired: { text: "Expirada", cls: "bg-amber-500/10 text-amber-400" },
  cancelled: { text: "Cancelada", cls: "bg-rose-500/10 text-rose-400" },
  refunded: { text: "Reembolsada", cls: "bg-rose-500/10 text-rose-400" },
};

function PurchaseCard({
  item,
  locale,
}: {
  item: OwnedProduct;
  locale: string;
}) {
  const navigate = useNavigate();
  const cover = resolveProductCover(item.product);
  const status = STATUS_LABELS[item.entitlement.status] ?? {
    text: item.entitlement.status,
    cls: "bg-muted text-muted-foreground",
  };
  const fmtDate = new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
    new Date(item.entitlement.granted_at),
  );
  const isActive = item.entitlement.status === "active";

  function open() {
    if (item.product.external_url) {
      window.open(item.product.external_url, "_blank", "noopener,noreferrer");
      return;
    }
    navigate({ to: "/produto/$slug", params: { slug: item.product.slug } });
  }

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface transition hover:-translate-y-0.5 hover:shadow-xl">
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-surface-elevated">
        {cover ? (
          <img
            src={cover}
            alt={item.product.title}
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        ) : null}
        <span
          className={cn(
            "absolute right-3 top-3 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
            status.cls,
          )}
        >
          {status.text}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-1 text-base font-bold text-foreground">
          {item.product.title}
        </h3>
        {item.product.subtitle && (
          <p className="line-clamp-1 text-xs text-muted-foreground">
            {item.product.subtitle}
          </p>
        )}
        <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          Liberado em {fmtDate}
        </div>
        <button
          type="button"
          onClick={open}
          disabled={!isActive}
          className={cn(
            "mt-4 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition",
            isActive
              ? "bg-gold text-gold-foreground hover:-translate-y-0.5"
              : "cursor-not-allowed bg-surface-elevated text-muted-foreground",
          )}
        >
          {isActive ? "Acessar" : "Indisponível"}
          {isActive && <ArrowRight className="h-4 w-4" />}
        </button>
      </div>
    </article>
  );
}

function EmptyState({ hasAny }: { hasAny: boolean }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface px-6 py-16 text-center">
      <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-gold/10 text-gold">
        <ShoppingBag className="h-6 w-6" />
      </div>
      <h2 className="text-lg font-bold text-foreground">
        {hasAny
          ? "Nenhuma compra encontrada com esses filtros"
          : "Você ainda não tem compras"}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        {hasAny
          ? "Ajuste os filtros ou a busca para ver outras compras."
          : "Quando você adquirir uma história, ela aparece aqui automaticamente."}
      </p>
      <Link
        to="/perfil/explorar"
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-semibold text-gold-foreground transition-transform hover:-translate-y-0.5"
      >
        <Sparkles className="h-4 w-4" />
        Desbloquear mais histórias
      </Link>
    </div>
  );
}
