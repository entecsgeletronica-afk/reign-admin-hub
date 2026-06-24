import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Users,
  UserCheck,
  UserPlus,
  ShieldOff,
  Wallet,
  Plus,
  Download,
  Search,
  Lock,
  Unlock,
  X,
  Sparkles,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { KpiCard } from "@/components/admin/KpiCard";
import { ProductPicker } from "@/components/admin/ProductPicker";
import {
  useUsersSummary,
  useInfiniteAdminUsers,
  useFlatInfiniteUsers,
} from "@/hooks/use-users";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  createUserAccount,
  fetchUsers,
  fetchUsersSummary,
  type UserStatus,
  type AdminUser,
} from "@/services/users";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  useAdminAllProducts,
  useAdminUserEntitlements,
  useGrantEntitlement,
  useRevokeEntitlement,
} from "@/services/admin-entitlements";
import {
  listSections,
  type CatalogSectionRow,
  type CatalogProductRow,
} from "@/services/catalog-db";
import { listVariations, type Variation } from "@/services/variations";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

export const Route = createFileRoute("/admin/_shell/usuarios")({
  pendingComponent: () => null,
  component: UsuariosPage,
});

const STATUS_FILTERS: { key: UserStatus | "all"; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "active", label: "Ativos" },
  { key: "pending", label: "Pendente" },
  { key: "canceled", label: "Cancelados" },
  { key: "no_plan", label: "Sem plano" },
];

const STATUS_LABEL: Record<UserStatus, string> = {
  active: "Ativo",
  pending: "Pendente",
  canceled: "Cancelado",
  no_plan: "Sem plano",
};

function UsuariosPage() {
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<UserStatus | "all">("all");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);

  // Debounce do termo de busca para evitar recálculo a cada tecla.
  const debouncedSearch = useDebouncedValue(search, 250);

  const summary = useUsersSummary();
  const usersQ = useInfiniteAdminUsers({
    search: debouncedSearch,
    status,
    pageSize: 40,
  });
  const { items: users, total } = useFlatInfiniteUsers(usersQ.data);
  const selected = users.find((u) => u.id === selectedId) ?? null;

  // Derived KPIs from the visible (loaded) list — refletem o que está em memória.
  const kpiActive = users.filter((u) => u.status === "active").length;
  const kpiBlocked = users.filter((u) => u.access_blocked).length;
  const kpiRevenue = users.reduce((sum, u) => sum + u.total_paid, 0);

  // Para exportar CSV usamos a lista filtrada COMPLETA (não só as páginas
  // virtualizadas) — reusa o cache "por sessão" da query base.
  const qc = useQueryClient();
  async function handleExportCsv() {
    const allFiltered = await qc.ensureQueryData<AdminUser[]>({
      queryKey: ["admin", "users", status, debouncedSearch],
      queryFn: () => fetchUsers({ search: debouncedSearch, status }),
      staleTime: Infinity,
      gcTime: Infinity,
    });
    if (allFiltered.length === 0) {
      toast.info("Nenhum usuário para exportar.");
      return;
    }
    const header = ["id", "nome", "email", "status", "plano", "total_pago_brl", "acesso", "criado_em"];
    const rows = allFiltered.map((u) => [
      u.id,
      escapeCsv(u.name),
      escapeCsv(u.email),
      STATUS_LABEL[u.status],
      escapeCsv(u.plan_name ?? ""),
      (u.total_paid / 100).toFixed(2).replace(".", ","),
      u.access_blocked ? "Bloqueado" : "Liberado",
      new Date(u.created_at).toISOString(),
    ]);
    const csv = [header.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `usuarios_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exportados ${allFiltered.length} usuário(s).`);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-gold">
              Customer operations
            </div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              Usuários
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
              Gerencie assinaturas, acesso, senhas e histórico de pagamentos em uma visão premium.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-2 rounded-full bg-gold px-4 py-2 text-sm font-semibold text-gold-foreground shadow transition hover:brightness-105"
            >
              <Plus className="h-4 w-4" /> Criar usuário
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={usersQ.isLoading || total === 0}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-card disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-4 w-4" /> Exportar CSV
            </button>
          </div>
        </div>
      </header>

      {/* KPIs */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={<Users className="h-5 w-5" />}
          label="Usuários filtrados"
          value={total}
          detail={
            usersQ.isLoading
              ? "Atualizando lista"
              : `${summary.data?.total_filtered ?? total} cadastrados no total`
          }
        />
        <KpiCard
          icon={<UserCheck className="h-5 w-5" />}
          label="Assinaturas ativas"
          value={kpiActive}
          detail="Com acesso liberado"
        />
        <KpiCard
          icon={<ShieldOff className="h-5 w-5" />}
          label="Acessos bloqueados"
          value={kpiBlocked}
          detail="Usuários sem liberação"
        />
        <KpiCard
          icon={<Wallet className="h-5 w-5" />}
          label="Receita exibida"
          value={formatBRL(kpiRevenue)}
          detail="Total pago na lista"
        />
      </section>

      {/* List + Detail */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome, email ou ID"
                className="h-10 w-full rounded-full border border-border bg-surface-elevated pl-9 pr-9 text-sm text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-none"
              />
              {search !== debouncedSearch && (
                <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
            </div>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as UserStatus | "all")}
            >
              <SelectTrigger
                className="h-10 w-auto min-w-[180px] rounded-full border-border bg-surface-elevated px-4 text-sm font-medium text-foreground shadow-none focus:border-gold focus:ring-0 focus:ring-offset-0"
              >
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent
                className="rounded-2xl border-border bg-card p-1 shadow-lg"
                position="popper"
                sideOffset={6}
              >
                {[
                  { v: "all", l: "Todos os status" },
                  { v: "active", l: "Ativos" },
                  { v: "pending", l: "Pendentes" },
                  { v: "canceled", l: "Cancelados" },
                  { v: "no_plan", l: "Sem plano" },
                ].map((opt) => (
                  <SelectItem
                    key={opt.v}
                    value={opt.v}
                    className="cursor-pointer rounded-xl px-3 py-2 text-sm font-medium text-foreground transition-colors focus:bg-gold focus:text-gold-foreground data-[state=checked]:bg-gold/15 data-[state=checked]:text-gold"
                  >
                    {opt.l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {STATUS_FILTERS.map((s) => {
              const active = s.key === status;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setStatus(s.key)}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
                    active
                      ? "border-gold bg-gold text-gold-foreground"
                      : "border-border bg-surface-elevated text-muted-foreground hover:text-foreground",
                  )}
                >
                  {s.label}
                </button>
              );
            })}
          </div>

          <div className="mt-5 rounded-2xl border border-border bg-surface-elevated">
            {usersQ.isLoading ? (
              <div className="flex flex-col items-center justify-center p-12 text-center text-sm text-muted-foreground">
                <Loader2 className="mb-4 h-8 w-8 animate-spin text-gold/60" />
                <p>Carregando usuários...</p>
                <p className="mt-1 text-xs opacity-60">Isso pode levar alguns segundos dependendo da quantidade de dados.</p>
              </div>
            ) : usersQ.isError ? (
              <div className="flex flex-col items-center justify-center p-12 text-center text-sm">
                <div className="mb-4 rounded-full bg-rose-500/10 p-3 text-rose-500">
                  <X className="h-6 w-6" />
                </div>
                <p className="font-semibold text-rose-400">Erro ao carregar usuários</p>
                <p className="mt-1 text-xs text-rose-400/70">{(usersQ.error as Error)?.message}</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-4 border-rose-500/20 hover:bg-rose-500/10"
                  onClick={() => usersQ.refetch()}
                >
                  Tentar novamente
                </Button>
              </div>
            ) : users.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center text-sm text-muted-foreground">
                <div className="mb-4 rounded-full bg-surface-elevated p-3">
                  <Search className="h-6 w-6 opacity-20" />
                </div>
                <p>Nenhum usuário encontrado</p>
                <p className="mt-1 text-xs opacity-60">Tente ajustar seus filtros ou termo de busca.</p>
              </div>
            ) : (
              <VirtualUserList
                users={users}
                total={total}
                selectedId={selectedId}
                onSelect={setSelectedId}
                hasNextPage={usersQ.hasNextPage ?? false}
                isFetchingNextPage={usersQ.isFetchingNextPage}
                onLoadMore={() => {
                  if (usersQ.hasNextPage && !usersQ.isFetchingNextPage) {
                    void usersQ.fetchNextPage();
                  }
                }}
              />
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
          {selected ? (
            <div className="flex flex-col">
              {/* Header — gradient strip with avatar/identity */}
              <div className="border-b border-border bg-gradient-to-br from-gold/10 via-card to-card p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gold/15 text-gold ring-1 ring-gold/30">
                      <span className="text-base font-bold">
                        {(selected.name || selected.email || "?").charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-lg font-semibold text-foreground">
                        {selected.name || "—"}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {selected.email || "Sem e-mail"}
                      </div>
                    </div>
                  </div>
                  <StatusBadge status={selected.status} />
                </div>
                <div className="mt-4 flex justify-end">
                  <Link
                    to="/admin/usuarios/$userId"
                    params={{ userId: selected.id }}
                    className="inline-flex items-center gap-1 rounded-full bg-gold px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gold-foreground shadow transition hover:brightness-105"
                  >
                    Ver perfil completo
                  </Link>
                </div>
              </div>

              {/* Body */}
              <div className="space-y-5 p-5 sm:p-6">
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <DetailRow label="Plano" value={selected.plan_name ?? "—"} />
                  <DetailRow label="Total pago" value={formatBRL(selected.total_paid)} />
                  <DetailRow
                    label="Acesso"
                    value={selected.access_blocked ? "Bloqueado" : "Liberado"}
                  />
                  <DetailRow
                    label="Cadastrado em"
                    value={new Date(selected.created_at).toLocaleDateString("pt-BR")}
                  />
                </dl>

                <EntitlementsManager userId={selected.id} />
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-[420px] flex-col items-center justify-center gap-2 p-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-elevated text-muted-foreground">
                <Users className="h-5 w-5" />
              </div>
              <div className="text-sm font-medium text-foreground">Nenhum usuário selecionado</div>
              <div className="text-xs text-muted-foreground">
                Selecione um usuário na lista para ver os detalhes.
              </div>
            </div>
          )}
        </div>
      </section>

      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

/**
 * Lista virtualizada de usuários com infinite scroll.
 * - Renderiza apenas os itens visíveis (rowVirtualizer).
 * - Carrega a próxima página quando o usuário se aproxima do fim
 *   (chamando `onLoadMore`), sem refetch de rede — usa o cache em memória.
 */
function VirtualUserList({
  users,
  total,
  selectedId,
  onSelect,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: {
  users: AdminUser[];
  total: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
}) {
  const parentRef = React.useRef<HTMLDivElement | null>(null);
  // +1 quando há mais páginas para acomodar a linha "Carregando mais…".
  const itemCount = users.length + (hasNextPage ? 1 : 0);

  const rowVirtualizer = useVirtualizer({
    count: itemCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 8,
  });

  // Quando os últimos itens entram no viewport, dispara o carregamento.
  const virtualItems = rowVirtualizer.getVirtualItems();
  React.useEffect(() => {
    const last = virtualItems[virtualItems.length - 1];
    if (!last) return;
    if (last.index >= users.length - 1 && hasNextPage && !isFetchingNextPage) {
      onLoadMore();
    }
  }, [virtualItems, users.length, hasNextPage, isFetchingNextPage, onLoadMore]);

  return (
    <div
      ref={parentRef}
      className="h-[560px] overflow-auto"
      style={{ contain: "strict" }}
    >
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualItems.map((virtualRow) => {
          const isLoaderRow = virtualRow.index >= users.length;
          const u = isLoaderRow ? null : users[virtualRow.index];
          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={rowVirtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`,
              }}
              className="border-b border-border last:border-b-0"
            >
              {isLoaderRow ? (
                <div className="flex items-center justify-center gap-2 px-4 py-3 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Carregando mais…
                </div>
              ) : u ? (
                <UserListItem
                  user={u}
                  isActive={u.id === selectedId}
                  onSelect={() => onSelect(u.id)}
                />
              ) : null}
            </div>
          );
        })}
      </div>
      {!hasNextPage && users.length > 0 && (
        <div className="px-4 py-2 text-center text-[10px] uppercase tracking-wider text-muted-foreground">
          {users.length} de {total}
        </div>
      )}
    </div>
  );
}

function UserListItem({
  user,
  isActive,
  onSelect,
}: {
  user: AdminUser;
  isActive: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      className={cn(
        "flex w-full items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-card",
        isActive && "bg-card",
      )}
    >
      <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">
        <div className="truncate text-sm font-semibold text-foreground">
          {user.name || user.email || "Sem nome"}
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {user.email || `ID ${user.id.slice(0, 8)}…`}
        </div>
      </button>
      <StatusBadge status={user.status} />
      <Link
        to="/admin/usuarios/$userId"
        params={{ userId: user.id }}
        className="rounded-full border border-border bg-surface-elevated px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground transition hover:border-gold hover:text-gold"
      >
        Abrir
      </Link>
    </div>
  );
}

function CreateUserDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [selectedProductIds, setSelectedProductIds] = React.useState<Set<string>>(
    new Set(),
  );

  const productsQ = useAdminAllProducts();
  const sectionsQ = useQuery({
    queryKey: ["admin", "catalog-sections"],
    queryFn: () => listSections({ includeInactive: true }),
    enabled: open,
  });
  const variationsQ = useQuery({
    queryKey: ["admin", "variations"],
    queryFn: () => listVariations(),
    enabled: open,
  });
  const grantEntitlement = useGrantEntitlement();

  const allProducts = React.useMemo(
    () => (productsQ.data ?? []).filter((p) => p.is_published),
    [productsQ.data],
  );
  const sections = sectionsQ.data ?? [];
  const variations = variationsQ.data ?? [];

  // Agrupa: Área de Membros (variation) → Seção → Produtos.
  // Fica explícito para o admin a quais áreas o usuário terá acesso e
  // permite liberar tudo de uma área, uma seção, ou produtos individuais.
  type GroupedTree = Map<
    string | null, // variation_id (null = sem área)
    Map<string | null, typeof allProducts> // section_id (null = sem seção)
  >;
  const tree = React.useMemo<GroupedTree>(() => {
    const t: GroupedTree = new Map();
    for (const p of allProducts) {
      const vKey = p.variation_id ?? null;
      const sKey = p.section_id ?? null;
      if (!t.has(vKey)) t.set(vKey, new Map());
      const sMap = t.get(vKey)!;
      if (!sMap.has(sKey)) sMap.set(sKey, []);
      sMap.get(sKey)!.push(p);
    }
    return t;
  }, [allProducts]);

  const allIds = React.useMemo(() => allProducts.map((p) => p.id), [allProducts]);
  const allSelected =
    allIds.length > 0 && allIds.every((id) => selectedProductIds.has(id));

  function toggleProduct(id: string) {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelectedProductIds(allSelected ? new Set() : new Set(allIds));
  }
  function toggleIds(ids: string[]) {
    if (ids.length === 0) return;
    const allOn = ids.every((id) => selectedProductIds.has(id));
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (allOn) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  }

  function reset() {
    setEmail("");
    setPassword("");
    setDisplayName("");
    setIsAdmin(false);
    setSelectedProductIds(new Set());
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error("Informe e-mail e senha.");
      return;
    }
    if (password.length < 6) {
      toast.error("A senha precisa de pelo menos 6 caracteres.");
      return;
    }
    setSubmitting(true);
    try {
      const { userId } = await createUserAccount({ email, password, displayName, isAdmin });
      // Grant selected products if user was created
      const ids = Array.from(selectedProductIds);
      let granted = 0;
      const failures: { productId: string; message: string }[] = [];
      if (userId && ids.length > 0) {
        for (const productId of ids) {
          try {
            await grantEntitlement.mutateAsync({ userId, productId });
            granted += 1;
          } catch (err) {
            const message =
              err instanceof Error ? err.message : String(err ?? "erro desconhecido");
            console.error("[admin/usuarios] grantEntitlement falhou", {
              userId,
              productId,
              error: err,
            });
            failures.push({ productId, message });
          }
        }
      }
      const failed = failures.length;
      const firstReason = failures[0]?.message;
      toast.success("Usuário criado com sucesso.", {
        description:
          ids.length === 0
            ? "Nenhum produto liberado manualmente."
            : failed
              ? `${granted} produto(s) liberado(s), ${failed} falharam${
                  firstReason ? ` — motivo: ${firstReason}` : "."
                }`
              : `${granted} produto(s) liberado(s).`,
      });
      reset();
      onOpenChange(false);
      // Invalida apenas o que foi afetado: lista de usuários, summary
      // (KPIs do topo) e o dashboard (KPI "Usuários cadastrados").
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      qc.invalidateQueries({ queryKey: ["admin", "users-summary"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar usuário.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold-soft text-gold">
              <UserPlus className="h-5 w-5" aria-hidden="true" />
            </span>
            <span>Criar novo usuário</span>
          </DialogTitle>
          <DialogDescription className="whitespace-nowrap overflow-hidden text-ellipsis">
            Defina os acessos e libere produtos manualmente.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="cu-email">E-mail*</Label>
              <Input
                id="cu-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@exemplo.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cu-name">Nome de exibição</Label>
              <Input
                id="cu-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Como o usuário será chamado"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cu-password">Senha temporária*</Label>
              <Input
                id="cu-password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label
                htmlFor="cu-admin"
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-surface-elevated p-3 transition hover:border-gold/50"
              >
                <Checkbox
                  id="cu-admin"
                  checked={isAdmin}
                  onCheckedChange={(v) => setIsAdmin(v === true)}
                  className="mt-0.5"
                />
                <div className="space-y-0.5">
                  <span className="block text-sm font-medium text-foreground">
                    Criar como administrador
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    Concede acesso total ao painel administrativo. Use apenas
                    para sua equipe.
                  </span>
                </div>
              </label>
            </div>
          </div>


          {/* Products picker */}
          <div className="space-y-2 rounded-xl border border-border bg-surface-elevated p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label className="text-sm font-semibold">Liberar acessos</Label>
                <p className="text-[11px] text-muted-foreground">
                  Escolha as áreas de membros, seções ou produtos que este
                  usuário poderá acessar.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-card px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {selectedProductIds.size} selecionado(s)
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant={allSelected ? "secondary" : "outline"}
                  onClick={toggleAll}
                  disabled={allProducts.length === 0}
                >
                  {allSelected ? "Limpar tudo" : "Selecionar todos"}
                </Button>
              </div>
            </div>

            <ScrollArea className="h-[320px] rounded-lg border border-border bg-card/40">
              <div className="space-y-4 p-3">
                {productsQ.isLoading || sectionsQ.isLoading || variationsQ.isLoading ? (
                  <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Carregando produtos…
                  </div>
                ) : allProducts.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    Nenhum produto publicado encontrado.
                  </div>
                ) : (
                  <VariationProductTree
                    variations={variations}
                    sections={sections}
                    tree={tree}
                    selectedIds={selectedProductIds}
                    onToggleProduct={toggleProduct}
                    onToggleIds={toggleIds}
                  />
                )}
              </div>
            </ScrollArea>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando…
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Criar usuário
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ProductCheckRow({
  id,
  title,
  checked,
  onToggle,
}: {
  id: string;
  title: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      htmlFor={`prod-${id}`}
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-xs transition-colors hover:bg-surface-elevated",
        checked && "border-gold/40 bg-gold/5",
      )}
    >
      <Checkbox
        id={`prod-${id}`}
        checked={checked}
        onCheckedChange={onToggle}
      />
      <span className="truncate text-foreground">{title}</span>
    </label>
  );
}

/**
 * Árvore Área de Membros → Seção → Produto, com toggles agregados em cada nível.
 *
 * - Cada Área (variation) mostra quantos produtos têm liberados e um botão
 *   "Liberar área" que marca/desmarca tudo dentro dela de uma vez.
 * - Cada Seção dentro da área tem o mesmo botão para a sub-coleção.
 * - Produtos sem área ou sem seção aparecem em grupos próprios ao final.
 */
function VariationProductTree({
  variations,
  sections,
  tree,
  selectedIds,
  onToggleProduct,
  onToggleIds,
}: {
  variations: Variation[];
  sections: CatalogSectionRow[];
  tree: Map<string | null, Map<string | null, CatalogProductRow[]>>;
  selectedIds: Set<string>;
  onToggleProduct: (id: string) => void;
  onToggleIds: (ids: string[]) => void;
}) {
  const variationOrder: (string | null)[] = [
    ...variations.map((v) => v.id),
    null,
  ].filter((vKey) => tree.has(vKey));

  return (
    <div className="space-y-4">
      {variationOrder.map((vKey) => {
        const sMap = tree.get(vKey);
        if (!sMap || sMap.size === 0) return null;
        const variation = vKey ? variations.find((v) => v.id === vKey) : null;
        const variationLabel = variation?.title ?? "Sem área de membros";

        const allInVariation: CatalogProductRow[] = [];
        sMap.forEach((items) => allInVariation.push(...items));
        const variationIds = allInVariation.map((p) => p.id);
        const variationCount = variationIds.filter((id) =>
          selectedIds.has(id),
        ).length;
        const variationAllOn =
          variationIds.length > 0 &&
          variationIds.every((id) => selectedIds.has(id));

        const sectionKeysOrdered: (string | null)[] = [
          ...sections.filter((s) => sMap.has(s.id)).map((s) => s.id),
          ...(sMap.has(null) ? [null] : []),
        ];

        return (
          <div
            key={vKey ?? "no-variation"}
            className="rounded-lg border border-border/60 bg-card/60 p-3"
          >
            <div className="flex items-center justify-between gap-3 pb-2">
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gold">
                  Área de membros
                </div>
                <div className="truncate text-sm font-semibold text-foreground">
                  {variationLabel}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {variationCount}/{variationIds.length} produto(s) liberado(s)
                </div>
              </div>
              <button
                type="button"
                onClick={() => onToggleIds(variationIds)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors",
                  variationAllOn
                    ? "border-gold bg-gold text-gold-foreground"
                    : "border-gold/40 text-gold hover:bg-gold/10",
                )}
              >
                {variationAllOn ? "Remover área" : "Liberar área"}
              </button>
            </div>

            <div className="space-y-3">
              {sectionKeysOrdered.map((sKey) => {
                const items = sMap.get(sKey) ?? [];
                if (items.length === 0) return null;
                const section = sKey
                  ? sections.find((s) => s.id === sKey)
                  : null;
                const sectionTitle = section?.title ?? "Sem seção";
                const sectionIds = items.map((p) => p.id);
                const allOn = sectionIds.every((id) => selectedIds.has(id));

                return (
                  <div key={sKey ?? "no-section"} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {sectionTitle}
                      </div>
                      <button
                        type="button"
                        onClick={() => onToggleIds(sectionIds)}
                        className="text-[10px] font-semibold uppercase tracking-wider text-gold hover:underline"
                      >
                        {allOn ? "Remover seção" : "Liberar seção"}
                      </button>
                    </div>
                    <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                      {items.map((p) => (
                        <ProductCheckRow
                          key={p.id}
                          id={p.id}
                          title={p.title}
                          checked={selectedIds.has(p.id)}
                          onToggle={() => onToggleProduct(p.id)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function escapeCsv(value: string): string {
  if (value == null) return "";
  const needsQuotes = /[;"\n\r]/.test(value);
  const safe = value.replace(/"/g, '""');
  return needsQuotes ? `"${safe}"` : safe;
}

function EntitlementsManager({ userId }: { userId: string }) {
  const entitlementsQ = useAdminUserEntitlements(userId);
  const productsQ = useAdminAllProducts();
  const grant = useGrantEntitlement();
  const revoke = useRevokeEntitlement();

  const entitlements = entitlementsQ.data ?? [];
  const allProducts = productsQ.data ?? [];

  const ownedActiveIds = React.useMemo(
    () => new Set(entitlements.filter((e) => e.status === "active").map((e) => e.product_id)),
    [entitlements],
  );
  const productById = React.useMemo(
    () => new Map(allProducts.map((p) => [p.id, p])),
    [allProducts],
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

  return (
    <div className="rounded-2xl border border-border bg-surface-elevated p-4">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-gold" />
        <h3 className="text-sm font-bold text-foreground">Acesso a produtos</h3>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Libere ou revogue manualmente o acesso deste usuário a produtos do catálogo.
      </p>

      {/* Grant new */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
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

      {/* Current entitlements list */}
      <div className="space-y-2">
        <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Liberações atuais ({entitlements.length})
        </div>
        {entitlementsQ.isLoading ? (
          <div className="rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground">
            Carregando…
          </div>
        ) : entitlements.length === 0 ? (
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5" />
            Nenhum produto liberado ainda.
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {entitlements.map((ent) => {
              const product = productById.get(ent.product_id);
              return (
                <li key={ent.id} className="flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-foreground">
                      {product?.title ?? "Produto removido"}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                      <span className="rounded-full bg-surface-elevated px-1.5 py-0.5 font-semibold uppercase tracking-wider">
                        {ent.source_type}
                      </span>
                      <SourceStatusPill status={ent.status} />
                      <span>{new Date(ent.granted_at).toLocaleDateString("pt-BR")}</span>
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

function SourceStatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-emerald-500/15 text-emerald-300",
    expired: "bg-amber-500/15 text-amber-300",
    cancelled: "bg-rose-500/15 text-rose-300",
    refunded: "bg-rose-500/15 text-rose-300",
  };
  return (
    <span
      className={cn(
        "rounded-full px-1.5 py-0.5 font-semibold uppercase tracking-wider",
        styles[status] ?? "bg-muted/30 text-muted-foreground",
      )}
    >
      {status}
    </span>
  );
}

function StatusBadge({ status }: { status: UserStatus }) {
  const styles: Record<UserStatus, string> = {
    active: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    pending: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    canceled: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    no_plan: "bg-muted/30 text-muted-foreground border-border",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        styles[status],
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface-elevated p-3">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-foreground">{value}</dd>
    </div>
  );
}
