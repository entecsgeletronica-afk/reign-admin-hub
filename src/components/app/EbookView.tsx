// E-book / PDF view inside the member area.
//
// Two layouts:
//  - single_pdf  → opens straight into the reader (no module list).
//  - modules     → desktop = sidebar with module/PDF list + reader; mobile =
//                  list view first, tap-to-open full-screen reader.
//
// Locked products use the same blurred-hero pattern as CourseView.

import * as React from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ChevronRight,
  FileText,
  Lock,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import type { CatalogProductRow } from "@/services/catalog-db";
import { upsertRecentProduct } from "@/services/catalog-db";
import {
  createEbookSignedUrl,
  listEbookFilesByProduct,
  listEbookModulesByProduct,
  upsertEbookProgress,
  type EbookFileRow,
  type EbookModuleRow,
} from "@/services/ebooks";
import { useAuth } from "@/integrations/supabase/auth-context";
import { resolveProductCover } from "@/lib/catalog-covers";
import { getContentProductId } from "@/lib/mirror";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// PDF reader is heavy (~300KB pdf.js) AND uses browser-only APIs
// (window / document / Worker / CompressionStream). We must avoid evaluating
// it during SSR — otherwise it crashes the serverless function on Vercel.
// On the server we resolve to a no-op component; in the browser we
// dynamic-import the real module.
const PdfReader = React.lazy(() =>
  typeof window === "undefined"
    ? Promise.resolve({ default: (() => <></>) as unknown as typeof import("@/components/app/PdfReader").default })
    : import("@/components/app/PdfReader"),
);

interface Props {
  product: CatalogProductRow;
  hasAccess: boolean;
}

export function EbookView({ product, hasAccess }: Props) {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  // Espelhos resolvem o conteúdo do produto original; entitlement/recent
  // continuam usando o id do próprio espelho.
  const contentProductId = getContentProductId(product);

  const { data: modules = [] } = useQuery({
    queryKey: ["ebook", "modules", contentProductId],
    queryFn: () => listEbookModulesByProduct(contentProductId),
    enabled: hasAccess,
  });
  const { data: files = [], isLoading: loadingFiles } = useQuery({
    queryKey: ["ebook", "files", contentProductId],
    queryFn: () => listEbookFilesByProduct(contentProductId),
    enabled: hasAccess,
  });

  const publishedFiles = React.useMemo(
    () => files.filter((f) => f.status === "published"),
    [files],
  );

  const isModulesMode = product.ebook_mode === "modules";

  // Auto-pick the first file once the data loads.
  const [activeFileId, setActiveFileId] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!activeFileId && publishedFiles.length > 0) {
      setActiveFileId(publishedFiles[0].id);
    }
  }, [activeFileId, publishedFiles]);

  // Mobile-only: when on modules mode, hide the reader until the user picks
  // a PDF, then show it full-screen.
  const [mobileReaderOpen, setMobileReaderOpen] = React.useState(false);

  const cover = resolveProductCover(product);

  // Mark this product as recently opened so the home's "Continuar lendo" tile
  // surfaces e-books just like courses and drawings. Fire once per mount.
  React.useEffect(() => {
    if (!hasAccess || !userId) return;
    void upsertRecentProduct({
      user_id: userId,
      product_id: product.id,
      progress_percent: 0,
    }).catch(() => {});
  }, [hasAccess, userId, product.id]);

  if (!hasAccess) {
    return <LockedHero product={product} cover={cover} />;
  }

  if (loadingFiles) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-gold" />
        Carregando material…
      </div>
    );
  }

  if (publishedFiles.length === 0) {
    return (
      <EmptyState
        title="Este material ainda não foi publicado."
        subtitle="O autor está finalizando os arquivos. Volte em breve."
      />
    );
  }

  // ---------- Single PDF mode ----------
  if (!isModulesMode) {
    const file = publishedFiles[0];
    return (
      <div className="mx-auto w-full max-w-[1400px] px-3 pb-10 pt-4 sm:px-6">
        <ReaderHeader product={product} />
        <div className="mt-4 h-[calc(100vh-180px)] min-h-[520px]">
          <PdfHost product={product} file={file} userId={userId} />
        </div>
      </div>
    );
  }

  // ---------- Modules mode ----------
  const activeFile = publishedFiles.find((f) => f.id === activeFileId) ?? null;

  return (
    <div className="mx-auto w-full max-w-[1400px] px-3 pb-10 pt-4 sm:px-6">
      <ReaderHeader product={product} />

      <div className="mt-4 grid gap-4 lg:grid-cols-[320px_1fr]">
        {/* Sidebar — desktop is always visible; mobile only when reader is closed */}
        <aside
          className={cn(
            "rounded-2xl border border-border bg-surface",
            mobileReaderOpen && "hidden lg:block",
          )}
        >
          <ModulesList
            modules={modules}
            files={publishedFiles}
            activeFileId={activeFileId}
            onPick={(id) => {
              setActiveFileId(id);
              setMobileReaderOpen(true);
            }}
          />
        </aside>

        <section
          className={cn(
            "min-h-[520px] lg:h-[calc(100vh-180px)]",
            !mobileReaderOpen && "hidden lg:block",
          )}
        >
          {activeFile ? (
            <PdfHost
              product={product}
              file={activeFile}
              userId={userId}
              leadingSlot={
                <Button
                  size="sm"
                  variant="ghost"
                  className="lg:hidden"
                  onClick={() => setMobileReaderOpen(false)}
                >
                  <ArrowLeft className="mr-1 h-4 w-4" /> Módulos
                </Button>
              }
            />
          ) : (
            <EmptyState
              title="Selecione um material para começar a leitura."
              subtitle="Use a lista ao lado para escolher um PDF."
            />
          )}
        </section>
      </div>
    </div>
  );
}

/* ---------------- Sub-components ---------------- */

function ReaderHeader({ product }: { product: CatalogProductRow }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Link
        to="/"
        className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground hover:bg-accent"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>
      <div className="hidden min-w-0 flex-1 px-3 sm:block">
        <div className="truncate text-sm font-semibold text-foreground">
          {product.title}
        </div>
        {product.subtitle && (
          <div className="truncate text-xs text-muted-foreground">
            {product.subtitle}
          </div>
        )}
      </div>
      <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gold">
        <FileText className="h-3 w-3" /> E-book
      </span>
    </div>
  );
}

function ModulesList({
  modules,
  files,
  activeFileId,
  onPick,
}: {
  modules: EbookModuleRow[];
  files: EbookFileRow[];
  activeFileId: string | null;
  onPick: (fileId: string) => void;
}) {
  const filesByModule = React.useMemo(() => {
    const m = new Map<string | null, EbookFileRow[]>();
    for (const f of files) {
      const k = f.module_id;
      const arr = m.get(k) ?? [];
      arr.push(f);
      m.set(k, arr);
    }
    return m;
  }, [files]);

  const orphanFiles = filesByModule.get(null) ?? [];

  return (
    <nav className="max-h-[calc(100vh-180px)] overflow-y-auto p-3">
      {modules
        .filter((mod) => mod.status === "published")
        .map((mod) => {
          const modFiles = filesByModule.get(mod.id) ?? [];
          if (modFiles.length === 0) return null;
          return (
            <div key={mod.id} className="mb-4">
              <div className="px-2 pb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {mod.title}
              </div>
              <ul className="space-y-1">
                {modFiles.map((f) => (
                  <FileRow
                    key={f.id}
                    file={f}
                    active={f.id === activeFileId}
                    onClick={() => onPick(f.id)}
                  />
                ))}
              </ul>
            </div>
          );
        })}
      {orphanFiles.length > 0 && (
        <div className="mb-4">
          <div className="px-2 pb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Materiais
          </div>
          <ul className="space-y-1">
            {orphanFiles.map((f) => (
              <FileRow
                key={f.id}
                file={f}
                active={f.id === activeFileId}
                onClick={() => onPick(f.id)}
              />
            ))}
          </ul>
        </div>
      )}
    </nav>
  );
}

function FileRow({
  file,
  active,
  onClick,
}: {
  file: EbookFileRow;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition",
          active
            ? "bg-gold/15 text-foreground ring-1 ring-gold/40"
            : "text-muted-foreground hover:bg-accent hover:text-foreground",
        )}
      >
        <FileText className="h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{file.title}</span>
        <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" />
      </button>
    </li>
  );
}

function PdfHost({
  product,
  file,
  userId,
  leadingSlot,
}: {
  product: CatalogProductRow;
  file: EbookFileRow;
  userId: string | null;
  leadingSlot?: React.ReactNode;
}) {
  // Fetch a fresh signed URL whenever the file changes. We never expose
  // file.file_path directly to the DOM.
  const { data: signedUrl, isLoading, isError, refetch } = useQuery({
    queryKey: ["ebook", "signed-url", file.id, file.file_path],
    queryFn: () => createEbookSignedUrl(file.file_path, 60 * 30),
    staleTime: 25 * 60_000, // refresh well before the 30-min expiry
  });

  const handleProgress = React.useCallback(
    (page: number, total: number) => {
      if (!userId) return;
      // Fire-and-forget: we don't want to block the UI on progress writes.
      void upsertEbookProgress({
        user_id: userId,
        product_id: product.id,
        ebook_file_id: file.id,
        last_page: page,
        total_pages: total,
      }).catch(() => {});
      // Keep the home's "Continuar lendo" tile updated with the latest %.
      const pct = total > 0 ? Math.round((page / total) * 100) : 0;
      void upsertRecentProduct({
        user_id: userId,
        product_id: product.id,
        progress_percent: pct,
      }).catch(() => {});
    },
    [userId, product.id, file.id],
  );

  if (isLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-surface text-sm text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-gold" />
        <div className="font-medium text-foreground">Carregando material…</div>
      </div>
    );
  }

  if (isError || !signedUrl) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-surface px-6 text-center text-sm">
        <p className="text-muted-foreground">
          Não conseguimos carregar este PDF. Verifique sua conexão ou tente novamente.
        </p>
        <Button onClick={() => refetch()}>Tentar novamente</Button>
      </div>
    );
  }

  return (
    <React.Suspense
      fallback={
        <div className="flex h-full items-center justify-center rounded-2xl border border-border bg-surface text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin text-gold" />
          Preparando leitor…
        </div>
      }
    >
      <PdfReader
        signedUrl={signedUrl}
        title={file.title}
        allowDownload={file.allow_download}
        downloadName={file.file_name ?? `${file.title}.pdf`}
        onPageChange={handleProgress}
        leadingSlot={leadingSlot}
      />
    </React.Suspense>
  );
}

function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mx-auto mt-10 max-w-2xl rounded-2xl border border-dashed border-border bg-surface px-6 py-16 text-center">
      <Sparkles className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {subtitle && (
        <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      )}
    </div>
  );
}

function LockedHero({
  product,
  cover,
}: {
  product: CatalogProductRow;
  cover: string | null;
}) {
  return (
    <section className="relative isolate flex min-h-[80vh] w-full items-end overflow-hidden">
      <div
        className="absolute inset-0 -z-10 bg-cover bg-center"
        style={{ backgroundImage: cover ? `url(${cover})` : undefined }}
        aria-hidden
      />
      <div
        className="absolute inset-0 -z-10 bg-gradient-to-r from-background via-background/70 to-transparent"
        aria-hidden
      />
      <div className="relative w-full px-4 pb-20 pt-24 sm:px-8 lg:px-16">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface-elevated/70 px-3 py-2 text-xs font-semibold text-foreground backdrop-blur hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        <div className="mt-8 max-w-3xl space-y-5">
          <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gold">
            <FileText className="h-3 w-3" /> E-book
          </span>
          <h1 className="text-5xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-6xl">
            {product.title}
          </h1>
          {product.subtitle && (
            <p className="max-w-2xl text-lg text-muted-foreground sm:text-xl">
              {product.subtitle}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3 pt-3">
            {product.external_url ? (
              <a
                href={product.external_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-2xl bg-gold px-7 py-4 text-base font-semibold text-gold-foreground shadow-lg transition-transform hover:-translate-y-0.5"
              >
                <Lock className="h-5 w-5" />
                Adquirir acesso
              </a>
            ) : (
              <div className="inline-flex items-center gap-2 rounded-2xl border border-border bg-surface-elevated/80 px-6 py-4 text-base font-semibold text-muted-foreground backdrop-blur">
                <Lock className="h-5 w-5" />
                Conteúdo bloqueado
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
