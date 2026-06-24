import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Copy,
  Power,
  PowerOff,
  Package,
} from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { VariationSwitcher } from "@/components/admin/VariationSwitcher";
import { ConfirmDeleteDialog } from "@/components/admin/ConfirmDeleteDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useActiveVariation } from "@/integrations/variations/variation-context";
import { useOffers } from "@/hooks/use-offers";
import {
  deleteOffer,
  duplicateOffer,
  setOfferStatus,
  type CommercialOfferFull,
  type OfferSaleMode,
  type OfferStatus,
} from "@/services/offers";
import { OfferIcon } from "@/components/admin/OfferIcon";
import { cn } from "@/lib/utils";
import { OfferFormPanel } from "@/components/admin/offers/OfferFormPanel";
import perfectPayLogo from "@/assets/perfectpay-logo.jpeg";

export const Route = createFileRoute("/admin/_shell/ofertas")({
  component: OffersPage,
});

type Tab = "list" | "new";

const SALE_MODE_LABEL: Record<OfferSaleMode, string> = {
  one_time: "Venda única",
  monthly: "Assinatura mensal",
  yearly: "Assinatura anual",
  lifetime: "Vitalício",
  custom: "Personalizado",
};


function OffersPage() {
  const variation = useActiveVariation();
  const [tab, setTab] = React.useState<Tab>("list");
  const [editingId, setEditingId] = React.useState<string | null>(null);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Comercial"
        title="Ofertas"
        description={`Gerencie as ofertas comerciais que liberam produtos automaticamente após a confirmação de pagamento. Você está editando a área "${variation.title}".`}
        actions={<VariationSwitcher />}
      />

      <div className="flex flex-wrap gap-2 rounded-2xl border border-border bg-surface p-1">
        <TabButton
          active={tab === "list"}
          onClick={() => {
            setTab("list");
            setEditingId(null);
          }}
        >
          Minhas Ofertas
        </TabButton>
        <TabButton
          active={tab === "new"}
          onClick={() => {
            setTab("new");
            setEditingId(null);
          }}
        >
          <Plus className="mr-1 inline h-3.5 w-3.5" /> Nova oferta
        </TabButton>
      </div>

      {tab === "list" ? (
        <OffersList
          variationId={variation.id}
          onEdit={(id) => {
            setEditingId(id);
            setTab("new");
          }}
        />
      ) : (
        <OfferFormPanel
          variationId={variation.id}
          offerId={editingId}
          onSaved={() => {
            setTab("list");
            setEditingId(null);
          }}
          onCancel={() => {
            setTab("list");
            setEditingId(null);
          }}
        />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl px-4 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-gold text-gold-foreground shadow-sm"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function OffersList({
  variationId,
  onEdit,
}: {
  variationId: string;
  onEdit: (id: string) => void;
}) {
  const qc = useQueryClient();
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<OfferStatus | "all">("all");
  const [confirmDelete, setConfirmDelete] = React.useState<CommercialOfferFull | null>(null);

  const { data: offers = [], isLoading } = useOffers({
    variationId,
    search,
    gateway: "perfectpay",
    status,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["offers"] });

  const deleteMut = useMutation({
    mutationFn: deleteOffer,
    onSuccess: () => {
      invalidate();
      toast.success("Oferta excluída");
      setConfirmDelete(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const duplicateMut = useMutation({
    mutationFn: duplicateOffer,
    onSuccess: () => {
      invalidate();
      toast.success("Oferta duplicada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, next }: { id: string; next: OfferStatus }) =>
      setOfferStatus(id, next),
    onSuccess: () => {
      invalidate();
      toast.success("Status atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome da oferta…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-muted/40 px-3">
          <img
            src={perfectPayLogo}
            alt="Perfect Pay"
            className="h-5 w-5 rounded-sm object-cover"
          />
          <span className="text-sm font-medium text-foreground">Perfect Pay</span>
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as OfferStatus | "all")}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="active">Ativa</SelectItem>
            <SelectItem value="inactive">Inativa</SelectItem>
            <SelectItem value="draft">Rascunho</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-surface-elevated text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Gateway</th>
              <th className="px-4 py-3 text-left">Nome da entrega</th>
              <th className="px-4 py-3 text-left">Modalidade</th>
              <th className="px-4 py-3 text-left">Códigos</th>
              <th className="px-4 py-3 text-left">Libera</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  Carregando…
                </td>
              </tr>
            ) : offers.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                  <img
                    src={perfectPayLogo}
                    alt="Perfect Pay"
                    className="mx-auto mb-3 h-12 w-12 rounded-xl object-cover shadow-sm ring-1 ring-border"
                  />
                  <p className="font-medium text-foreground">Nenhuma oferta cadastrada</p>
                  <p className="mt-1 text-xs">
                    Clique em <span className="text-foreground">+ Nova oferta</span> para
                    criar a primeira oferta comercial no <span className="font-medium text-foreground">Perfect Pay</span>.
                  </p>
                </td>
              </tr>
            ) : (
              offers.map((o) => (
                <tr key={o.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                      <img
                        src={perfectPayLogo}
                        alt="Perfect Pay"
                        className="h-3.5 w-3.5 rounded-sm object-cover"
                      />
                      Perfect Pay
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">{o.offer_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {SALE_MODE_LABEL[o.sale_mode]}
                  </td>
                  <td className="px-4 py-3">
                    {o.codes.length === 0 ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {o.codes.slice(0, 2).map((c) => (
                          <span
                            key={c.id}
                            className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]"
                          >
                            {c.code}
                          </span>
                        ))}
                        {o.codes.length > 2 && (
                          <span className="text-[10px] text-muted-foreground">
                            +{o.codes.length - 2}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Package className="h-3 w-3" />
                      {o.products.length} produto{o.products.length === 1 ? "" : "s"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={o.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Editar"
                        onClick={() => onEdit(o.id)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Duplicar"
                        disabled={duplicateMut.isPending}
                        onClick={() => duplicateMut.mutate(o.id)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title={o.status === "active" ? "Desativar" : "Ativar"}
                        disabled={toggleMut.isPending}
                        onClick={() =>
                          toggleMut.mutate({
                            id: o.id,
                            next: o.status === "active" ? "inactive" : "active",
                          })
                        }
                      >
                        {o.status === "active" ? (
                          <PowerOff className="h-4 w-4" />
                        ) : (
                          <Power className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Excluir"
                        onClick={() => setConfirmDelete(o)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDeleteDialog
        open={!!confirmDelete}
        onOpenChange={(v) => !v && setConfirmDelete(null)}
        title="Excluir oferta?"
        confirmText={confirmDelete?.offer_name ?? ""}
        actionLabel="Excluir oferta"
        loading={deleteMut.isPending}
        description={
          <p>
            A oferta <strong>{confirmDelete?.offer_name}</strong> será removida definitivamente. Os
            produtos vinculados não serão afetados, mas a oferta deixará de liberar acessos
            automaticamente.
          </p>
        }
        onConfirm={() => confirmDelete && deleteMut.mutate(confirmDelete.id)}
      />
    </div>
  );
}

function StatusPill({ status }: { status: OfferStatus }) {
  if (status === "active") {
    return (
      <span className="inline-flex rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300">
        Ativa
      </span>
    );
  }
  if (status === "draft") {
    return (
      <span className="inline-flex rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-300">
        Rascunho
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
      Inativa
    </span>
  );
}
