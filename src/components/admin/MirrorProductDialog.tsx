// Modal premium de espelhamento de produtos / seções entre áreas de membros.
//
// Fluxo:
//  1. Admin escolhe entre "Produtos individuais" ou "Seção inteira".
//  2. Seleciona área de membros de origem (≠ área atual).
//  3a. Produtos individuais → filtra por seção, marca múltiplos produtos,
//      escolhe seção destino.
//  3b. Seção inteira       → escolhe seção origem, escolhe seção destino
//      (existente ou criar nova com o mesmo nome).
//  4. Cria os espelhos: nascem ocultos + bloqueados, sem oferta/plano.

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Boxes, Layers, Check, Link2, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { listVariations, type Variation } from "@/services/variations";
import {
  createMirrorProducts,
  createMirrorSection,
  listProductsByVariation,
  listSectionsByVariation,
} from "@/services/catalog-mirror";
import type { CatalogSectionRow } from "@/services/catalog-db";
import { resolveProductCover } from "@/lib/catalog-covers";

type Mode = "product" | "section";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Área (variação) atual — destino padrão dos espelhos. */
  destinationVariationId: string;
  /** Seções da área atual (destino). */
  destinationSections: CatalogSectionRow[];
}

export function MirrorProductDialog({
  open,
  onOpenChange,
  destinationVariationId,
  destinationSections,
}: Props) {
  const qc = useQueryClient();
  const [mode, setMode] = React.useState<Mode>("product");

  // Comum aos dois fluxos.
  const [sourceAreaId, setSourceAreaId] = React.useState<string>("");
  const [destSectionId, setDestSectionId] = React.useState<string>("");

  // Fluxo A — produtos individuais.
  const [sourceFilterSectionId, setSourceFilterSectionId] = React.useState<string>("all");
  const [selectedProductIds, setSelectedProductIds] = React.useState<Set<string>>(
    new Set(),
  );

  // Fluxo B — seção inteira.
  const [sourceSectionId, setSourceSectionId] = React.useState<string>("");

  // Reset ao fechar.
  React.useEffect(() => {
    if (!open) {
      setMode("product");
      setSourceAreaId("");
      setDestSectionId("");
      setSourceFilterSectionId("all");
      setSelectedProductIds(new Set());
      setSourceSectionId("");
    }
  }, [open]);

  // Áreas (todas, exceto a atual).
  const { data: areas = [], isLoading: loadingAreas } = useQuery({
    queryKey: ["mirror", "variations"],
    queryFn: () => listVariations(),
    enabled: open,
  });
  const sourceAreas = React.useMemo(
    () => (areas as Variation[]).filter((a) => a.id !== destinationVariationId),
    [areas, destinationVariationId],
  );

  // Seções da área origem (filtros + fluxo B).
  const { data: sourceSections = [] } = useQuery({
    queryKey: ["mirror", "sections", sourceAreaId],
    queryFn: () => listSectionsByVariation(sourceAreaId),
    enabled: open && !!sourceAreaId,
  });

  // Produtos da área origem (fluxo A).
  const { data: sourceProducts = [], isLoading: loadingProducts } = useQuery({
    queryKey: ["mirror", "products", sourceAreaId],
    queryFn: () => listProductsByVariation(sourceAreaId),
    enabled: open && !!sourceAreaId && mode === "product",
  });

  const filteredProducts = React.useMemo(() => {
    if (sourceFilterSectionId === "all") return sourceProducts;
    return sourceProducts.filter((p) => p.section_id === sourceFilterSectionId);
  }, [sourceProducts, sourceFilterSectionId]);

  // Mutations.
  const mirrorProductsMut = useMutation({
    mutationFn: () =>
      createMirrorProducts({
        sourceProductIds: Array.from(selectedProductIds),
        destinationVariationId,
        destinationSectionId: destSectionId,
        mirrorType: "product",
      }),
    onSuccess: (rows) => {
      toast.success(
        `${rows.length} ${rows.length === 1 ? "espelho criado" : "espelhos criados"} com sucesso.`,
      );
      qc.invalidateQueries({ queryKey: ["catalog", "products"] });
      qc.invalidateQueries({ queryKey: ["catalog", "sections"] });
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message ?? "Falha ao criar espelhos."),
  });

  const mirrorSectionMut = useMutation({
    mutationFn: () =>
      createMirrorSection({
        sourceSectionId,
        destinationVariationId,
        destinationSectionId: destSectionId,
      }),
    onSuccess: (res) => {
      toast.success(
        `Seção espelhada com ${res.products.length} ${res.products.length === 1 ? "produto" : "produtos"}.`,
      );
      qc.invalidateQueries({ queryKey: ["catalog", "products"] });
      qc.invalidateQueries({ queryKey: ["catalog", "sections"] });
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message ?? "Falha ao espelhar seção."),
  });

  const isPending = mirrorProductsMut.isPending || mirrorSectionMut.isPending;

  // Validação do botão principal.
  const canSubmit = (() => {
    if (!sourceAreaId || !destSectionId) return false;
    if (mode === "product") return selectedProductIds.size > 0;
    return !!sourceSectionId;
  })();

  function toggleProduct(id: string) {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSubmit() {
    if (!canSubmit) return;
    if (mode === "product") mirrorProductsMut.mutate();
    else mirrorSectionMut.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-gold" />
            Espelhar produto existente
          </DialogTitle>
          <DialogDescription>
            Crie uma cópia leve de produtos ou seções de outra área. O conteúdo
            principal será compartilhado com o original, mas nome, capa, seção,
            oferta, plano e publicação serão configurados nesta área.
          </DialogDescription>
        </DialogHeader>

        {/* Etapa 1 — escolha do tipo */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ModeCard
            active={mode === "product"}
            onClick={() => setMode("product")}
            icon={<Boxes className="h-5 w-5" />}
            title="Produtos individuais"
            description="Escolha um ou mais produtos."
          />
          <ModeCard
            active={mode === "section"}
            onClick={() => setMode("section")}
            icon={<Layers className="h-5 w-5" />}
            title="Seção inteira"
            description="Espelhe todos os produtos de uma seção."
          />
        </div>

        {/* Etapa 2 — área origem */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Área de membros de origem">
            <Select
              value={sourceAreaId}
              onValueChange={(v) => {
                setSourceAreaId(v);
                setSourceFilterSectionId("all");
                setSelectedProductIds(new Set());
                setSourceSectionId("");
              }}
              disabled={loadingAreas}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a área..." />
              </SelectTrigger>
              <SelectContent>
                {sourceAreas.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.title}
                  </SelectItem>
                ))}
                {sourceAreas.length === 0 && !loadingAreas && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    Nenhuma outra área disponível.
                  </div>
                )}
              </SelectContent>
            </Select>
          </Field>

          {mode === "product" ? (
            <Field label="Filtrar por seção (opcional)">
              <Select
                value={sourceFilterSectionId}
                onValueChange={setSourceFilterSectionId}
                disabled={!sourceAreaId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas as seções" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as seções</SelectItem>
                  {sourceSections.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : (
            <Field label="Seção a espelhar">
              <Select
                value={sourceSectionId}
                onValueChange={setSourceSectionId}
                disabled={!sourceAreaId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a seção..." />
                </SelectTrigger>
                <SelectContent>
                  {sourceSections.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
        </div>

        {/* Lista de produtos (fluxo A) */}
        {mode === "product" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Produtos para espelhar</span>
              <span className="text-xs text-muted-foreground">
                {selectedProductIds.size} selecionados
              </span>
            </div>
            <div className="max-h-72 overflow-y-auto rounded-xl border border-border bg-surface p-2">
              {!sourceAreaId ? (
                <EmptyState message="Selecione uma área de origem para listar os produtos." />
              ) : loadingProducts ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : filteredProducts.length === 0 ? (
                <EmptyState message="Nenhum produto encontrado nesta área." />
              ) : (
                <ul className="space-y-1">
                  {filteredProducts.map((p) => {
                    const checked = selectedProductIds.has(p.id);
                    const cover = resolveProductCover(p as never);
                    const sectionName = sourceSections.find(
                      (s) => s.id === p.section_id,
                    )?.title;
                    return (
                      <li
                        key={p.id}
                        className={cn(
                          "flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-muted/40",
                          checked && "bg-muted/40",
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleProduct(p.id)}
                        />
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-muted">
                          {cover ? (
                            <img
                              src={cover}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">
                            {p.title}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            {sectionName ?? "Sem seção"} · {p.product_type}
                          </div>
                        </div>
                        {p.is_published ? (
                          <span className="text-[10px] text-emerald-400">
                            publicado
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">
                            oculto
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* Resumo (fluxo B) */}
        {mode === "section" && sourceSectionId && (
          <SectionSummary
            sectionId={sourceSectionId}
            allProducts={sourceProducts}
          />
        )}

        {/* Seção destino */}
        <Field label="Seção destino (nesta área)">
          <Select value={destSectionId} onValueChange={setDestSectionId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a seção destino" />
            </SelectTrigger>
            <SelectContent>
              {mode === "section" && (
                <SelectItem value="__new__">
                  + Criar nova seção com o mesmo nome
                </SelectItem>
              )}
              {destinationSections.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {/* Alerta */}
        <div className="flex gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            Os espelhos nascem <b>ocultos e bloqueados</b>. Após criar, configure
            uma oferta própria no menu <b>Oferta</b> e publique quando estiver pronto.
          </span>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || isPending}
            className="gap-2"
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            <Link2 className="h-4 w-4" />
            Criar espelhos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ----------------- helpers ----------------- */

function ModeCard({
  active,
  onClick,
  icon,
  title,
  description,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex items-start gap-3 rounded-xl border bg-surface p-4 text-left transition-all",
        active
          ? "border-gold bg-gold/5 shadow-[0_0_0_1px_var(--gold)]"
          : "border-border hover:border-muted-foreground/40",
      )}
    >
      <div
        className={cn(
          "mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg",
          active ? "bg-gold/15 text-gold" : "bg-muted text-muted-foreground",
        )}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      {active && (
        <Check className="h-4 w-4 text-gold" aria-hidden />
      )}
    </button>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-24 items-center justify-center text-center text-xs text-muted-foreground">
      {message}
    </div>
  );
}

function SectionSummary({
  sectionId,
  allProducts,
}: {
  sectionId: string;
  allProducts: Array<{
    id: string;
    section_id: string | null;
    cover_image_url: string | null;
    thumbnail_url: string | null;
    title: string;
  }>;
}) {
  // Carrega produtos da seção quando o usuário ainda não fez essa query
  // (fluxo B não dispara listProductsByVariation por padrão).
  const { data = [] } = useQuery({
    queryKey: ["mirror", "section-summary", sectionId],
    queryFn: async () => {
      const { supabaseAny } = await import("@/integrations/supabase/client");
      const { data, error } = await supabaseAny
        .from("catalog_products")
        .select("id, title, cover_image_url, thumbnail_url, product_type")
        .eq("section_id", sectionId);
      if (error) throw error;
      return data as Array<{
        id: string;
        title: string;
        cover_image_url: string | null;
        thumbnail_url: string | null;
        product_type: string;
      }>;
    },
    enabled: !!sectionId,
  });

  const products = data.length ? data : allProducts.filter((p) => p.section_id === sectionId);
  const types = Array.from(new Set(products.map((p: { product_type?: string }) => p.product_type).filter(Boolean)));

  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">Resumo da seção</span>
        <span className="text-muted-foreground">
          {products.length} {products.length === 1 ? "produto" : "produtos"}
        </span>
      </div>
      {types.length > 0 && (
        <div className="mt-1 text-[10px] text-muted-foreground">
          Tipos: {types.join(", ")}
        </div>
      )}
      <div className="mt-2 flex gap-1">
        {products.slice(0, 6).map((p) => {
          const cover = resolveProductCover(p as never);
          return (
            <div
              key={p.id}
              className="h-12 w-9 overflow-hidden rounded bg-muted"
              title={p.title}
            >
              {cover ? (
                <img src={cover} alt="" className="h-full w-full object-cover" />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
