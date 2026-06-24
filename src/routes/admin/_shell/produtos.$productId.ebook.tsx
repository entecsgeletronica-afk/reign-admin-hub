// Admin: editor de PDFs do produto E-book.
// - Para single_pdf: o admin sobe um único arquivo.
// - Para modules: o admin cria módulos e adiciona PDFs em cada um.

import * as React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FileText, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getProductBySlug, updateProduct } from "@/services/catalog-db";
import {
  createEbookFile,
  createEbookModule,
  deleteEbookFile,
  deleteEbookModule,
  listEbookFilesByProduct,
  listEbookModulesByProduct,
  updateEbookFile,
  uploadEbookPdf,
  type EbookFileRow,
} from "@/services/ebooks";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/_shell/produtos/$productId/ebook")({
  component: EbookEditorPage,
});

function EbookEditorPage() {
  const { productId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: product } = useQuery({
    queryKey: ["catalog", "product-by-id", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("catalog_products")
        .select("*")
        .eq("id", productId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: modules = [] } = useQuery({
    queryKey: ["ebook", "modules", productId],
    queryFn: () => listEbookModulesByProduct(productId),
  });
  const { data: files = [] } = useQuery({
    queryKey: ["ebook", "files", productId],
    queryFn: () => listEbookFilesByProduct(productId),
  });

  const ebookMode = (product?.ebook_mode as "single_pdf" | "modules" | null) ?? null;

  const setModeMut = useMutation({
    mutationFn: async (mode: "single_pdf" | "modules") => {
      await updateProduct(productId, { ebook_mode: mode } as never);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalog", "product-by-id", productId] });
      toast.success("Formato definido");
    },
  });

  if (!product) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="E-book / PDF"
        title={product.title}
        description="Configure os arquivos PDF deste material. A leitura acontece dentro da área de membros — sem nova aba."
        actions={
          <Button
            variant="outline"
            onClick={() => navigate({ to: "/admin/catalogo" })}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar ao catálogo
          </Button>
        }
      />

      {/* Mode picker */}
      {!ebookMode && (
        <div className="rounded-2xl border border-border bg-surface p-6">
          <h2 className="text-base font-semibold">Como este material é organizado?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Você pode trocar depois, mas escolher agora deixa o editor mais simples.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <ModeCard
              title="PDF único"
              description="Um único arquivo PDF. Ideal para e-books, devocionais e guias."
              onClick={() => setModeMut.mutate("single_pdf")}
            />
            <ModeCard
              title="PDF organizado por módulos"
              description="Vários PDFs agrupados em módulos. Ideal para coleções e apostilas."
              onClick={() => setModeMut.mutate("modules")}
            />
          </div>
        </div>
      )}

      {ebookMode === "single_pdf" && (
        <SinglePdfPanel productId={productId} files={files} />
      )}

      {ebookMode === "modules" && (
        <ModulesPanel productId={productId} modules={modules} files={files} />
      )}

      <div className="text-xs text-muted-foreground">
        <Link
          to="/admin/catalogo"
          className="underline-offset-2 hover:text-foreground hover:underline"
        >
          ← Voltar à lista de produtos
        </Link>
      </div>
    </div>
  );
}

function ModeCard({
  title,
  description,
  onClick,
}: {
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col gap-2 rounded-2xl border border-border bg-background p-5 text-left transition hover:border-gold/60 hover:bg-accent"
    >
      <FileText className="h-5 w-5 text-gold" />
      <div className="text-sm font-semibold text-foreground">{title}</div>
      <div className="text-xs text-muted-foreground">{description}</div>
    </button>
  );
}

/* ---------------- Single PDF ---------------- */

function SinglePdfPanel({
  productId,
  files,
}: {
  productId: string;
  files: EbookFileRow[];
}) {
  const qc = useQueryClient();
  const file = files[0] ?? null;

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["ebook", "files", productId] });

  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <h2 className="text-base font-semibold">PDF do produto</h2>
      {file ? (
        <FileEditor file={file} onChanged={invalidate} />
      ) : (
        <FileUploader
          productId={productId}
          moduleId={null}
          onUploaded={invalidate}
        />
      )}
    </div>
  );
}

/* ---------------- Modules ---------------- */

function ModulesPanel({
  productId,
  modules,
  files,
}: {
  productId: string;
  modules: { id: string; title: string; sort_order: number }[];
  files: EbookFileRow[];
}) {
  const qc = useQueryClient();
  const [newModuleTitle, setNewModuleTitle] = React.useState("");

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["ebook", "modules", productId] });
    qc.invalidateQueries({ queryKey: ["ebook", "files", productId] });
  };

  const createModuleMut = useMutation({
    mutationFn: () =>
      createEbookModule({
        product_id: productId,
        title: newModuleTitle.trim(),
        sort_order: modules.length,
      }),
    onSuccess: () => {
      setNewModuleTitle("");
      invalidateAll();
      toast.success("Módulo criado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteModuleMut = useMutation({
    mutationFn: deleteEbookModule,
    onSuccess: () => {
      invalidateAll();
      toast.success("Módulo removido");
    },
  });

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-surface p-4">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Novo módulo
        </Label>
        <div className="mt-2 flex gap-2">
          <Input
            value={newModuleTitle}
            onChange={(e) => setNewModuleTitle(e.target.value)}
            placeholder="Ex.: Introdução, Histórias bíblicas, Atividades…"
          />
          <Button
            onClick={() => createModuleMut.mutate()}
            disabled={!newModuleTitle.trim() || createModuleMut.isPending}
            className="gap-2"
          >
            <Plus className="h-4 w-4" /> Adicionar
          </Button>
        </div>
      </div>

      {modules.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-surface px-6 py-12 text-center text-sm text-muted-foreground">
          Crie o primeiro módulo para começar a organizar os PDFs.
        </div>
      )}

      {modules.map((mod) => {
        const modFiles = files.filter((f) => f.module_id === mod.id);
        return (
          <div key={mod.id} className="rounded-2xl border border-border bg-surface p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold">{mod.title}</h3>
                <p className="text-xs text-muted-foreground">
                  {modFiles.length} PDF{modFiles.length === 1 ? "" : "s"}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (confirm(`Excluir o módulo "${mod.title}" e seus PDFs?`))
                    deleteModuleMut.mutate(mod.id);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-4 space-y-3">
              {modFiles.map((f) => (
                <FileEditor key={f.id} file={f} onChanged={invalidateAll} />
              ))}
              <FileUploader
                productId={productId}
                moduleId={mod.id}
                onUploaded={invalidateAll}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- File uploader & editor ---------------- */

function FileUploader({
  productId,
  moduleId,
  onUploaded,
}: {
  productId: string;
  moduleId: string | null;
  onUploaded: () => void;
}) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = React.useState(false);

  const handlePick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const { file_path, file_name, file_size } = await uploadEbookPdf(productId, file);
      await createEbookFile({
        product_id: productId,
        module_id: moduleId,
        title: file.name.replace(/\.pdf$/i, ""),
        file_path,
        file_name,
        file_size,
        status: "published",
      });
      toast.success("PDF enviado");
      onUploaded();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-background px-4 py-6 text-sm font-medium text-muted-foreground transition hover:border-gold/60 hover:bg-accent hover:text-foreground">
      {busy ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" /> Enviando…
        </>
      ) : (
        <>
          <Upload className="h-4 w-4" /> Adicionar PDF
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        disabled={busy}
        onChange={(e) => handlePick(e.target.files?.[0])}
      />
    </label>
  );
}

function FileEditor({
  file,
  onChanged,
}: {
  file: EbookFileRow;
  onChanged: () => void;
}) {
  const [title, setTitle] = React.useState(file.title);
  const [allowDownload, setAllowDownload] = React.useState(file.allow_download);
  const [status, setStatus] = React.useState(file.status);

  const saveMut = useMutation({
    mutationFn: () =>
      updateEbookFile(file.id, {
        title,
        allow_download: allowDownload,
        status,
      }),
    onSuccess: () => {
      toast.success("Salvo");
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteEbookFile(file.id, file.file_path),
    onSuccess: () => {
      toast.success("PDF removido");
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3 rounded-xl border border-border bg-background p-4">
      <div className="flex items-start gap-3">
        <FileText className="mt-1 h-5 w-5 shrink-0 text-gold" />
        <div className="min-w-0 flex-1">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título do PDF"
          />
          <p className="mt-1 truncate text-[11px] text-muted-foreground">
            {file.file_name ?? file.file_path}
            {file.file_size ? ` • ${(file.file_size / 1024 / 1024).toFixed(1)} MB` : ""}
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            if (confirm(`Excluir "${file.title}"?`)) deleteMut.mutate();
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Switch
            id={`dl-${file.id}`}
            checked={allowDownload}
            onCheckedChange={setAllowDownload}
          />
          <Label htmlFor={`dl-${file.id}`} className="text-xs">
            Permitir download
          </Label>
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger className="h-8 w-[140px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">Rascunho</SelectItem>
            <SelectItem value="published">Publicado</SelectItem>
          </SelectContent>
        </Select>
        <Button
          size="sm"
          onClick={() => saveMut.mutate()}
          disabled={saveMut.isPending}
          className="ml-auto"
        >
          Salvar
        </Button>
      </div>
    </div>
  );
}
