import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image as ImageIcon, Layers, Lock, Search, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { PageHeader } from "@/components/admin/PageHeader";
import { DrawingPagesEditor } from "@/components/admin/DrawingPagesEditor";
import { ConfirmDeleteDialog } from "@/components/admin/ConfirmDeleteDialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useVariations } from "@/integrations/variations/variation-context";
import {
  deleteProduct,
  listProducts,
  type CatalogProductRow,
} from "@/services/catalog-db";

const searchSchema = z.object({
  productId: z.string().optional(),
});

export const Route = createFileRoute("/admin/_shell/biblioteca/desenhos")({
  component: DrawingsLibraryPage,
  validateSearch: (s) => searchSchema.parse(s),
});

function DrawingsLibraryPage() {
  const { activeId } = useVariations();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { productId } = Route.useSearch();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<CatalogProductRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<CatalogProductRow | null>(null);

  const productsQuery = useQuery({
    queryKey: ["catalog", "products", "drawing", activeId],
    queryFn: () => listProducts({ includeUnpublished: true, variationId: activeId }),
  });

  const deleteMut = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalog", "products"] });
      toast.success("Desenho excluído");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const drawingProducts = useMemo(() => {
    const list = (productsQuery.data ?? []).filter((p) => p.product_type === "drawing");
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (p) =>
        p.title.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q),
    );
  }, [productsQuery.data, search]);

  // Auto-open editor when ?productId=... is in the URL
  useEffect(() => {
    if (!productId || selected) return;
    const list = productsQuery.data ?? [];
    const match = list.find((p) => p.id === productId && p.product_type === "drawing");
    if (match) setSelected(match);
  }, [productId, productsQuery.data, selected]);

  if (selected) {
    return (
      <DrawingPagesEditor
        product={selected}
        onBack={() => {
          setSelected(null);
          // clear deep-link param + refresh in case story_id was just attached
          navigate({ to: "/admin/biblioteca/desenhos", search: {} });
          productsQuery.refetch();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Biblioteca"
        title="Mini App de Desenhos"
        description="Edite as páginas de pintura de cada produto da sua área de membros."
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar produto…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Badge variant="secondary" className="gap-1.5">
          <Layers className="h-3 w-3" />
          {drawingProducts.length} produto(s) de desenho
        </Badge>
      </div>

      {productsQuery.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-44 animate-pulse rounded-lg border border-border bg-card"
            />
          ))}
        </div>
      ) : drawingProducts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card/40 p-12 text-center">
          <Sparkles className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
          <h3 className="text-base font-medium text-foreground">
            Nenhum produto de desenho ainda
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Crie um produto do tipo “Desenho” em <strong>Catálogo</strong> e ele
            aparecerá aqui.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {drawingProducts.map((p) => (
            <div
              key={p.id}
              className="group relative overflow-hidden rounded-lg border border-border bg-card text-left transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg"
            >
              <button
                type="button"
                onClick={() => setSelected(p)}
                className="block w-full text-left"
              >
                <div className="relative aspect-[4/3] w-full bg-muted">
                  {p.cover_image_url ? (
                    <img
                      src={p.cover_image_url}
                      alt={p.title}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
                    </div>
                  )}
                  {p.is_locked && (
                    <Badge className="absolute right-2 top-2 gap-1 bg-background/90 backdrop-blur">
                      <Lock className="h-3 w-3" /> Bloqueado
                    </Badge>
                  )}
                  {!p.is_published && (
                    <Badge
                      variant="outline"
                      className="absolute left-2 top-2 bg-background/90 backdrop-blur"
                    >
                      Rascunho
                    </Badge>
                  )}
                </div>
                <div className="space-y-1 p-3 pr-12">
                  <p className="truncate text-sm font-medium text-foreground">{p.title}</p>
                  <p className="truncate text-xs text-muted-foreground">/{p.slug}</p>
                </div>
              </button>

              {/* Botão de exclusão — segue o mesmo padrão do catálogo */}
              <Button
                size="icon"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmDelete(p);
                }}
                title="Excluir desenho"
                className="absolute bottom-2 right-2 h-8 w-8 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <ConfirmDeleteDialog
        open={!!confirmDelete}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title="Excluir desenho?"
        confirmText={confirmDelete?.title ?? ""}
        actionLabel="Excluir desenho"
        loading={deleteMut.isPending}
        description={
          <>
            <p>
              Essa ação removerá <strong>"{confirmDelete?.title}"</strong> da biblioteca de
              desenhos e do catálogo. As páginas de pintura associadas também serão perdidas.
            </p>
            <p className="text-amber-300">
              Esta operação é permanente e não pode ser desfeita.
            </p>
          </>
        }
        onConfirm={() => {
          if (confirmDelete) deleteMut.mutate(confirmDelete.id);
          setConfirmDelete(null);
        }}
      />
    </div>
  );
}
