import * as React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Wallet,
  ShoppingBag,
  ShieldCheck,
  Lock,
  Unlock,
  X,
  Sparkles,
  CalendarClock,
  Receipt,
  Crown,
  Mail,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/format";
import {
  useUserDetail,
  useUserOrdersAdmin,
  useUserEntitlementsAdmin,
  useToggleAdminRole,
} from "@/services/user-detail";
import {
  useAdminAllProducts,
  useGrantEntitlement,
  useRevokeEntitlement,
  useUpdateEntitlementStatus,
} from "@/services/admin-entitlements";
import type { CatalogProductRow } from "@/services/catalog-db";
import type { EntitlementRow } from "@/services/purchases";
import { ProductPicker } from "@/components/admin/ProductPicker";

type ProductMap = Map<string, CatalogProductRow>;

export const Route = createFileRoute("/admin/_shell/usuarios/$userId")({
  component: UserDetailPage,
});

function UserDetailPage() {
  const { userId } = Route.useParams();
  const navigate = useNavigate();
  const detailQ = useUserDetail(userId);
  const ordersQ = useUserOrdersAdmin(userId);
  const entitlementsQ = useUserEntitlementsAdmin(userId);
  const productsQ = useAdminAllProducts();
  const toggleAdmin = useToggleAdminRole();

  const detail = detailQ.data;
  const profile = detail?.profile ?? null;
  const isAdmin = !!detail?.isAdmin;

  const allProducts = productsQ.data ?? [];
  const productById = React.useMemo<ProductMap>(
    () => new Map(allProducts.map((p) => [p.id, p])),
    [allProducts],
  );

  const entitlements = entitlementsQ.data ?? [];
  const orders = ordersQ.data ?? [];
  const sales = detail?.sales ?? [];
  const subs = detail?.subscriptions ?? [];

  const activeSub = subs.find((s) => s.status === "active") ?? subs[0] ?? null;

  async function handleToggleAdmin() {
    const next = !isAdmin;
    if (
      !window.confirm(
        next
          ? "Promover este usuário a administrador?"
          : "Remover privilégios de administrador deste usuário?",
      )
    )
      return;
    try {
      await toggleAdmin.mutateAsync({ userId, makeAdmin: next });
      toast.success(next ? "Usuário promovido a admin." : "Privilégios removidos.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao atualizar role.");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <button
          type="button"
          onClick={() => navigate({ to: "/admin/usuarios" })}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-3.5 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-card hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar para usuários
        </button>
      </div>

      {/* Header */}
      <header className="overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-border bg-surface-elevated text-2xl font-bold text-foreground">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt=""
                  className="h-full w-full rounded-2xl object-cover"
                />
              ) : (
                (profile?.display_name?.[0] ??
                  profile?.purchase_email?.[0] ??
                  "?").toUpperCase()
              )}
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-gold">
                User profile
              </div>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {profile?.display_name || profile?.purchase_email || "Usuário"}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Mail className="h-3 w-3" /> {profile?.purchase_email ?? "—"}
                </span>
                <span className="inline-flex items-center gap-1">
                  <UserIcon className="h-3 w-3" /> ID: {userId.slice(0, 8)}…
                </span>
                {isAdmin && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 font-semibold text-gold">
                    <Crown className="h-3 w-3" /> Admin
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleToggleAdmin}
              disabled={toggleAdmin.isPending}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold shadow transition disabled:opacity-50",
                isAdmin
                  ? "border border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
                  : "bg-gold text-gold-foreground hover:brightness-105",
              )}
            >
              <ShieldCheck className="h-4 w-4" />
              {isAdmin ? "Remover admin" : "Promover a admin"}
            </button>
          </div>
        </div>
      </header>

      {/* KPIs */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          icon={<Wallet className="h-4 w-4" />}
          label="Total pago"
          value={formatBRL(detail?.totalsPaid ?? 0)}
        />
        <KpiTile
          icon={<Receipt className="h-4 w-4" />}
          label="Vendas registradas"
          value={String(sales.length)}
        />
        <KpiTile
          icon={<Sparkles className="h-4 w-4" />}
          label="Produtos liberados"
          value={String(
            entitlements.filter((e) => e.status === "active").length,
          )}
        />
        <KpiTile
          icon={<CalendarClock className="h-4 w-4" />}
          label="Plano atual"
          value={activeSub?.plan_name ?? "—"}
          subtitle={activeSub ? statusLabel(activeSub.status) : "Sem assinatura"}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Entitlements management */}
        <Card title="Acesso a produtos">
          <EntitlementsManager userId={userId} productById={productById} />
        </Card>

        {/* Subscriptions */}
        <Card title="Assinaturas">
          {subs.length === 0 ? (
            <Empty>Sem assinaturas registradas.</Empty>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border bg-surface-elevated">
              {subs.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-foreground">
                      {s.plan_name ?? "Plano —"}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Início: {fmtDate(s.started_at)} · Fim:{" "}
                      {fmtDate(s.current_period_end)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-foreground">
                      {formatBRL(s.amount_cents / 100)}
                    </div>
                    <SubStatusPill status={s.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      {/* Sales timeline */}
      <Card title="Histórico de vendas (sales)">
        {sales.length === 0 ? (
          <Empty>Nenhuma venda registrada para este usuário.</Empty>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-surface-elevated">
            <table className="w-full text-sm">
              <thead className="bg-card text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <Th>Data</Th>
                  <Th>Plano</Th>
                  <Th>Provider</Th>
                  <Th>Status</Th>
                  <Th>Sale ID</Th>
                  <Th className="text-right">Valor</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sales.map((s) => (
                  <tr key={s.id} className="hover:bg-card">
                    <Td>{fmtDate(s.sold_at)}</Td>
                    <Td>{s.plan_name ?? "—"}</Td>
                    <Td className="capitalize">{s.provider}</Td>
                    <Td>
                      <SaleStatusPill status={s.status} />
                    </Td>
                    <Td className="font-mono text-[11px] text-muted-foreground">
                      {s.external_sale_id ?? "—"}
                    </Td>
                    <Td className="text-right font-semibold">
                      {formatBRL(s.amount_cents / 100)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Orders timeline */}
      <Card title="Pedidos (user_orders)">
        {orders.length === 0 ? (
          <Empty>Nenhum pedido registrado.</Empty>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface-elevated">
            {orders.map((o) => {
              const product = o.product_id ? productById.get(o.product_id) : null;
              return (
                <li
                  key={o.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <ShoppingBag className="h-3.5 w-3.5 text-muted-foreground" />
                      <div className="truncate text-sm font-semibold text-foreground">
                        {product?.title ?? "Produto removido"}
                      </div>
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {fmtDate(o.purchased_at)} ·{" "}
                      <span className="capitalize">{o.payment_provider}</span>
                      {o.order_number ? ` · #${o.order_number}` : ""}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-foreground">
                      {formatBRL(o.amount_cents / 100)}
                    </div>
                    <SaleStatusPill status={o.purchase_status} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Entitlement history with status edit */}
      <Card title="Histórico de liberações (entitlements)">
        {entitlements.length === 0 ? (
          <Empty>Sem liberações registradas.</Empty>
        ) : (
          <EntitlementHistory
            userId={userId}
            rows={entitlements}
            productById={productById}
          />
        )}
      </Card>
    </div>
  );
}

// ---------- Sub-components ----------

function EntitlementsManager({
  userId,
  productById,
}: {
  userId: string;
  productById: ProductMap;
}) {
  const entitlementsQ = useUserEntitlementsAdmin(userId);
  const productsQ = useAdminAllProducts();
  const grant = useGrantEntitlement();
  const revoke = useRevokeEntitlement();

  const entitlements = entitlementsQ.data ?? [];
  const allProducts = productsQ.data ?? [];

  const ownedActiveIds = React.useMemo(
    () =>
      new Set(
        entitlements.filter((e) => e.status === "active").map((e) => e.product_id),
      ),
    [entitlements],
  );
  const lockedProducts = React.useMemo(
    () => allProducts.filter((p) => p.is_published && !ownedActiveIds.has(p.id)),
    [allProducts, ownedActiveIds],
  );

  const [selectProductId, setSelectProductId] = React.useState<string>("");

  async function handleGrant() {
    if (!selectProductId) {
      toast.error("Selecione um produto para liberar.");
      return;
    }
    try {
      await grant.mutateAsync({ userId, productId: selectProductId });
      toast.success("Produto liberado para o usuário.");
      setSelectProductId("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao liberar produto.");
    }
  }

  async function handleRevoke(entitlementId: string, title: string) {
    if (!window.confirm(`Remover acesso de "${title}"?`)) return;
    try {
      await revoke.mutateAsync({ entitlementId, userId });
      toast.success("Acesso removido.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao remover acesso.");
    }
  }

  const activeEnts = entitlements.filter((e) => e.status === "active");

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="flex-1">
          <ProductPicker
            value={selectProductId}
            onChange={setSelectProductId}
            options={lockedProducts.map((p) => ({ id: p.id, title: p.title }))}
            disabled={productsQ.isLoading || lockedProducts.length === 0}
            placeholder={
              lockedProducts.length === 0
                ? "Usuário já tem acesso a tudo"
                : "Selecione um produto…"
            }
            emptyText="Nenhum produto encontrado"
          />
        </div>
        <button
          type="button"
          onClick={handleGrant}
          disabled={!selectProductId || grant.isPending}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gold px-4 py-2 text-sm font-bold text-gold-foreground transition hover:brightness-105 disabled:opacity-50"
        >
          <Unlock className="h-4 w-4" />
          {grant.isPending ? "Liberando…" : "Liberar"}
        </button>
      </div>

      <div>
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Liberações ativas ({activeEnts.length})
        </div>
        {activeEnts.length === 0 ? (
          <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-elevated p-3 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5" />
            Nenhum produto liberado.
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface-elevated">
            {activeEnts.map((ent) => {
              const product = productById.get(ent.product_id);
              return (
                <li key={ent.id} className="flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-foreground">
                      {product?.title ?? "Produto removido"}
                    </div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">
                      <span className="rounded-full bg-card px-1.5 py-0.5 font-semibold uppercase tracking-wider">
                        {ent.source_type}
                      </span>{" "}
                      {fmtDate(ent.granted_at)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRevoke(ent.id, product?.title ?? "produto")}
                    disabled={revoke.isPending}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-50"
                    aria-label="Remover acesso"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function EntitlementHistory({
  userId,
  rows,
  productById,
}: {
  userId: string;
  rows: EntitlementRow[];
  productById: ProductMap;
}) {
  const updateStatus = useUpdateEntitlementStatus();

  async function handleStatus(
    id: string,
    status: "active" | "expired" | "cancelled" | "refunded",
  ) {
    try {
      await updateStatus.mutateAsync({ entitlementId: id, userId, status });
      toast.success("Status atualizado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao atualizar.");
    }
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface-elevated">
      <table className="w-full text-sm">
        <thead className="bg-card text-[11px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <Th>Produto</Th>
            <Th>Origem</Th>
            <Th>Código / Oferta</Th>
            <Th>Status</Th>
            <Th>Liberado em</Th>
            <Th>Expira</Th>
            <Th className="text-right">Ações</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => {
            const product = productById.get(r.product_id);
            return (
              <tr key={r.id} className="hover:bg-card">
                <Td className="max-w-[220px] truncate font-semibold text-foreground">
                  {product?.title ?? "—"}
                </Td>
                <Td className="capitalize">{r.source_type}</Td>
                <Td className="font-mono text-[11px] text-muted-foreground">
                  {r.external_purchase_id ?? "—"}
                </Td>
                <Td>
                  <SaleStatusPill status={r.status} />
                </Td>
                <Td>{fmtDate(r.granted_at)}</Td>
                <Td>{r.expires_at ? fmtDate(r.expires_at) : "—"}</Td>
                <Td className="text-right">
                  <select
                    value={r.status}
                    onChange={(e) =>
                      handleStatus(
                        r.id,
                        e.target.value as
                          | "active"
                          | "expired"
                          | "cancelled"
                          | "refunded",
                      )
                    }
                    disabled={updateStatus.isPending}
                    className="h-8 rounded-lg border border-border bg-card px-2 text-xs text-foreground focus:border-gold focus:outline-none"
                  >
                    <option value="active">Ativo</option>
                    <option value="expired">Expirado</option>
                    <option value="cancelled">Cancelado</option>
                    <option value="refunded">Reembolsado</option>
                  </select>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

function KpiTile({
  icon,
  label,
  value,
  subtitle,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-[11px] font-semibold uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className="mt-2 text-xl font-bold text-foreground">{value}</div>
      {subtitle && (
        <div className="mt-0.5 text-xs text-muted-foreground">{subtitle}</div>
      )}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface-elevated p-6 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        "px-3 py-2 text-left font-semibold",
        className,
      )}
    >
      {children}
    </th>
  );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-3 py-2 text-foreground", className)}>{children}</td>;
}

function SaleStatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    paid: "bg-emerald-500/15 text-emerald-300",
    approved: "bg-emerald-500/15 text-emerald-300",
    completed: "bg-emerald-500/15 text-emerald-300",
    active: "bg-emerald-500/15 text-emerald-300",
    pending: "bg-amber-500/15 text-amber-300",
    refunded: "bg-rose-500/15 text-rose-300",
    cancelled: "bg-rose-500/15 text-rose-300",
    canceled: "bg-rose-500/15 text-rose-300",
    expired: "bg-amber-500/15 text-amber-300",
  };
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        styles[status] ?? "bg-muted/30 text-muted-foreground",
      )}
    >
      {status}
    </span>
  );
}

function SubStatusPill({ status }: { status: string }) {
  return <SaleStatusPill status={status} />;
}

function statusLabel(s: string): string {
  const m: Record<string, string> = {
    active: "Ativa",
    canceled: "Cancelada",
    cancelled: "Cancelada",
    pending: "Pendente",
    expired: "Expirada",
  };
  return m[s] ?? s;
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}
