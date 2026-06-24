// Lazy-loaded PDF reader. Wraps react-pdf so the ~300KB pdf.js bundle is only
// downloaded when the learner actually opens an e-book.
//
// Renders inside the member area — never a new tab, never the browser's
// native PDF UI. Provides controls for page navigation, zoom and (optional)
// download. The signed URL passed in is short-lived; this component does not
// know — and does not expose — the underlying storage path.

import * as React from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Maximize2,
  RefreshCw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// pdf.js worker — pulled from the same bundle so the file works offline
// (Cloudflare Worker SSR + edge caches) without requesting an external CDN.
// Vite resolves the `?url` import to a hashed asset URL at build time.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — Vite-only `?url` query
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl as string;

interface Props {
  /** Short-lived signed URL pointing at the PDF inside the private bucket. */
  signedUrl: string;
  /** Title displayed in the toolbar. */
  title: string;
  /** Show the download button? Mirrors `ebook_files.allow_download`. */
  allowDownload?: boolean;
  /** Filename suggested when the learner downloads. */
  downloadName?: string;
  /** Callback fired whenever the visible page changes (for progress). */
  onPageChange?: (page: number, total: number) => void;
  /** Initial page to render (defaults to 1). */
  initialPage?: number;
  /** Optional secondary action rendered on the left of the toolbar. */
  leadingSlot?: React.ReactNode;
}

const MIN_SCALE = 0.6;
const MAX_SCALE = 2.4;

export default function PdfReader({
  signedUrl,
  title,
  allowDownload = false,
  downloadName,
  onPageChange,
  initialPage = 1,
  leadingSlot,
}: Props) {
  const [numPages, setNumPages] = React.useState(0);
  const [page, setPage] = React.useState(initialPage);
  const [scale, setScale] = React.useState(1);
  const [containerWidth, setContainerWidth] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);
  const [pdfBuffer, setPdfBuffer] = React.useState<ArrayBuffer | null>(null);
  const [blobUrl, setBlobUrl] = React.useState<string | null>(null);
  const [viewerMode, setViewerMode] = React.useState<"pdfjs" | "native">("pdfjs");
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  // Pre-fetch the PDF as bytes ourselves. This avoids two flaky cases that
  // make pdf.js show "Não conseguimos carregar este PDF" against Supabase
  // signed URLs:
  //   1. CORS preflight on Range requests when pdf.js tries to stream.
  //   2. Storage returning 200 (full body) where pdf.js v5 expected 206.
  // Fetching once and handing pdf.js a typed array sidesteps both. We allow
  // the browser HTTP cache so repeat opens are instantaneous.
  React.useEffect(() => {
    let cancelled = false;
    setPdfBuffer(null);
    setError(null);
    setViewerMode("pdfjs");
    const ac = new AbortController();
    (async () => {
      try {
        const res = await fetch(signedUrl, {
          signal: ac.signal,
          credentials: "omit",
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const buf = await res.arrayBuffer();
        if (cancelled) return;

        // Quick header sniff (first 8 bytes is enough for "%PDF-x.y").
        const head = new Uint8Array(buf, 0, Math.min(buf.byteLength, 8));
        if (
          head[0] !== 0x25 ||
          head[1] !== 0x50 ||
          head[2] !== 0x44 ||
          head[3] !== 0x46
        ) {
          throw new Error("Arquivo recebido não é um PDF válido.");
        }

        setPdfBuffer(buf);
      } catch (err) {
        if (cancelled || (err as Error)?.name === "AbortError") return;
        console.error("[PdfReader] fetch failed", err);
        setError(
          "Não conseguimos carregar este PDF. Verifique sua conexão ou tente novamente.",
        );
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [signedUrl, reloadKey]);

  React.useEffect(() => {
    if (!pdfBuffer) {
      setBlobUrl(null);
      return;
    }

    const url = URL.createObjectURL(new Blob([pdfBuffer], { type: "application/pdf" }));
    setBlobUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [pdfBuffer]);

  // Track container width so we can fit-to-width on mobile/tablet without
  // letting the page bleed off-screen.
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setContainerWidth(e.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Notify parent so it can persist progress.
  React.useEffect(() => {
    if (numPages > 0) onPageChange?.(page, numPages);
  }, [page, numPages, onPageChange]);

  // Reset when document changes.
  React.useEffect(() => {
    setPage(initialPage);
    setError(null);
    setNumPages(0);
    setViewerMode("pdfjs");
  }, [signedUrl, initialPage]);

  const onLoadSuccess = React.useCallback(
    ({ numPages: n }: { numPages: number }) => {
      setNumPages(n);
      // Clamp initial page if it's past the end.
      setPage((p) => Math.min(Math.max(1, p), n));
    },
    [],
  );

  const onLoadError = React.useCallback((e: Error) => {
    console.error("[PdfReader] pdf.js failed, using native fallback", e);
    setViewerMode("native");
  }, []);

  const onPageError = React.useCallback((e: Error) => {
    console.error("[PdfReader] page render failed, using native fallback", e);
    setViewerMode("native");
  }, []);

  const goPrev = () => setPage((p) => Math.max(1, p - 1));
  const goNext = () => setPage((p) => Math.min(numPages || 1, p + 1));
  const zoomIn = () => setScale((s) => Math.min(MAX_SCALE, +(s + 0.2).toFixed(2)));
  const zoomOut = () => setScale((s) => Math.max(MIN_SCALE, +(s - 0.2).toFixed(2)));
  const fitWidth = () => setScale(1);

  // Keyboard navigation.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown") goNext();
      else if (e.key === "ArrowLeft" || e.key === "PageUp") goPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const requestFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else el.requestFullscreen?.().catch(() => {});
  };

  const renderWidth = containerWidth
    ? Math.min(containerWidth - 24, 1100) * scale
    : undefined;

  // Stable file prop for react-pdf. The bytes are cloned before giving them to
  // pdf.js so the worker can transfer its copy without mutating our source.
  // Disabling auto-fetch/streaming is fine here because we already have the
  // full buffer in memory — pdf.js can parse straight away.
  const fileProp = React.useMemo(
    () =>
      pdfBuffer && viewerMode === "pdfjs"
        ? {
            data: new Uint8Array(pdfBuffer.slice(0)),
            disableAutoFetch: false,
            disableStream: false,
          }
        : null,
    [pdfBuffer, viewerMode, reloadKey],
  );

  // Cap devicePixelRatio so we don't render 3x-4x the pixels on retina screens
  // — that's the single biggest cost on first paint for image-heavy PDFs.
  const renderDpr = React.useMemo(() => {
    if (typeof window === "undefined") return 1;
    return Math.min(window.devicePixelRatio || 1, 1.5);
  }, []);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-border bg-background">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 bg-surface/80 px-3 py-2 backdrop-blur sm:px-4">
        {leadingSlot}
        <div className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground sm:text-base">
          {title}
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={goPrev}
            disabled={page <= 1 || numPages === 0}
            aria-label="Página anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[64px] text-center text-xs tabular-nums text-muted-foreground">
            {numPages > 0 ? `${page} / ${numPages}` : "—"}
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={goNext}
            disabled={numPages === 0 || page >= numPages}
            aria-label="Próxima página"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="mx-1 h-5 w-px bg-border" aria-hidden />
          <Button size="sm" variant="ghost" onClick={zoomOut} aria-label="Diminuir zoom">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={fitWidth}
            className="px-2 text-[11px] tabular-nums"
            aria-label="Ajustar à largura"
          >
            {Math.round(scale * 100)}%
          </Button>
          <Button size="sm" variant="ghost" onClick={zoomIn} aria-label="Aumentar zoom">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={requestFullscreen}
            className="hidden sm:inline-flex"
            aria-label="Tela cheia"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
          {allowDownload && (
            <Button asChild size="sm" variant="ghost" aria-label="Baixar PDF">
              <a href={signedUrl} download={downloadName ?? "ebook.pdf"}>
                <Download className="h-4 w-4" />
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* Viewer */}
      <div
        ref={containerRef}
        className="relative flex-1 overflow-auto bg-[hsl(var(--surface))]/60"
      >
        {error ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <p className="max-w-md text-sm text-muted-foreground">{error}</p>
            <Button
              onClick={() => {
                setError(null);
                setReloadKey((k) => k + 1);
              }}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" /> Tentar novamente
            </Button>
          </div>
        ) : !pdfBuffer ? (
          <div className="flex flex-col items-center gap-3 py-24 text-sm text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-gold" />
            <div className="font-medium text-foreground">Carregando material…</div>
            <div className="text-xs">Preparando sua leitura</div>
          </div>
        ) : viewerMode === "native" && blobUrl ? (
          <iframe
            key={`${reloadKey}-native-${Math.round(scale * 100)}`}
            src={`${blobUrl}#toolbar=0&navpanes=0&scrollbar=1&zoom=${Math.round(scale * 100)}`}
            title={title}
            className="h-full min-h-[520px] w-full border-0 bg-background"
          />
        ) : (
          <div className="mx-auto flex w-full max-w-[1200px] justify-center px-3 py-6">
            <Document
              key={`${reloadKey}-pdfjs`}
              file={fileProp}
              onLoadSuccess={onLoadSuccess}
              onLoadError={onLoadError}
              loading={
                <div className="flex flex-col items-center gap-3 py-24 text-sm text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin text-gold" />
                  <div className="font-medium text-foreground">Carregando material…</div>
                  <div className="text-xs">Preparando sua leitura</div>
                </div>
              }
              error={
                <div className="py-24 text-center text-sm text-muted-foreground">
                  Abrindo com leitor alternativo…
                </div>
              }
            >
              <Page
                key={`${page}-${renderWidth ?? "auto"}-${scale}`}
                pageNumber={page}
                width={renderWidth}
                scale={containerWidth ? undefined : scale}
                renderAnnotationLayer={false}
                renderTextLayer={false}
                devicePixelRatio={renderDpr}
                onLoadError={onPageError}
                onRenderError={onPageError}
                className={cn("shadow-xl ring-1 ring-border")}
              />
            </Document>
          </div>
        )}
      </div>
    </div>
  );
}
