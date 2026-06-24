import { useState, useRef, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import JSZip from "jszip";
import {
  Image as ImageIcon,
  Loader2,
  Plus,
  Trash2,
  Upload,
  ArrowLeft,
  GripVertical,
  Pencil,
  Check,
  X,
  Download,
  Layers,
  Eye,
  EyeOff,
  Archive,
  CheckSquare,
  Square,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";

import {
  bulkUploadPages,
  createPage,
  deletePage,
  ensureStoryForProduct,
  getStoryById,
  listPages,
  reorderPages,
  updatePage,
  uploadPageLineart,
  type DrawingPageRow,
} from "@/services/drawings-admin";

interface Props {
  product: {
    id: string;
    title: string;
    slug: string;
    description: string | null;
    cover_image_url: string | null;
    story_id: string | null;
  };
  onBack: () => void;
}

export function DrawingPagesEditor({ product, onBack }: Props) {
  const qc = useQueryClient();
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(
    null,
  );
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [pageToDelete, setPageToDelete] = useState<DrawingPageRow | null>(null);
  const [isZipping, setIsZipping] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [replacingPageId, setReplacingPageId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [duplicateCheck, setDuplicateCheck] = useState<{
    duplicates: File[];
    uniques: File[];
    existingTitles: string[];
  } | null>(null);

  // Ensure story exists for this drawing product
  const storyQuery = useQuery({
    queryKey: ["drawing-story", product.id],
    queryFn: async () => {
      if (product.story_id) {
        const existing = await getStoryById(product.story_id);
        if (existing) return existing;
      }
      return ensureStoryForProduct({
        productId: product.id,
        title: product.title,
        baseSlug: product.slug,
        description: product.description,
        coverUrl: product.cover_image_url,
        existingStoryId: product.story_id,
      });
    },
  });

  const storyId = storyQuery.data?.id;

  const pagesQuery = useQuery({
    queryKey: ["drawing-pages", storyId],
    queryFn: () => (storyId ? listPages(storyId) : Promise.resolve([])),
    enabled: !!storyId,
  });

  const pages = pagesQuery.data ?? [];

  const bulkUploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      if (!storyId) throw new Error("Story not ready");
      const startingPageNumber =
        pages.length > 0 ? Math.max(...pages.map((p) => p.page_number)) + 1 : 1;
      setBulkProgress({ done: 0, total: files.length });
      return bulkUploadPages({
        storyId,
        files,
        startingPageNumber,
        onProgress: (done, total) => setBulkProgress({ done, total }),
      });
    },
    onSuccess: (created) => {
      toast.success(`${created.length} página(s) adicionada(s)!`);
      qc.invalidateQueries({ queryKey: ["drawing-pages", storyId] });
      setBulkProgress(null);
    },
    onError: (e: Error) => {
      toast.error(`Erro no upload: ${e.message}`);
      setBulkProgress(null);
    },
  });

  const addBlankMutation = useMutation({
    mutationFn: async () => {
      if (!storyId) throw new Error("Story not ready");
      const pageNumber =
        pages.length > 0 ? Math.max(...pages.map((p) => p.page_number)) + 1 : 1;
      return createPage({
        storyId,
        pageNumber,
        title: `Página ${pageNumber}`,
      });
    },
    onSuccess: () => {
      toast.success("Página em branco adicionada");
      qc.invalidateQueries({ queryKey: ["drawing-pages", storyId] });
    },
  });

  const updatePageMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<DrawingPageRow> }) =>
      updatePage(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["drawing-pages", storyId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deletePageMutation = useMutation({
    mutationFn: (id: string) => deletePage(id),
    onSuccess: () => {
      toast.success("Página removida");
      qc.invalidateQueries({ queryKey: ["drawing-pages", storyId] });
      setPageToDelete(null);
    },
  });

  const pageIds = useMemo(() => pages.map((p) => p.id), [pages]);
  const allSelected = pageIds.length > 0 && selectedIds.size === pageIds.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(pageIds));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    setIsBulkDeleting(true);
    let ok = 0;
    let fail = 0;
    for (const id of selectedIds) {
      try {
        await deletePage(id);
        ok += 1;
      } catch {
        fail += 1;
      }
    }
    setIsBulkDeleting(false);
    setShowBulkDeleteConfirm(false);
    setSelectedIds(new Set());
    qc.invalidateQueries({ queryKey: ["drawing-pages", storyId] });
    if (fail === 0) toast.success(`${ok} página(s) removida(s).`);
    else toast.error(`${ok} removida(s), ${fail} falha(s).`);
  }

  const replaceImageMutation = useMutation({
    mutationFn: async ({ pageId, file }: { pageId: string; file: File }) => {
      if (!storyId) throw new Error("Story not ready");
      const url = await uploadPageLineart(storyId, file);
      await updatePage(pageId, {
        image_lineart_url: url,
        image_preview_url: url,
      });
    },
    onSuccess: () => {
      toast.success("Imagem substituída");
      qc.invalidateQueries({ queryKey: ["drawing-pages", storyId] });
      setReplacingPageId(null);
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setReplacingPageId(null);
    },
  });

  const moveMutation = useMutation({
    mutationFn: (updates: { id: string; page_number: number }[]) => reorderPages(updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["drawing-pages", storyId] }),
  });

  function handleBulkUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    const incoming = Array.from(files);

    // Build a set of existing page "names" (the title field stores the
    // original file name without extension — see bulkUploadPages).
    const existing = new Set(
      pages
        .map((p) => (p.title ?? "").trim().toLowerCase())
        .filter((t) => t.length > 0),
    );

    const duplicates: File[] = [];
    const uniques: File[] = [];
    for (const f of incoming) {
      const base = f.name.replace(/\.[^.]+$/, "").trim().toLowerCase();
      if (base && existing.has(base)) duplicates.push(f);
      else uniques.push(f);
    }

    if (duplicates.length === 0) {
      bulkUploadMutation.mutate(incoming);
      return;
    }

    setDuplicateCheck({
      duplicates,
      uniques,
      existingTitles: duplicates.map((f) => f.name),
    });
  }

  function handleReplaceImage(pageId: string, files: FileList | null) {
    if (!files || files.length === 0) return;
    replaceImageMutation.mutate({ pageId, file: files[0] });
  }

  function handleSaveTitle() {
    if (!editingPageId) return;
    updatePageMutation.mutate({
      id: editingPageId,
      patch: { title: editingTitle.trim() || null },
    });
    setEditingPageId(null);
  }

  async function handleDownloadOne(page: DrawingPageRow) {
    const url = page.image_lineart_url;
    if (!url) {
      toast.error("Esta página não tem imagem para baixar.");
      return;
    }
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const ext = (url.split(".").pop() || "png").split("?")[0];
      const safeTitle = (page.title ?? `pagina-${page.page_number}`)
        .replace(/[^\w\-]+/g, "_")
        .slice(0, 60);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${String(page.page_number).padStart(2, "0")}-${safeTitle}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      toast.error(`Falha ao baixar: ${(err as Error).message}`);
    }
  }

  async function handleDownloadAll() {
    if (pages.length === 0) return;
    setIsZipping(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder(product.slug || "paginas") ?? zip;
      let added = 0;
      for (const page of pages) {
        if (!page.image_lineart_url) continue;
        try {
          const res = await fetch(page.image_lineart_url);
          const blob = await res.blob();
          const ext = (page.image_lineart_url.split(".").pop() || "png").split("?")[0];
          const safeTitle = (page.title ?? `pagina-${page.page_number}`)
            .replace(/[^\w\-]+/g, "_")
            .slice(0, 60);
          folder.file(
            `${String(page.page_number).padStart(2, "0")}-${safeTitle}.${ext}`,
            blob,
          );
          added += 1;
        } catch {
          /* skip individual failure */
        }
      }
      if (added === 0) {
        toast.error("Nenhuma imagem disponível para baixar.");
        return;
      }
      const content = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(content);
      a.download = `${product.slug || "paginas"}-${added}-paginas.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
      toast.success(`ZIP gerado com ${added} página(s).`);
    } catch (err) {
      toast.error(`Erro ao gerar ZIP: ${(err as Error).message}`);
    } finally {
      setIsZipping(false);
    }
  }

  function handleMove(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= pages.length) return;
    const a = pages[index];
    const b = pages[target];
    moveMutation.mutate([
      { id: a.id, page_number: b.page_number },
      { id: b.id, page_number: a.page_number },
    ]);
  }

  if (storyQuery.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (storyQuery.error) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6">
        <p className="text-sm text-destructive">
          Erro ao preparar mini app: {(storyQuery.error as Error).message}
        </p>
        <Button variant="outline" className="mt-4" onClick={onBack}>
          Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button size="icon" variant="ghost" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              {product.title}
            </h2>
            <p className="text-sm text-muted-foreground">
              Páginas do Mini App de Desenhos · {pages.length} página(s)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={handleDownloadAll}
            disabled={isZipping || pages.length === 0}
            title="Baixar todas as imagens em um arquivo .zip"
          >
            {isZipping ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Archive className="mr-2 h-4 w-4" />
            )}
            Baixar tudo (ZIP)
          </Button>
          <Button
            variant="outline"
            onClick={() => addBlankMutation.mutate()}
            disabled={addBlankMutation.isPending || !storyId}
          >
            <Plus className="mr-2 h-4 w-4" />
            Página em branco
          </Button>
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={bulkUploadMutation.isPending || !storyId}
          >
            {bulkUploadMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Upload em massa
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            multiple
            className="hidden"
            onChange={(e) => {
              handleBulkUpload(e.target.files);
              e.target.value = "";
            }}
          />
          <input
            ref={replaceInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={(e) => {
              if (replacingPageId) handleReplaceImage(replacingPageId, e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {/* Stats cards */}
      {pages.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex items-center gap-3 rounded-xl border border-gold/25 bg-[linear-gradient(135deg,color-mix(in_oklab,var(--gold)_8%,var(--surface))_0%,var(--card)_100%)] p-4 shadow-[0_10px_30px_-20px_rgba(212,175,55,0.45)]">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/15 text-gold">
              <Layers className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Total de páginas</p>
              <p className="text-2xl font-semibold text-foreground">{pages.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Eye className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Ativas</p>
              <p className="text-2xl font-semibold text-foreground">
                {pages.filter((p) => p.is_active).length}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <EyeOff className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Inativas</p>
              <p className="text-2xl font-semibold text-foreground">
                {pages.filter((p) => !p.is_active).length}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Bulk progress */}
      {bulkProgress && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-foreground">Enviando páginas…</span>
            <span className="text-muted-foreground">
              {bulkProgress.done}/{bulkProgress.total}
            </span>
          </div>
          <Progress value={(bulkProgress.done / bulkProgress.total) * 100} />
        </div>
      )}

      {/* Pages grid */}
      {pages.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card/40 p-12 text-center">
          <ImageIcon className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
          <h3 className="text-base font-medium text-foreground">Nenhuma página ainda</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Faça upload em massa de várias imagens de uma vez ou adicione página por página.
          </p>
          <Button
            className="mt-6"
            onClick={() => fileInputRef.current?.click()}
            disabled={!storyId}
          >
            <Upload className="mr-2 h-4 w-4" />
            Enviar imagens
          </Button>
        </div>
      ) : (
        <div>
          {/* Selection toolbar */}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card/60 px-3 py-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={toggleSelectAll}
              className="gap-2 text-sm"
            >
              {allSelected ? (
                <CheckSquare className="h-4 w-4 text-primary" />
              ) : someSelected ? (
                <CheckSquare className="h-4 w-4 text-primary/60" />
              ) : (
                <Square className="h-4 w-4 text-muted-foreground" />
              )}
              {allSelected ? "Desmarcar todos" : "Selecionar todos"}
              {selectedIds.size > 0 && (
                <span className="text-muted-foreground">
                  ({selectedIds.size}/{pages.length})
                </span>
              )}
            </Button>

            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearSelection}
                >
                  Limpar seleção
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowBulkDeleteConfirm(true)}
                  className="gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Excluir {selectedIds.size} selecionada(s)
                </Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {pages.map((page, idx) => (
              <div
                key={page.id}
                className={`group relative overflow-hidden rounded-lg border bg-card transition-colors ${
                  selectedIds.has(page.id)
                    ? "border-primary ring-2 ring-primary/40"
                    : "border-border hover:border-primary/40"
                }`}
              >
                {/* Image */}
                <div className="relative aspect-square w-full bg-muted">
                  {page.image_lineart_url ? (
                    <img
                      src={page.image_lineart_url}
                      alt={page.title ?? `Página ${page.page_number}`}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
                    </div>
                  )}

                  {/* Selection checkbox */}
                  <button
                    type="button"
                    onClick={() => toggleSelect(page.id)}
                    aria-label={
                      selectedIds.has(page.id) ? "Desmarcar página" : "Selecionar página"
                    }
                    className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md bg-background/90 text-foreground shadow-sm backdrop-blur transition-colors hover:bg-background"
                  >
                    {selectedIds.has(page.id) ? (
                      <CheckSquare className="h-4 w-4 text-primary" />
                    ) : (
                      <Square className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>

                  <Badge
                    variant="secondary"
                    className="absolute left-2 top-2 bg-background/90 backdrop-blur"
                  >
                    #{page.page_number}
                  </Badge>

                  {/* Hover actions */}
                  <div className="absolute inset-0 flex items-end justify-end gap-1 bg-gradient-to-t from-black/60 via-transparent to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-8 w-8"
                      onClick={() => handleDownloadOne(page)}
                      title="Baixar imagem"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-8 w-8"
                      onClick={() => {
                        setReplacingPageId(page.id);
                        replaceInputRef.current?.click();
                      }}
                      title="Substituir imagem"
                    >
                      <Upload className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="destructive"
                      className="h-8 w-8"
                      onClick={() => setPageToDelete(page)}
                      title="Remover"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Footer */}
                <div className="space-y-2 p-3">
                  {editingPageId === page.id ? (
                    <div className="flex items-center gap-1">
                      <Input
                        autoFocus
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveTitle();
                          if (e.key === "Escape") setEditingPageId(null);
                        }}
                        className="h-7 text-xs"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={handleSaveTitle}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => setEditingPageId(null)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-2 text-left"
                      onClick={() => {
                        setEditingPageId(page.id);
                        setEditingTitle(page.title ?? "");
                      }}
                    >
                      <span className="truncate text-sm font-medium text-foreground">
                        {page.title ?? `Página ${page.page_number}`}
                      </span>
                      <Pencil className="h-3 w-3 shrink-0 text-muted-foreground" />
                    </button>
                  )}

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        disabled={idx === 0 || moveMutation.isPending}
                        onClick={() => handleMove(idx, -1)}
                        title="Mover para cima"
                      >
                        <GripVertical className="h-3 w-3 -rotate-90" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        disabled={idx === pages.length - 1 || moveMutation.isPending}
                        onClick={() => handleMove(idx, 1)}
                        title="Mover para baixo"
                      >
                        <GripVertical className="h-3 w-3 rotate-90" />
                      </Button>
                    </div>
                    <Label className="flex cursor-pointer items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={page.is_active}
                        onChange={(e) =>
                          updatePageMutation.mutate({
                            id: page.id,
                            patch: { is_active: e.target.checked },
                          })
                        }
                        className="h-3 w-3 rounded border-border"
                      />
                      Ativa
                    </Label>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Delete confirm */}
      <Dialog open={!!pageToDelete} onOpenChange={(open) => !open && setPageToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover página?</DialogTitle>
            <DialogDescription>
              A página &quot;{pageToDelete?.title ?? `#${pageToDelete?.page_number}`}&quot; será
              removida permanentemente. Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPageToDelete(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => pageToDelete && deletePageMutation.mutate(pageToDelete.id)}
              disabled={deletePageMutation.isPending}
            >
              {deletePageMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk delete confirm */}
      <Dialog
        open={showBulkDeleteConfirm}
        onOpenChange={(open) => !open && !isBulkDeleting && setShowBulkDeleteConfirm(false)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir {selectedIds.size} página(s)?</DialogTitle>
            <DialogDescription>
              As páginas selecionadas serão removidas permanentemente. Esta ação não pode ser
              desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowBulkDeleteConfirm(false)}
              disabled={isBulkDeleting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
            >
              {isBulkDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir {selectedIds.size} página(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate-name confirm */}
      <Dialog
        open={!!duplicateCheck}
        onOpenChange={(open) => !open && setDuplicateCheck(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Imagens com nome duplicado</DialogTitle>
            <DialogDescription>
              Encontramos{" "}
              <strong>{duplicateCheck?.duplicates.length ?? 0}</strong> imagem(ns) com
              nome igual a páginas já existentes. Deseja enviá-las mesmo assim
              (criando páginas duplicadas) ou enviar somente as{" "}
              <strong>{duplicateCheck?.uniques.length ?? 0}</strong> nova(s)?
            </DialogDescription>
          </DialogHeader>

          {duplicateCheck && duplicateCheck.duplicates.length > 0 && (
            <ScrollArea className="max-h-40 rounded-md border border-border bg-muted/30 p-2">
              <ul className="space-y-1 text-xs text-muted-foreground">
                {duplicateCheck.existingTitles.map((name, i) => (
                  <li key={`${name}-${i}`} className="truncate">
                    • {name}
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setDuplicateCheck(null)}
            >
              Cancelar
            </Button>
            <Button
              variant="secondary"
              disabled={(duplicateCheck?.uniques.length ?? 0) === 0}
              onClick={() => {
                if (!duplicateCheck) return;
                const toUpload = duplicateCheck.uniques;
                setDuplicateCheck(null);
                if (toUpload.length === 0) {
                  toast.info("Nenhuma imagem nova para enviar.");
                  return;
                }
                bulkUploadMutation.mutate(toUpload);
              }}
            >
              Enviar só as novas ({duplicateCheck?.uniques.length ?? 0})
            </Button>
            <Button
              onClick={() => {
                if (!duplicateCheck) return;
                const all = [...duplicateCheck.uniques, ...duplicateCheck.duplicates];
                setDuplicateCheck(null);
                bulkUploadMutation.mutate(all);
              }}
            >
              Enviar todas ({(duplicateCheck?.uniques.length ?? 0) +
                (duplicateCheck?.duplicates.length ?? 0)})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
