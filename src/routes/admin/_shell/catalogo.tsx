import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { resolveProductCover } from "@/lib/catalog-covers";
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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/admin/PageHeader";
import { ConfirmDeleteDialog } from "@/components/admin/ConfirmDeleteDialog";
import { CreateProductWizard } from "@/components/admin/CreateProductWizard";
import { MirrorProductDialog } from "@/components/admin/MirrorProductDialog";
import { DrawingPagesEditor } from "@/components/admin/DrawingPagesEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Pencil,
  Trash2,
  Lock,
  ArrowUp,
  ArrowDown,
  Upload,
  Star,
  Brush,
  Video,
  Download,
  FileText,
  Settings2,
  Eye,
  Link2,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import {
  createProduct,
  createSection,
  deleteProduct,
  deleteSection,
  duplicateSection,
  updateHomeSettings,
  updateProduct,
  updateSection,
  uploadCatalogCover,
  type CatalogProductRow,
  type CatalogSectionRow,
  type HomeSettingsRow,
  type ProductType,
} from "@/services/catalog-db";
import {
  useCatalogProducts,
  useCatalogSections,
  useHomeSettings,
} from "@/hooks/use-catalog-db";
import { useActiveVariation } from "@/integrations/variations/variation-context";
import { VariationSwitcher } from "@/components/admin/VariationSwitcher";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/_shell/catalogo")({
  component: CatalogoPage,
});

const PRODUCT_TYPE_META: Record<
  ProductType,
  { label: string; icon: typeof Brush; tone: string }
> = {
  drawing: {
    label: "Desenho",
    icon: Brush,
    tone: "bg-violet-500/15 text-violet-600 dark:text-violet-300",
  },
  course: {
    label: "Curso",
    icon: Video,
    tone: "bg-sky-500/15 text-sky-600 dark:text-sky-300",
  },
  ebook: {
    label: "E-book",
    icon: FileText,
    tone: "bg-gold/15 text-gold",
  },
  download: {
    label: "Download",
    icon: Download,
    tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  },
};

type Tab = "secoes" | "produtos" | "home";

function CatalogoPage() {
  const variation = useActiveVariation();
  const [tab, setTab] = React.useState<Tab>("secoes");
  const { data: sections = [] } = useCatalogSections({
    includeInactive: true,
    variationId: variation.id,
  });
  const { data: rawProducts = [] } = useCatalogProducts({
    includeUnpublished: true,
    variationId: variation.id,
  });
  // Defensive cleanup: hide orphan products (sem section_id ou variation_id)
  // que aparecem em contagens mas não pertencem visualmente a nenhuma seção.
  const products = React.useMemo(
    () =>
      rawProducts.filter(
        (p) => p.section_id != null && p.variation_id === variation.id,
      ),
    [rawProducts, variation.id],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Cadastrar produto"
        title="Cadastrar produto"
        description={`Você está editando a área de membros "${variation.title}". Cadastre seções, produtos e destaques da home. A liberação comercial (ofertas, códigos de plano e webhooks) agora é gerenciada no menu Oferta.`}
        actions={<VariationSwitcher />}
      />

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface p-1">
        <TabButton active={tab === "secoes"} onClick={() => setTab("secoes")}>
          Seções ({sections.length})
        </TabButton>
        <TabButton active={tab === "produtos"} onClick={() => setTab("produtos")}>
          Produtos ({products.length})
        </TabButton>
        <TabButton active={tab === "home"} onClick={() => setTab("home")}>
          Home / Destaques
        </TabButton>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto gap-2 border-gold/40 text-[11px] font-semibold text-gold hover:bg-gold/10 hover:text-gold"
          onClick={() =>
            window.open(
              `/?variation=${encodeURIComponent(variation.id)}`,
              "_blank",
              "noopener,noreferrer",
            )
          }
          title={`Visualizar área de membros "${variation.title}"`}
        >
          <Eye className="h-3.5 w-3.5" />
          Visualizar
        </Button>
      </div>

      {tab === "secoes" && (
        <SectionsPanel sections={sections} variationId={variation.id} />
      )}
      {tab === "produtos" && <ProductsPanel sections={sections} products={products} />}
      {tab === "home" && <HomePanel products={products} />}
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

/* ============================================================
   SEÇÕES
   ============================================================ */

function SectionsPanel({
  sections,
  variationId,
}: {
  sections: CatalogSectionRow[];
  variationId: string;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = React.useState<CatalogSectionRow | null>(null);
  const [open, setOpen] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState<CatalogSectionRow | null>(null);

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["catalog", "sections"] });

  const reorderMut = useMutation({
    mutationFn: async (vars: { id: string; dir: -1 | 1 }) => {
      const idx = sections.findIndex((s) => s.id === vars.id);
      const swap = sections[idx + vars.dir];
      if (!swap) return;
      const a = sections[idx];
      await updateSection(a.id, { order_index: swap.order_index });
      await updateSection(swap.id, { order_index: a.order_index });
    },
    onSuccess: invalidate,
  });

  const deleteMut = useMutation({
    mutationFn: deleteSection,
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["catalog", "products"] });
      toast.success("Seção excluída");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const duplicateMut = useMutation({
    mutationFn: duplicateSection,
    onSuccess: (created) => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["catalog", "products"] });
      toast.success(`Seção "${created.title}" duplicada`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) setEditing(null);
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(null)} className="gap-2">
              <Plus className="h-4 w-4" /> Nova seção
            </Button>
          </DialogTrigger>
          <SectionDialog
            section={editing}
            nextOrder={sections.length}
            variationId={variationId}
            onClose={() => {
              setOpen(false);
              setEditing(null);
            }}
          />
        </Dialog>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-surface-elevated text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Ordem</th>
              <th className="px-4 py-3 text-left">Título</th>
              <th className="px-4 py-3 text-left">Subtítulo</th>
              <th className="px-4 py-3 text-left">Slug</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {sections.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  Nenhuma seção. Crie a primeira para começar.
                </td>
              </tr>
            ) : (
              sections.map((s, i) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="rounded-md p-1 hover:bg-accent disabled:opacity-30"
                        disabled={i === 0}
                        onClick={() => reorderMut.mutate({ id: s.id, dir: -1 })}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="rounded-md p-1 hover:bg-accent disabled:opacity-30"
                        disabled={i === sections.length - 1}
                        onClick={() => reorderMut.mutate({ id: s.id, dir: 1 })}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium">{s.title}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.subtitle || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.slug}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-xs",
                        s.is_active
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {s.is_active ? "Ativa" : "Inativa"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditing(s);
                          setOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => duplicateMut.mutate(s.id)}
                        disabled={duplicateMut.isPending}
                        title="Duplicar seção (cópia independente com todos os produtos)"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setConfirmDelete(s)}
                        title="Excluir seção"
                      >
                        <Trash2 className="h-4 w-4" />
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
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title="Excluir seção?"
        confirmText={confirmDelete?.title ?? ""}
        actionLabel="Excluir seção"
        loading={deleteMut.isPending}
        description={
          <>
            <p>
              Essa ação removerá a seção <strong>"{confirmDelete?.title}"</strong> do catálogo.
            </p>
            <p className="text-amber-300">
              Os produtos vinculados a esta seção podem ficar sem categoria. Esta operação é
              permanente.
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

function SectionDialog({
  section,
  onClose,
  nextOrder,
  variationId,
}: {
  section: CatalogSectionRow | null;
  onClose: () => void;
  nextOrder: number;
  variationId: string;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = React.useState(section?.title ?? "");
  const [slug, setSlug] = React.useState(section?.slug ?? "");
  const [subtitle, setSubtitle] = React.useState(section?.subtitle ?? "");
  const [description, setDescription] = React.useState(section?.description ?? "");
  const [active, setActive] = React.useState<boolean>(section?.is_active ?? true);

  React.useEffect(() => {
    setTitle(section?.title ?? "");
    setSlug(section?.slug ?? "");
    setSubtitle(section?.subtitle ?? "");
    setDescription(section?.description ?? "");
    setActive(section?.is_active ?? true);
  }, [section]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (section) {
        await updateSection(section.id, {
          title,
          slug,
          subtitle,
          description,
          is_active: active,
        });
      } else {
        await createSection({
          title,
          slug,
          subtitle,
          description,
          is_active: active,
          order_index: nextOrder,
          variation_id: variationId,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalog", "sections"] });
      toast.success(section ? "Seção atualizada" : "Seção criada");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{section ? "Editar seção" : "Nova seção"}</DialogTitle>
      </DialogHeader>
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label>Título</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex.: Antigo Testamento"
          />
        </div>
        <div className="grid gap-2">
          <Label>Subtítulo</Label>
          <Input
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="Ex.: Aventuras de fé e coragem"
          />
        </div>
        <div className="grid gap-2">
          <Label>Descrição</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={active} onCheckedChange={setActive} id="sec-active" />
          <Label htmlFor="sec-active">Seção ativa</Label>
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          onClick={() => {
            if (!title.trim()) return;
            saveMut.mutate();
          }}
          disabled={saveMut.isPending}
        >
          {section ? "Salvar alterações" : "Criar seção"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

/* ============================================================
   PRODUTOS
   ============================================================ */

function ProductsPanel({
  sections,
  products,
}: {
  sections: CatalogSectionRow[];
  products: CatalogProductRow[];
}) {
  const qc = useQueryClient();
  const variation = useActiveVariation();
  const [editing, setEditing] = React.useState<CatalogProductRow | null>(null);
  const [open, setOpen] = React.useState(false);
  const [wizardOpen, setWizardOpen] = React.useState(false);
  const [mirrorOpen, setMirrorOpen] = React.useState(false);
  const [filterSection, setFilterSection] = React.useState<string>("all");
  const [filterType, setFilterType] = React.useState<"all" | ProductType>("all");
  const [confirmDelete, setConfirmDelete] =
    React.useState<CatalogProductRow | null>(null);

  const filtered = React.useMemo(() => {
    return products.filter((p) => {
      if (filterSection !== "all" && p.section_id !== filterSection) return false;
      if (filterType !== "all" && p.product_type !== filterType) return false;
      return true;
    });
  }, [products, filterSection, filterType]);

  const deleteMut = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalog", "products"] });
      toast.success("Produto excluído");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={filterSection} onValueChange={setFilterSection}>
            <SelectTrigger className="h-9 w-[200px]">
              <SelectValue placeholder="Seção" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as seções</SelectItem>
              {sections.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filterType}
            onValueChange={(v) => setFilterType(v as "all" | ProductType)}
          >
            <SelectTrigger className="h-9 w-[180px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="drawing">Desenhos</SelectItem>
              <SelectItem value="course">Cursos</SelectItem>
              <SelectItem value="ebook">E-book / PDF</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          className="gap-2"
          disabled={sections.length === 0}
          onClick={() => setWizardOpen(true)}
        >
          <Plus className="h-4 w-4" /> Novo produto
        </Button>

        <Button
          variant="outline"
          className="gap-2"
          disabled={sections.length === 0 || !variation?.id}
          onClick={() => setMirrorOpen(true)}
          title="Espelhar produtos de outra área de membros"
        >
          <Link2 className="h-4 w-4" /> Espelhar existente
        </Button>

        {variation?.id && (
          <MirrorProductDialog
            open={mirrorOpen}
            onOpenChange={setMirrorOpen}
            destinationVariationId={variation.id}
            destinationSections={sections}
          />
        )}

        {/* Wizard premium em 3 passos: Seção → Nome → Tipo.
            Após criar:
              - course   → navega para /admin/produtos/$id/aulas
              - drawing  → abre o ProductDialog em modo edição (capa + páginas) */}
        <CreateProductWizard
          open={wizardOpen}
          onOpenChange={setWizardOpen}
          sections={sections}
          variationId={variation?.id ?? null}
          nextOrder={products.length}
          onCreated={(product) => {
            qc.invalidateQueries({ queryKey: ["catalog", "products"] });
            if (product.product_type === "drawing") {
              setEditing(product);
              setOpen(true);
            }
          }}
        />

        {/* Dialog de edição (mantido) — reaproveitado pelo wizard quando o
            tipo escolhido é "drawing" e ao clicar no lápis de qualquer card. */}
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) setEditing(null);
          }}
        >
          <ProductDialog
            sections={sections}
            product={editing}
            nextOrder={filtered.length}
            onClose={() => {
              setOpen(false);
              setEditing(null);
            }}
          />
        </Dialog>
      </div>

      {sections.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface px-4 py-10 text-center text-sm text-muted-foreground">
          Crie ao menos uma seção antes de cadastrar produtos.
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface px-4 py-10 text-center text-sm text-muted-foreground">
          Nenhum produto nesta seção ainda.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((p) => {
            const section = sections.find((s) => s.id === p.section_id);
            return (
              <div
                key={p.id}
                className="group overflow-hidden rounded-2xl border border-border bg-surface"
              >
                <div className="relative aspect-[2/3] w-full bg-muted">
                  {(() => {
                    const cover = resolveProductCover(p);
                    return cover ? (
                      <img
                        src={cover}
                        alt={p.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                        sem capa
                      </div>
                    );
                  })()}
                  {p.is_locked && (
                    <div className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white shadow-lg ring-1 ring-white/20">
                      <Lock className="h-4 w-4" />
                    </div>
                  )}
                  {p.is_featured && (
                    <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-gold/90 px-2 py-0.5 text-[10px] font-bold uppercase text-gold-foreground">
                      <Star className="h-3 w-3 fill-current" /> Destaque
                    </div>
                  )}
                </div>
                <div className="space-y-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="line-clamp-1 text-sm font-semibold">{p.title}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {section?.title ?? "Sem seção"}
                      </div>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px]",
                        p.is_published
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {p.is_published ? "Publicado" : "Oculto"}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    {(() => {
                      const meta = PRODUCT_TYPE_META[p.product_type];
                      const TypeIcon = meta.icon;
                      return (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                            meta.tone,
                          )}
                        >
                          <TypeIcon className="h-2.5 w-2.5" /> {meta.label}
                        </span>
                      );
                    })()}
                    <span className="inline-flex rounded-full bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      #{p.order_index}
                    </span>
                    {p.is_locked && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
                        <Lock className="h-2.5 w-2.5" /> Bloqueado
                      </span>
                    )}
                    {p.is_mirror && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-medium text-sky-300"
                        title="Este produto usa conteúdo compartilhado de outra área, mas possui configurações próprias nesta área."
                      >
                        <Link2 className="h-2.5 w-2.5" /> Espelhado
                      </span>
                    )}
                    {p.is_featured && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-1.5 py-0.5 text-[10px] font-medium text-gold">
                        <Star className="h-2.5 w-2.5 fill-current" /> Destaque
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-end gap-1 pt-1">
                    {p.product_type === "course" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        asChild
                        title="Configurar aulas"
                      >
                        <Link
                          to="/admin/produtos/$productId/aulas"
                          params={{ productId: p.id }}
                        >
                          <Settings2 className="h-4 w-4" />
                        </Link>
                      </Button>
                    )}
                    {p.product_type === "ebook" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        asChild
                        title="Gerenciar PDFs do e-book"
                      >
                        <Link
                          to="/admin/produtos/$productId/ebook"
                          params={{ productId: p.id }}
                        >
                          <FileText className="h-4 w-4" />
                        </Link>
                      </Button>
                    )}
                    {/* Drawing pages now managed inside the edit dialog (step 2) */}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditing(p);
                        setOpen(true);
                      }}
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setConfirmDelete(p)}
                      title="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <ConfirmDeleteDialog
        open={!!confirmDelete}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title="Excluir produto?"
        confirmText={confirmDelete?.title ?? ""}
        actionLabel="Excluir produto"
        loading={deleteMut.isPending}
        description={
          <>
            <p>
              Essa ação removerá <strong>"{confirmDelete?.title}"</strong> do catálogo. Se ele já
              possuir módulos e aulas configurados, revise com atenção antes de continuar.
            </p>
            {confirmDelete?.product_type === "course" && (
              <p className="text-amber-300">
                Este curso pode possuir módulos e aulas cadastrados, que serão excluídos junto.
              </p>
            )}
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

function ProductDialog({
  sections,
  product,
  onClose,
  nextOrder,
}: {
  sections: CatalogSectionRow[];
  product: CatalogProductRow | null;
  onClose: () => void;
  nextOrder: number;
}) {
  const qc = useQueryClient();
  const variation = useActiveVariation();
  const [title, setTitle] = React.useState(product?.title ?? "");
  const [slug, setSlug] = React.useState(product?.slug ?? "");
  const [subtitle, setSubtitle] = React.useState(product?.subtitle ?? "");
  const [description, setDescription] = React.useState(product?.description ?? "");
  const [sectionId, setSectionId] = React.useState<string>(
    product?.section_id ?? sections[0]?.id ?? "",
  );
  const [productType, setProductType] = React.useState<ProductType>(
    product?.product_type ?? "drawing",
  );
  // Preview da capa: usa cover_image_url salvo OU o fallback resolvido por slug,
  // assim a mesma imagem que o admin vê no card persiste ao reabrir o editor.
  const [coverUrl, setCoverUrl] = React.useState(
    product?.cover_image_url ?? (product ? (resolveProductCover(product) ?? "") : ""),
  );
  const [externalUrl, setExternalUrl] = React.useState(product?.external_url ?? "");
  const [badge, setBadge] = React.useState(product?.badge_text ?? "");
  const [order, setOrder] = React.useState<number>(product?.order_index ?? nextOrder);
  const [published, setPublished] = React.useState(product?.is_published ?? true);
  const [featured, setFeatured] = React.useState(product?.is_featured ?? false);
  const [locked, setLocked] = React.useState(product?.is_locked ?? false);
  const [uploading, setUploading] = React.useState(false);

  React.useEffect(() => {
    setTitle(product?.title ?? "");
    setSlug(product?.slug ?? "");
    setSubtitle(product?.subtitle ?? "");
    setDescription(product?.description ?? "");
    setSectionId(product?.section_id ?? sections[0]?.id ?? "");
    setProductType(product?.product_type ?? "drawing");
    setCoverUrl(
      product?.cover_image_url ?? (product ? (resolveProductCover(product) ?? "") : ""),
    );
    setExternalUrl(product?.external_url ?? "");
    setBadge(product?.badge_text ?? "");
    setOrder(product?.order_index ?? nextOrder);
    setPublished(product?.is_published ?? true);
    setFeatured(product?.is_featured ?? false);
    setLocked(product?.is_locked ?? false);
  }, [product, nextOrder, sections]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        title,
        slug,
        subtitle,
        description,
        section_id: sectionId,
        product_type: productType,
        variation_id: variation.id,
        cover_image_url: coverUrl || null,
        external_url: externalUrl || null,
        badge_text: badge || null,
        order_index: order,
        is_published: published,
        is_featured: featured,
        is_locked: locked,
      };
      if (product) {
        await updateProduct(product.id, payload);
      } else {
        await createProduct({ ...payload, title, section_id: sectionId });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalog", "products"] });
      toast.success(product ? "Produto atualizado" : "Produto criado");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const url = await uploadCatalogCover(f);
      setCoverUrl(url);
      toast.success("Imagem enviada");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Falha no upload");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  const [step, setStep] = React.useState<1 | 2>(1);
  React.useEffect(() => {
    setStep(1);
  }, [product?.id]);

  const showStep2 = !!product && productType === "drawing";

  return (
    <DialogContent className="max-w-5xl">
      <DialogHeader>
        <DialogTitle>{product ? "Editar produto" : "Novo produto"}</DialogTitle>
      </DialogHeader>

      {showStep2 && (
        <div className="-mt-2 flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => setStep(1)}
            className={cn(
              "rounded-full px-3 py-1 font-medium transition",
              step === 1
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/70",
            )}
          >
            1. Detalhes do produto
          </button>
          <span className="text-muted-foreground">→</span>
          <button
            type="button"
            onClick={() => setStep(2)}
            className={cn(
              "rounded-full px-3 py-1 font-medium transition",
              step === 2
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/70",
            )}
          >
            2. Páginas de desenho
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="grid gap-4 md:grid-cols-[200px_1fr]">
          <div className="space-y-2">
            <Label>Capa</Label>
            <label
              className={`group relative block aspect-[2/3] w-full cursor-pointer overflow-hidden rounded-xl border border-dashed border-border bg-muted transition-colors hover:border-primary/60 hover:bg-muted/70 ${uploading ? "pointer-events-none opacity-70" : ""}`}
            >
              {coverUrl ? (
                <>
                  <img src={coverUrl} alt="Capa" className="h-full w-full object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center bg-background/60 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
                    <span className="inline-flex items-center gap-2 rounded-md bg-background/90 px-3 py-1.5 text-xs font-medium text-foreground shadow">
                      <Upload className="h-3.5 w-3.5" />
                      {uploading ? "Enviando..." : "Trocar imagem"}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Upload className="h-5 w-5" />
                  <span>{uploading ? "Enviando..." : "Clique para enviar"}</span>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
                disabled={uploading}
              />
            </label>
          </div>

          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label>Título</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Slug</Label>
                <Input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="auto a partir do título"
                />
              </div>
              <div className="grid gap-2">
                <Label>Ordem</Label>
                <Input
                  type="number"
                  value={order}
                  onChange={(e) => setOrder(parseInt(e.target.value || "0", 10))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Tipo de produto</Label>
                <Select
                  value={productType}
                  onValueChange={(v) => setProductType(v as ProductType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="drawing">
                      <span className="inline-flex items-center gap-2">
                        <Brush className="h-3.5 w-3.5" /> Desenho
                      </span>
                    </SelectItem>
                    <SelectItem value="course">
                      <span className="inline-flex items-center gap-2">
                        <Video className="h-3.5 w-3.5" /> Curso em vídeo
                      </span>
                    </SelectItem>
                    <SelectItem value="ebook">
                      <span className="inline-flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5" /> E-book / PDF
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Seção</Label>
                <Select value={sectionId} onValueChange={setSectionId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sections.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Subtítulo</Label>
              <Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Descrição</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>URL externa (opcional)</Label>
                <Input
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
              <div className="grid gap-2">
                <Label>Badge (opcional)</Label>
                <Input
                  value={badge}
                  onChange={(e) => setBadge(e.target.value)}
                  placeholder="Novo"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-5 pt-2">
              <div className="flex items-center gap-2">
                <Switch
                  id="p-pub"
                  checked={published}
                  onCheckedChange={setPublished}
                />
                <Label htmlFor="p-pub">Publicado</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="p-feat" checked={featured} onCheckedChange={setFeatured} />
                <Label htmlFor="p-feat">Destaque</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="p-lock" checked={locked} onCheckedChange={setLocked} />
                <Label htmlFor="p-lock">Bloqueado</Label>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 2 && product && (
        <div className="max-h-[70vh] overflow-y-auto pr-1">
          <DrawingPagesEditor
            product={{
              id: product.id,
              title: product.title,
              slug: product.slug,
              description: product.description,
              cover_image_url: product.cover_image_url,
              story_id: product.story_id,
            }}
            onBack={() => setStep(1)}
          />
        </div>
      )}

      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          {step === 2 ? "Fechar" : "Cancelar"}
        </Button>
        {step === 1 && (
          <Button
            onClick={() => {
              if (!title.trim() || !sectionId) return;
              saveMut.mutate();
            }}
            disabled={saveMut.isPending}
          >
            {product ? "Salvar alterações" : "Criar produto"}
          </Button>
        )}
        {showStep2 && step === 1 && (
          <Button
            variant="outline"
            onClick={() => setStep(2)}
            className="gap-2"
          >
            <Brush className="h-4 w-4" />
            Gerenciar páginas →
          </Button>
        )}
        {product && productType === "ebook" && step === 1 && (
          <Button variant="outline" asChild className="gap-2">
            <Link
              to="/admin/produtos/$productId/ebook"
              params={{ productId: product.id }}
              onClick={() => onClose()}
            >
              <FileText className="h-4 w-4" />
              Gerenciar PDFs →
            </Link>
          </Button>
        )}
      </DialogFooter>
    </DialogContent>
  );
}

/* ============================================================
   HOME / DESTAQUES
   ============================================================ */

function HomePanel({ products }: { products: CatalogProductRow[] }) {
  const qc = useQueryClient();
  const variation = useActiveVariation();
  const variationId = variation.id !== "fallback" ? variation.id : null;
  const { data: home, isLoading } = useHomeSettings(variationId);
  const [draft, setDraft] = React.useState<HomeSettingsRow | null>(null);

  React.useEffect(() => {
    if (home) setDraft(home);
  }, [home]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!draft) return;
      await updateHomeSettings(draft.id, {
        featured_product_id: draft.featured_product_id,
        continue_fallback_product_id: draft.continue_fallback_product_id,
        hero_label: draft.hero_label,
        hero_title: draft.hero_title,
        hero_subtitle: draft.hero_subtitle,
        hero_button_label: draft.hero_button_label,
        hero_image_url: draft.hero_image_url,
        hero_overlay_opacity: draft.hero_overlay_opacity,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalog", "home_settings"] });
      toast.success("Home atualizada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const heroUploadRef = React.useRef<HTMLInputElement>(null);
  const [uploadingHero, setUploadingHero] = React.useState(false);

  async function handleHeroUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      setUploadingHero(true);
      const url = await uploadCatalogCover(f, "hero-banners");
      setDraft((d) => (d ? { ...d, hero_image_url: url } : d));
      // Auto-save: persiste imediatamente no banco para refletir na home pública
      if (draft) {
        await updateHomeSettings(draft.id, { hero_image_url: url });
        qc.invalidateQueries({ queryKey: ["catalog", "home_settings"] });
        toast.success("Banner atualizado e salvo");
      } else {
        toast.success("Banner enviado");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no upload");
    } finally {
      setUploadingHero(false);
      if (heroUploadRef.current) heroUploadRef.current.value = "";
    }
  }

  async function handleHeroRemove() {
    if (!draft) return;
    try {
      setDraft((d) => (d ? { ...d, hero_image_url: null } : d));
      await updateHomeSettings(draft.id, { hero_image_url: null });
      qc.invalidateQueries({ queryKey: ["catalog", "home_settings"] });
      toast.success("Banner removido");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao remover");
    }
  }


  if (isLoading || !draft) {
    return (
      <div className="rounded-2xl border border-border bg-surface px-4 py-10 text-center text-sm text-muted-foreground">
        Carregando...
      </div>
    );
  }

  const set = <K extends keyof HomeSettingsRow>(k: K, v: HomeSettingsRow[K]) =>
    setDraft((d) => (d ? { ...d, [k]: v } : d));

  const featuredProduct =
    products.find((p) => p.id === draft.featured_product_id) ?? null;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* ---------- COLUNA ESQUERDA: EDITOR ---------- */}
      <div className="space-y-6">
        <div className="rounded-2xl border border-border bg-surface p-5">
          <h3 className="mb-4 text-base font-semibold">Hero principal</h3>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Produto em destaque</Label>
              <Select
                value={draft.featured_product_id ?? ""}
                onValueChange={(v) => set("featured_product_id", v || null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um produto" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Banner customizado do Hero */}
            <div className="grid gap-2">
              <Label>Banner do Hero (opcional)</Label>
              <p className="text-xs text-muted-foreground">
                Tamanho ideal: <strong>1920×1080 px</strong> (proporção 16:9, JPG ou PNG, até 2&nbsp;MB).
                Se vazio, usamos a imagem do produto em destaque.
              </p>
              {draft.hero_image_url ? (
                <div className="relative overflow-hidden rounded-lg border border-border bg-background">
                  <img
                    src={draft.hero_image_url}
                    alt="Banner do hero"
                    className="h-32 w-full object-cover"
                  />
                  <div className="flex items-center justify-end gap-2 border-t border-border bg-surface px-2 py-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => heroUploadRef.current?.click()}
                      disabled={uploadingHero}
                    >
                      {uploadingHero ? "Enviando..." : "Trocar imagem"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={handleHeroRemove}
                    >
                      Remover
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => heroUploadRef.current?.click()}
                  disabled={uploadingHero}
                >
                  {uploadingHero ? "Enviando..." : "Enviar banner customizado"}
                </Button>
              )}
              <input
                ref={heroUploadRef}
                type="file"
                accept="image/*"
                hidden
                onChange={handleHeroUpload}
              />
            </div>

            {/* Opacidade do banner */}
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>Opacidade do banner</Label>
                <span className="text-xs font-medium text-muted-foreground">
                  {Math.round((draft.hero_overlay_opacity ?? 0.7) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={Math.round((draft.hero_overlay_opacity ?? 0.7) * 100)}
                onChange={(e) =>
                  set("hero_overlay_opacity", Number(e.target.value) / 100)
                }
                className="w-full accent-primary"
              />
              <p className="text-xs text-muted-foreground">
                Controla quanto da imagem aparece ao fundo do hero. 0% = invisível, 100% = totalmente visível.
              </p>
            </div>

            <div className="grid gap-2">
              <Label>Label pequena</Label>
              <Input
                value={draft.hero_label ?? ""}
                onChange={(e) => set("hero_label", e.target.value)}
                placeholder="EM DESTAQUE"
              />
            </div>
            <div className="grid gap-2">
              <Label>Título do hero</Label>
              <Input
                value={draft.hero_title ?? ""}
                onChange={(e) => set("hero_title", e.target.value)}
                placeholder="Embarque na maior aventura da Bíblia"
              />
            </div>
            <div className="grid gap-2">
              <Label>Subtítulo do hero</Label>
              <Textarea
                value={draft.hero_subtitle ?? ""}
                onChange={(e) => set("hero_subtitle", e.target.value)}
                rows={2}
              />
            </div>
            <div className="grid gap-2">
              <Label>Texto do botão</Label>
              <Input
                value={draft.hero_button_label ?? ""}
                onChange={(e) => set("hero_button_label", e.target.value)}
                placeholder="Colorir agora"
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5">
          <h3 className="mb-4 text-base font-semibold">Continue colorindo</h3>
          <div className="grid gap-2">
            <Label>Fallback (quando o usuário ainda não tem progresso)</Label>
            <Select
              value={draft.continue_fallback_product_id ?? ""}
              onValueChange={(v) => set("continue_fallback_product_id", v || null)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um produto" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
            {saveMut.isPending ? "Salvando..." : "Salvar alterações"}
          </Button>
        </div>
      </div>

      {/* ---------- COLUNA DIREITA: PREVIEW ---------- */}
      <div className="space-y-3 lg:sticky lg:top-4 lg:self-start">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Preview da área de membros</h3>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Pré-visualização
          </span>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-xl">
          {/* Barra de janela tipo navegador */}
          <div className="flex items-center gap-1.5 border-b border-border bg-surface-elevated px-3 py-2">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-green-400/80" />
            <span className="ml-3 truncate text-[10px] text-muted-foreground">
              app.areademembros.com
            </span>
          </div>

          <div className="bg-background p-4">
            {/* Hero card preview */}
            <HeroPreview draft={draft} featuredProduct={featuredProduct} />

            {/* Continue colorindo preview */}
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-foreground">
                  Continue colorindo
                </h4>
                <span className="text-[10px] text-muted-foreground">Ver tudo</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[0, 1, 2].map((i) => {
                  const p =
                    i === 0
                      ? (products.find(
                          (x) => x.id === draft.continue_fallback_product_id,
                        ) ?? products[0])
                      : products[i];
                  const cover = resolveProductCover(p);
                  return (
                    <div
                      key={i}
                      className="relative aspect-[3/4] overflow-hidden rounded-md border border-border bg-surface-elevated"
                      style={
                        cover
                          ? { background: `url(${cover}) center/cover` }
                          : undefined
                      }
                    >
                      {!cover && (
                        <div className="flex h-full items-center justify-center px-1 text-center text-[10px] text-muted-foreground">
                          {p?.title ?? "—"}
                        </div>
                      )}
                      {cover && (
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1.5">
                          <p className="truncate text-[9px] font-semibold text-white drop-shadow">
                            {p?.title}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <p className="text-center text-[10px] text-muted-foreground">
          As alterações aparecem em tempo real conforme você edita.
        </p>
      </div>
    </div>
  );
}

function HeroPreview({
  draft,
  featuredProduct,
}: {
  draft: HomeSettingsRow;
  featuredProduct: CatalogProductRow | null;
}) {
  const heroBg =
    draft.hero_image_url ||
    featuredProduct?.hero_image_url ||
    resolveProductCover(featuredProduct);
  const opacity = draft.hero_overlay_opacity ?? 0.7;
  return (
    <div
      className="relative overflow-hidden rounded-xl border border-border bg-background"
      style={{ minHeight: 220 }}
    >
      {heroBg && (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${heroBg})`, opacity }}
          aria-hidden
        />
      )}
      <div
        className="absolute inset-0 bg-gradient-to-r from-background via-background/70 to-transparent"
        aria-hidden
      />
      <div className="relative z-10 flex h-full min-h-[220px] flex-col justify-center p-5">
        {draft.hero_label && (
          <span className="mb-2 inline-flex w-fit items-center rounded-full bg-background/70 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-foreground backdrop-blur-sm">
            {draft.hero_label}
          </span>
        )}
        <h2 className="text-xl font-bold leading-tight text-white drop-shadow-lg">
          {draft.hero_title || "Título do hero aparece aqui"}
        </h2>
        {draft.hero_subtitle && (
          <p className="mt-1.5 max-w-md text-xs text-white/90 drop-shadow">
            {draft.hero_subtitle}
          </p>
        )}
        <button
          type="button"
          className="mt-3 inline-flex w-fit items-center rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow"
        >
          {draft.hero_button_label || "Colorir agora"}
        </button>
      </div>
    </div>
  );
}

