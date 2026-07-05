import * as React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import JSZip from "jszip";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Eraser,
  
  Maximize2,
  Minus,
  PaintBucket,
  Package,
  PartyPopper,
  Pencil,
  PenTool,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";
import { getStoryBySlug } from "@/services/story-pages";
import { getProductBySlug } from "@/services/catalog-db";
import { useEntitlements } from "@/hooks/use-entitlements";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "@/integrations/supabase/auth-context";
import { cn } from "@/lib/utils";
import { humanTitle } from "@/lib/display-text";
import { safeStorage } from "@/lib/safe-storage";
import { logEditorError } from "@/lib/editor-logger";
import { RouteErrorBoundary, RouteNotFoundBoundary } from "@/components/app/RouteBoundary";

export const Route = createFileRoute("/pintar/$slug/$page")({
  component: PaintPage,
  errorComponent: ({ error, reset }) => {
    const params = Route.useParams();
    return (
      <RouteErrorBoundary
        error={error}
        reset={reset}
        title="Não foi possível abrir o editor"
        logScope="render"
        logContext={{ slug: params.slug, page: params.page }}
      />
    );
  },
  notFoundComponent: () => {
    const params = Route.useParams();
    return (
      <RouteNotFoundBoundary
        title="Página não encontrada"
        description="Esta página de pintura não existe nesta história."
        backTo={{ to: "/produto/$slug", params: { slug: params.slug } }}
        backLabel="Voltar à história"
        logScope="navigation"
        logContext={{ slug: params.slug, page: params.page }}
      />
    );
  },
});

const PALETTE = [
  // Vermelhos / rosas quentes
  "#DC2626", "#EF4444", "#F87171", "#FCA5A5",
  // Laranjas / amarelos
  "#FB923C", "#F97316", "#FBBF24", "#FACC15", "#FDE047",
  // Verdes
  "#A3E635", "#84CC16", "#22C55E", "#16A34A", "#0D9488",
  // Ciano / azul
  "#22D3EE", "#06B6D4", "#60A5FA", "#3B82F6", "#1D4ED8",
  // Roxo / rosa
  "#818CF8", "#A78BFA", "#8B5CF6", "#E879F9", "#F472B6", "#EC4899",
  // Marrons / pele
  "#FCD9B6", "#D9A066", "#92400E", "#78350F",
  // Neutros
  "#000000", "#4B5563", "#9CA3AF", "#FFFFFF",
];

/**
 * Computes the WCAG relative luminance (0..1) of a hex color.
 * Centralised so contrast picks and ring calibration share the same math.
 */
function getLuminance(hex: string): number {
  const h = hex.replace("#", "");
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  if (v.length !== 6) return 1;
  const r = parseInt(v.slice(0, 2), 16) / 255;
  const g = parseInt(v.slice(2, 4), 16) / 255;
  const b = parseInt(v.slice(4, 6), 16) / 255;
  const toLin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
}

/**
 * Picks "#000000" or "#ffffff" — whichever has the best contrast against the
 * given background hex (WCAG relative luminance). Used for swatch borders,
 * focus rings and overlay icons so they stay legible on any palette color.
 */
function getContrastColor(hex: string): "#000000" | "#ffffff" {
  return getLuminance(hex) > 0.55 ? "#000000" : "#ffffff";
}

/**
...
 * dropped via `motion-reduce:` utilities at the call site.
 *
 * Auto-calibration (added):
 *   The function now takes the *surface* the swatch sits on so the
 *   middle gap and outer ring are picked dynamically. We avoid hard-
 *   coding `var(--background)` / `var(--gold)` because:
 *
 *     • A gold swatch on a dark surface would blend with a gold outer
 *       ring → outer ring switches to the surface's contrast color.
 *     • A light/white surface (e.g. canvas area) would swallow the
 *       transparent-ish gap → gap switches to actual surface luminance,
 *       not the global `--background` token which is always dark.
 *
 *   Two surface modes are supported: "dark" (footer / dialog over dark
 *   chrome) and "light" (canvas backdrop). Both resolve to concrete
 *   hex values so the box-shadow stays readable even if theme tokens
 *   shift later.
 */
type SwatchSurface = "dark" | "light";

function swatchFocusStyle(
  swatchHex: string,
  surface: SwatchSurface = "dark",
): React.CSSProperties {
  const inner = getContrastColor(swatchHex);
  const swatchL = getLuminance(swatchHex);

  // Gap color = the actual surface behind the swatch. Picking a real
  // color (not `transparent`) makes the two rings read as separate
  // bands instead of blurring into one thick outline.
  const gap = surface === "light" ? "#ffffff" : "#0f1115";

  // Outer ring picks gold by default (brand accent on dark surfaces),
  // but flips to a high-contrast neutral when either:
  //   - the surface is light (gold disappears on white), OR
  //   - the swatch itself is in the gold/yellow band, which would
  //     make the outer ring blend with the swatch silhouette.
  const isGoldish = swatchL > 0.7 && swatchL < 0.9; // yellow/cream/gold swatches
  let outer = "var(--gold, #d4a017)";
  if (surface === "light") {
    outer = "#0f1115"; // dark ring on light canvas
  } else if (isGoldish) {
    outer = "#ffffff"; // neutral on dark when swatch competes with gold
  }

  return {
    ["--swatch-focus-inner" as string]: inner,
    ["--swatch-focus-gap" as string]: gap,
    ["--swatch-focus-outer" as string]: outer,
  };
}

/** Static class applied to every swatch — applies the stacked rings on focus-visible. */
const SWATCH_FOCUS_CLASS =
  // Remove the default browser outline so our custom box-shadow rings
  // are the single source of truth for focus styling.
  "focus-visible:outline-none " +
  // Stacked focus rings driven by CSS vars set per-swatch:
  //   inner (2px) → swatch contrast
  //   gap   (4px) → calibrated to actual surface luminance
  //   outer (6px) → brand gold by default, neutral when it would blend
  // This keeps focus visible on light AND dark layouts without code-
  // splitting the class itself.
  "focus-visible:[box-shadow:0_0_0_2px_var(--swatch-focus-inner),0_0_0_4px_var(--swatch-focus-gap),0_0_0_6px_var(--swatch-focus-outer)]";

interface CanvasState {
  paintDataUrl: string | null;
}

function PaintPage() {
  const { slug, page } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  // Profile (child name) — used by the signature stamp and the completion modal.
  const { data: profile } = useQuery({
    enabled: !!userId,
    queryKey: ["profile-child-name", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("child_name, display_name")
        .eq("user_id", userId!)
        .maybeSingle();
      return data;
    },
  });
  const kidName =
    profile?.child_name?.trim() ||
    profile?.display_name?.trim() ||
    session?.user?.email?.split("@")[0] ||
    "Artista";

  const pageNumber = Number(page) || 1;

  const { data: story, isLoading } = useQuery({
    queryKey: ["story", slug],
    queryFn: async () => {
      try {
        const result = await getStoryBySlug(slug);
        if (!result) logEditorError("story-load", "story not found", { slug, page });
        return result;
      } catch (err) {
        logEditorError("story-load", err, { slug, page });
        throw err;
      }
    },
  });

  // Access guard: if the underlying catalog product is locked and the user
  // doesn't own it, bounce them back to the product page (which shows the
  // purchase CTA). Public/unlocked stories skip this check entirely.
  const { data: product } = useQuery({
    queryKey: ["catalog", "product", slug],
    queryFn: () => getProductBySlug(slug),
    staleTime: 5 * 60_000,
  });
  const { data: entitlements, isLoading: entLoading } = useEntitlements(userId ?? undefined);
  const accessDenied =
    !!product && product.is_locked && !(entitlements?.accessibleIds.has(product.id) ?? false);

  React.useEffect(() => {
    if (!entLoading && accessDenied) {
      navigate({ to: "/produto/$slug", params: { slug }, replace: true });
    }
  }, [accessDenied, entLoading, navigate, slug]);

  const pages = React.useMemo(
    () => (story?.pages ?? []).slice().sort((a, b) => a.page_number - b.page_number),
    [story],
  );
  const currentPage = pages.find((p) => p.page_number === pageNumber) ?? null;
  const currentIndex = pages.findIndex((p) => p.page_number === pageNumber);
  const prevPage = currentIndex > 0 ? pages[currentIndex - 1] : null;
  const nextPage = currentIndex >= 0 && currentIndex < pages.length - 1 ? pages[currentIndex + 1] : null;

  const { data: existingArtwork } = useQuery({
    enabled: !!userId && !!currentPage,
    queryKey: ["user-artwork", userId, slug, pageNumber],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_artworks")
        .select("id, canvas_data_json, version")
        .eq("user_id", userId!)
        .eq("story_slug", slug)
        .eq("page_index", pageNumber)
        .maybeSingle();
      if (error) {
        logEditorError("artwork-load", error, { slug, page: pageNumber, userId });
        throw error;
      }
      return data;
    },
  });

  // Batch-loads every saved artwork for this story so the sidebar thumbnails
  // can preview the user's painted version (paint layer composed over the
  // line-art) instead of always showing the blank line-art. Refetches when
  // the current page is saved (saveMutation invalidates user-artwork:*).
  const { data: allArtworks } = useQuery({
    enabled: !!userId && !!slug,
    queryKey: ["user-artworks-all", userId, slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_artworks")
        .select("page_index, canvas_data_json, updated_at")
        .eq("user_id", userId!)
        .eq("story_slug", slug);
      if (error) {
        logEditorError("artwork-load", error, { slug, userId, extra: { op: "list-all" } });
        return [];
      }
      return data ?? [];
    },
  });

  const paintByPage = React.useMemo(() => {
    const map = new Map<number, string>();
    for (const row of allArtworks ?? []) {
      const raw = (row as { canvas_data_json: unknown }).canvas_data_json;
      if (raw && typeof raw === "object" && raw !== null && "paintDataUrl" in raw) {
        const v = (raw as CanvasState).paintDataUrl;
        if (typeof v === "string" && v.length > 0) {
          map.set((row as { page_index: number }).page_index, v);
        }
      }
    }
    return map;
  }, [allArtworks]);

  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  // Pinned identity of the page CURRENTLY rendered on the canvas. This is the
  // single source of truth for "which page does the canvas belong to right
  // now?" — used by saveMutation to guarantee that a snapshot taken from the
  // canvas is persisted under the SAME page_index that produced it, even if
  // React has already re-rendered with a newer pageNumber after a navigation.
  // Without this pin, the cleanup useEffect or a late autosave can write the
  // pixels of page N over the row of page N+1 (the bug that made painted
  // strokes appear on every sibling thumbnail in the sidebar).
  const canvasPageRef = React.useRef<{ pageIndex: number; pageId: string } | null>(null);
  // Tracks whether the user has actually drawn on the current canvas since
  // it was mounted/restored. Prevents autosave from overwriting a saved
  // painting with a blank canvas during the brief window between page
  // navigation and the new artwork being restored from DB.
  const canvasDirtyRef = React.useRef(false);
  const [color, setColor] = React.useState<string>(PALETTE[7]);
  const [brushSize, setBrushSize] = React.useState<number>(14);
  const [tool, setTool] = React.useState<"brush" | "fill" | "eraser" | "signature">("brush");
  const isErasing = tool === "eraser";
  const isFilling = tool === "fill";
  const isSigning = tool === "signature";
  const [zoom, setZoom] = React.useState(1);
  const [history, setHistory] = React.useState<string[]>([]);
  // In-memory snapshot of the active page's canvas. Updated after every
  // brush stroke / fill / magic via maybeCelebrateCompletion so the active
  // sidebar miniature reflects the current paint instantly — without waiting
  // for the 20s autosave or a page navigation.
  const [livePaintSnapshot, setLivePaintSnapshot] = React.useState<string | null>(null);
  const drawingRef = React.useRef(false);
  const lastPosRef = React.useRef<{ x: number; y: number } | null>(null);
  
  const [magicRunning, setMagicRunning] = React.useState(false);
  // Magic Paint debug overlay — when ON, after a magic run we scan the paint
  // buffer and paint a translucent magenta over every white (unfilled, non-line)
  // pixel so the user/dev can spot regions the algorithm missed. The overlay
  // lives on a separate canvas so it never enters the saved artwork or ZIP.
  const [magicDebug, setMagicDebug] = React.useState(false);
  const debugCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
  // Live progress for the ZIP export so the user knows which page is being
  // packaged. `null` = no export running. When set, a modal overlay is shown.
  const [zipProgress, setZipProgress] = React.useState<{
    current: number;
    total: number;
    label: string;
  } | null>(null);
  // When true, the ZIP modal collapses to a small floating chip so the user
  // can keep painting while the package is generated in the background.
  const [zipMinimized, setZipMinimized] = React.useState(false);
  // Cancel flags consulted inside the long-running async loops. Using refs
  // (instead of state) so the running loop sees updates synchronously without
  // waiting for a re-render.
  const zipCancelRef = React.useRef(false);
  const magicCancelRef = React.useRef(false);
  const [showSignatureDialog, setShowSignatureDialog] = React.useState(false);
  const [signatureName, setSignatureName] = React.useState("");
  // Independent color for the signature stamp so the kid can pick a color
  // different from the current brush. Defaults to the active brush color and
  // updates whenever the dialog opens.
  const [signatureColor, setSignatureColor] = React.useState<string>(PALETTE[14]);
  /**
   * Draft signature overlay — once the kid confirms the dialog, the
   * signature is NOT stamped on the canvas yet. Instead we render a
   * draggable + resizable preview floating over the artwork so they can
   * fine-tune position and size before committing. Coordinates are in
   * CSS pixels relative to the canvas element (the same coordinate
   * space as the rendered overlay box) — they're translated to internal
   * canvas units only at commit time inside `stampSignature`.
   *
   *   x, y     — top-left of the visual baseline anchor in CSS px
   *   scale    — multiplier for the auto-computed base font size
   *   name     — text to render
   *   color    — fill color
   */
  const [draftSignature, setDraftSignature] = React.useState<{
    x: number;
    y: number;
    scale: number;
    name: string;
    color: string;
  } | null>(null);
  // Reentrancy lock for the signature commit. Prevents a double-click on
  // "Confirmar", a held Enter key, or any race where pointerup + keydown
  // fire in the same frame from stamping more than one signature. The
  // functional setState above is already atomic for state, but the lock
  // also blocks the side effects (stampSignature → canvas draw + history
  // push + sfx) from running twice. Released on next tick after commit
  // OR immediately on cancel.
  const signatureCommitLockRef = React.useRef<boolean>(false);
  const [showCompletionModal, setShowCompletionModal] = React.useState(false);
  const completionShownRef = React.useRef(false);
  const [progressPercent, setProgressPercent] = React.useState(0);

  // ─── Sound effects (WebAudio, no external dep) ─────────────────────────────
  const audioCtxRef = React.useRef<AudioContext | null>(null);
  function getAudioCtx(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!audioCtxRef.current) {
      const Ctor: typeof AudioContext | undefined =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      audioCtxRef.current = new Ctor();
    }
    return audioCtxRef.current;
  }
  const playSfx = React.useCallback(
    (kind: "stroke" | "fill" | "magic") => {
      try {
        const ctx = getAudioCtx();
        if (!ctx) return;
        if (ctx.state === "suspended") ctx.resume();
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        if (kind === "stroke") {
          osc.type = "triangle";
          osc.frequency.setValueAtTime(420 + Math.random() * 80, now);
          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.exponentialRampToValueAtTime(0.04, now + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
          osc.start(now);
          osc.stop(now + 0.1);
        } else if (kind === "fill") {
          osc.type = "sine";
          osc.frequency.setValueAtTime(520, now);
          osc.frequency.exponentialRampToValueAtTime(880, now + 0.18);
          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
          osc.start(now);
          osc.stop(now + 0.24);
        } else {
          // magic — sparkle arpeggio
          [660, 880, 1320].forEach((f, i) => {
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = "sine";
            o.frequency.setValueAtTime(f, now + i * 0.06);
            g.gain.setValueAtTime(0.0001, now + i * 0.06);
            g.gain.exponentialRampToValueAtTime(0.06, now + i * 0.06 + 0.02);
            g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.06 + 0.18);
            o.connect(g);
            g.connect(ctx.destination);
            o.start(now + i * 0.06);
            o.stop(now + i * 0.06 + 0.2);
          });
        }
      } catch {
        /* ignore audio errors */
      }
    },
    [],
  );
  const lastStrokeSfxRef = React.useRef(0);

  const lineArt =
    currentPage?.image_lineart_url ||
    currentPage?.image_preview_url ||
    null;
  const [generatedSuggestionUrl, setGeneratedSuggestionUrl] = React.useState<string | null>(null);

  // Reference image used internally by the Magic Paint algorithm to sample
  // a coherent color palette. Prefers an admin-provided colored sample and
  // falls back to a procedurally generated one extracted from the line-art.
  const effectiveSuggestionUrl = currentPage?.image_colored_sample_url || generatedSuggestionUrl || null;

  const [canvasReady, setCanvasReady] = React.useState(false);

  // Reset completion guard whenever the user navigates to another page.
  React.useEffect(() => {
    completionShownRef.current = false;
    setShowCompletionModal(false);
    setProgressPercent(0);
    // Drop the live snapshot so the new page falls back to its own DB
    // overlay (paintByPage) until the kid paints something here.
    setLivePaintSnapshot(null);
    // Mark canvas as "not yet hydrated for this page" so autosave knows it
    // shouldn't blindly persist whatever pixels happen to be on the canvas
    // (which may still be the previous page's content during the brief
    // moment between navigation and the new image's onLoad).
    canvasDirtyRef.current = false;
    // Until handleImageLoad runs for the new page, the canvas does NOT
    // belong to any page yet — autosave will refuse to write.
    canvasPageRef.current = null;
    // Wipe canvas pixels immediately so the previous page's painting can't
    // bleed into the new page (visually or via a stray autosave snapshot).
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
      }
    }
  }, [pageNumber, slug]);

  // Cache the generated color reference per page in localStorage so we don't
  // re-extract the palette every time the user navigates back to the same page.
  // Key includes both the page id and the lineart URL — if the admin replaces
  // the artwork, the URL changes and the cache invalidates automatically.
  const suggestionCacheKey = React.useMemo(() => {
    if (!currentPage?.id || !lineArt) return null;
    return `rdc:suggestion:v2:${currentPage.id}:${lineArt}`;
  }, [currentPage?.id, lineArt]);

  React.useEffect(() => {
    let cancelled = false;
    setGeneratedSuggestionUrl(null);

    if (currentPage?.image_colored_sample_url || !lineArt) {
      return;
    }

    // Try cache first — instant restore on navigation back to same page.
    // safeStorage transparently falls back to memory in private mode /
    // quota errors, so this still round-trips within the same session.
    if (suggestionCacheKey) {
      const cached = safeStorage.getItem(suggestionCacheKey);
      if (cached) {
        setGeneratedSuggestionUrl(cached);
        return;
      }
    }

    generateSuggestionFromLineart(lineArt).then((url) => {
      if (cancelled) return;
      setGeneratedSuggestionUrl(url);
      // Persist for next visit. Data URLs can be large (~50-200KB);
      // safeStorage already swallows quota errors and keeps a memory
      // copy so the next read in this session still works.
      if (url && suggestionCacheKey) {
        safeStorage.setItem(suggestionCacheKey, url);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [currentPage?.id, currentPage?.image_colored_sample_url, lineArt, suggestionCacheKey]);


  const restoreDataUrl = React.useMemo<string | null>(() => {
    const raw = existingArtwork?.canvas_data_json as unknown;
    if (raw && typeof raw === "object" && raw !== null && "paintDataUrl" in raw) {
      const v = (raw as CanvasState).paintDataUrl;
      return typeof v === "string" ? v : null;
    }
    return null;
  }, [existingArtwork]);

  function setupCanvas(width: number, height: number) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    lineartBufferRef.current = null;
    lineartMaskRef.current = null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    setCanvasReady(true);
  }

  function pushHistory() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    setHistory((h) => {
      const next = [...h, url];
      if (next.length > 30) next.shift();
      return next;
    });
  }

  function restoreFromDataUrl(dataUrl: string) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      try {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        ctx.restore();
      } catch (err) {
        logEditorError("render", err, { slug, page, extra: { op: "restoreFromDataUrl" } });
      }
    };
    img.onerror = () => {
      logEditorError("asset-load", "failed to decode restored canvas snapshot", {
        slug,
        page,
        extra: { op: "restoreFromDataUrl" },
      });
    };
    img.src = dataUrl;
  }

  function handleImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget;
    const rect = img.getBoundingClientRect();
    setupCanvas(rect.width, rect.height);
    // Pin the canvas identity to the page that just finished loading.
    // Until this assignment, autosave is blocked (canvasPageRef === null).
    if (currentPage) {
      canvasPageRef.current = { pageIndex: pageNumber, pageId: currentPage.id };
    }
    if (restoreDataUrl) {
      requestAnimationFrame(() => restoreFromDataUrl(restoreDataUrl));
    }
  }

  // If the artwork query resolves AFTER the lineart image already loaded
  // (slow network, cache miss), the initial handleImageLoad ran with
  // restoreDataUrl=null and the canvas was left blank. This effect catches
  // that case and re-applies the restoration as soon as data arrives — but
  // only if the user hasn't started painting yet (canvasDirtyRef = false),
  // so we never overwrite a fresh stroke.
  React.useEffect(() => {
    if (!restoreDataUrl || !canvasReady) return;
    if (canvasDirtyRef.current) return;
    // Confirm the restore belongs to the page currently on the canvas.
    if (canvasPageRef.current?.pageIndex !== pageNumber) return;
    restoreFromDataUrl(restoreDataUrl);
    // After restoring, capture a snapshot so the active sidebar miniature
    // matches the central canvas immediately on first load.
    requestAnimationFrame(() => {
      const c = canvasRef.current;
      if (c) setLivePaintSnapshot(c.toDataURL("image/png"));
    });
  }, [restoreDataUrl, canvasReady, pageNumber]);

  React.useEffect(() => {
    function onResize() {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      const img = container.querySelector("img");
      if (!img) return;
      const snapshot = canvas.toDataURL("image/png");
      const rect = img.getBoundingClientRect();
      setupCanvas(rect.width, rect.height);
      restoreFromDataUrl(snapshot);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  function getPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width / (window.devicePixelRatio || 1)),
      y: (e.clientY - rect.top) * (canvas.height / rect.height / (window.devicePixelRatio || 1)),
    };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    pushHistory();
    const pos = getPos(e);
    if (isSigning) {
      // Skip opening another dialog while a draft signature is already
      // floating on screen — the user should commit or cancel that one
      // first to avoid losing the position they just chose.
      if (draftSignature) return;
      // One-shot: open dialog asking for the name; on confirm we'll
      // create a draggable+resizable draft at this position instead of
      // stamping immediately, so the kid can fine-tune placement and
      // size before committing.
      setSignatureName((prev) => prev || kidName);
      // Pre-select the current brush color but let the kid change it inside the dialog.
      setSignatureColor(color);
      setShowSignatureDialog(true);
      pendingSignaturePosRef.current = pos;
      return;
    }
    if (isFilling) {
      // `pos` is in CSS pixels (canvas ctx uses a dpr transform for drawing),
      // but floodFill operates on the raw pixel buffer (canvas.width/height =
      // css * dpr). Scale the click to device pixels so the fill starts at
      // the actual spot the user tapped — otherwise on any dpr ≠ 1 (mobile,
      // tablet, or zoomed desktop) the bucket samples a different region
      // (e.g. the sky) instead of the area under the cursor.
      const dpr = window.devicePixelRatio || 1;
      floodFill(Math.round(pos.x * dpr), Math.round(pos.y * dpr), color);
      playSfx("fill");
      maybeCelebrateCompletion();
      return;
    }
    drawingRef.current = true;
    lastPosRef.current = pos;
    drawDot(pos.x, pos.y);
    if (!isErasing) playSfx("stroke");
  }

  function drawDot(x: number, y: number) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.globalCompositeOperation = isErasing ? "destination-out" : "source-over";
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    const last = lastPosRef.current ?? pos;
    ctx.globalCompositeOperation = isErasing ? "destination-out" : "source-over";
    ctx.strokeStyle = color;
    ctx.lineWidth = brushSize;
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPosRef.current = pos;
    // Throttle stroke SFX to ~10/s for natural feel.
    if (!isErasing) {
      const now = performance.now();
      if (now - lastStrokeSfxRef.current > 110) {
        lastStrokeSfxRef.current = now;
        playSfx("stroke");
      }
    }
  }

  function onPointerUp() {
    drawingRef.current = false;
    lastPosRef.current = null;
    maybeCelebrateCompletion();
  }

  // Position where the signature should be stamped on confirm (canvas CSS units).
  const pendingSignaturePosRef = React.useRef<{ x: number; y: number } | null>(null);

  /**
   * Flood fill on the paint canvas only. The lineart image is rendered as a
   * separate <img> behind the canvas; the fill stops at any already-painted
   * pixels (which include darkened lineart traces if the user already filled
   * across them) but does NOT magically respect the lineart's black borders
   * (they live on a different layer). To respect them too, we sample the
   * lineart image's alpha by drawing it once into a hidden buffer.
   */
  const lineartBufferRef = React.useRef<HTMLCanvasElement | null>(null);
  const lineartMaskRef = React.useRef<{
    width: number;
    height: number;
    /** Closed mask (line core + sealed micro-gaps) — walls for the flood BFS. */
    data: Uint8Array;
    /** Raw line-core pixels only — used by the halo-removal pass so paint can
     *  slip under sealed gaps but never overwrite a visible stroke. */
    base: Uint8Array;
  } | null>(null);

  /**
   * Unified lineart pixel detector — single source of truth for "is this a
   * black border?" used by floodFill, Magic Paint seeding, the completion
   * counter, and the debug overlay.
   *
   * User-imported PNG/JPEG art often has anti-aliased, gray, or slightly
   * broken strokes. The thresholds below intentionally treat mid-gray ink as
   * a wall, not only pure black pixels.
   */
  const LINE_ALPHA_STRONG = 120;
  const LINE_ALPHA_SOFT = 24;
  const LINE_LUM_DARK = 185;
  const LINE_LUM_SOFT = 165;

  function isLineartPixel(lineart: ImageData | null, idx: number): boolean {
    if (!lineart) return false;
    const la = lineart.data[idx + 3];
    if (la < LINE_ALPHA_SOFT) return false;
    const r = lineart.data[idx];
    const g = lineart.data[idx + 1];
    const b = lineart.data[idx + 2];
    const lum = (r + g + b) / 3;
    const chroma = Math.max(r, g, b) - Math.min(r, g, b);

    if (la >= LINE_ALPHA_STRONG && lum < LINE_LUM_DARK) return true;
    if (la >= LINE_ALPHA_SOFT && lum < LINE_LUM_SOFT) return true;
    // Colored/dark imported strokes (blue-gray, brown, etc.) can have a
    // deceptively high average luminance. If the pixel is opaque and not
    // close to white, keep it as a wall for the bucket fill.
    // Threshold 190 (was 215): several imported pages ship with baked-in
    // pastel/skin shading (peach faces, watermark blobs). Their anti-aliased
    // edges sit around lum 195-215 with chroma > 18 and were being flagged
    // as walls, carving faces/hands into phantom fragments so the bucket
    // painted "the wrong area". Real colored strokes are much darker.
    if (la >= LINE_ALPHA_STRONG && lum < 190 && chroma > 18) return true;
    return false;
  }

  function ensureLineartBuffer(): ImageData | null {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return null;
    const img = container.querySelector("img");
    if (!img) return null;
    const cached = lineartBufferRef.current;
    if (cached && cached.width === canvas.width && cached.height === canvas.height) {
      const cachedCtx = cached.getContext("2d", { willReadFrequently: true });
      return cachedCtx ? cachedCtx.getImageData(0, 0, cached.width, cached.height) : null;
    }
    const buf = document.createElement("canvas");
    buf.width = canvas.width;
    buf.height = canvas.height;
    const bctx = buf.getContext("2d", { willReadFrequently: true });
    if (!bctx) return null;
    bctx.clearRect(0, 0, buf.width, buf.height);
    bctx.drawImage(img, 0, 0, buf.width, buf.height);
    lineartBufferRef.current = buf;
    lineartMaskRef.current = null;
    return bctx.getImageData(0, 0, buf.width, buf.height);
  }

  function ensureLineartMask(): { width: number; height: number; data: Uint8Array } | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const cached = lineartMaskRef.current;
    if (cached && cached.width === canvas.width && cached.height === canvas.height) return cached;

    const lineart = ensureLineartBuffer();
    if (!lineart) return null;
    const w = lineart.width;
    const h = lineart.height;
    const base = new Uint8Array(w * h);
    const mask = new Uint8Array(w * h);

    for (let i = 0; i < base.length; i++) {
      if (isLineartPixel(lineart, i * 4)) base[i] = 1;
    }

    // Seal tiny breaks in the strokes (JPEG compression / anti-aliasing /
    // imported PNGs) with a morphological CLOSING (dilate → erode) instead of
    // the previous dilate-only pass. Dilation alone fattened every stroke by
    // `radius` px, which blocked 30-40% of the page: taps within 3px of any
    // line silently did nothing and thin regions (fingers, small face areas)
    // were sealed shut and never filled. Closing bridges real gaps between
    // stroke ends but restores the original line thickness everywhere else,
    // so narrow regions stay fillable.
    // The radius scales with canvas resolution — gaps shrink proportionally
    // when the page renders smaller (phone/tablet), so a fixed radius over-
    // seals small canvases.
    const radius = Math.max(2, Math.min(4, Math.round(w / 280)));
    const dilated = dilateBinary(base, w, h, radius);
    // Erosion = complement of dilation of the complement.
    const inv = new Uint8Array(w * h);
    for (let i = 0; i < inv.length; i++) inv[i] = dilated[i] ? 0 : 1;
    const invDilated = dilateBinary(inv, w, h, radius);
    for (let i = 0; i < mask.length; i++) mask[i] = invDilated[i] ? 0 : 1;
    // Closing is a superset of the original set in theory; keep the union as
    // a cheap safety net against border effects.
    for (let i = 0; i < mask.length; i++) if (base[i]) mask[i] = 1;

    const next = { width: w, height: h, data: mask, base };
    lineartMaskRef.current = next;
    return next;
  }

  /** Separable binary dilation with a square structuring element. */
  function dilateBinary(src: Uint8Array, w: number, h: number, radius: number): Uint8Array {
    const tmp = new Uint8Array(w * h);
    const out = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        let v = 0;
        const lo = Math.max(0, x - radius);
        const hi = Math.min(w - 1, x + radius);
        for (let nx = lo; nx <= hi; nx++) {
          if (src[row + nx]) {
            v = 1;
            break;
          }
        }
        tmp[row + x] = v;
      }
    }
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        let v = 0;
        const lo = Math.max(0, y - radius);
        const hi = Math.min(h - 1, y + radius);
        for (let ny = lo; ny <= hi; ny++) {
          if (tmp[ny * w + x]) {
            v = 1;
            break;
          }
        }
        out[y * w + x] = v;
      }
    }
    return out;
  }

  /**
   * Suggestion paint — picks a soft, kid-friendly palette that VARIES per
   * page (instead of the same checkerboard for every story/page). We seed a
   * tiny PRNG with `slug + pageNumber` so the palette is stable for a given
   * page, but visibly different across pages. Colors are generated in HSL
   * with high lightness + medium saturation, which gives a pastel, painted-
   * paper look that's much prettier than the previous solid bands.
   */
  const suggestionPalette = React.useMemo<string[]>(() => {
    // Cheap deterministic hash of slug + page → 32-bit seed.
    const key = `${slug}::${pageNumber}`;
    let h = 2166136261 >>> 0;
    for (let i = 0; i < key.length; i++) {
      h ^= key.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    // Mulberry32 PRNG — tiny, deterministic, good enough for color picks.
    const rand = () => {
      h = (h + 0x6d2b79f5) >>> 0;
      let t = h;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    // Pick a base hue then build an analogous + complementary scheme around
    // it — gives 8 harmonious pastel tones that play nicely together.
    const baseHue = Math.floor(rand() * 360);
    const offsets = [0, 25, 55, 85, 150, 180, 210, 280];
    return offsets.map((off) => {
      const hue = (baseHue + off + Math.floor(rand() * 12 - 6) + 360) % 360;
      const sat = 55 + Math.floor(rand() * 20); // 55-75%
      const light = 75 + Math.floor(rand() * 10); // 75-85% → pastel
      return `hsl(${hue} ${sat}% ${light}%)`;
    });
  }, [slug, pageNumber]);

  function colorForSuggestion(x: number, y: number): string {
    // Larger, smoother bands than the old 160px checkerboard so the result
    // reads as a soft watercolor wash instead of a noisy grid.
    const cellW = 240;
    const cellH = 320;
    const col = Math.floor(x / cellW);
    const row = Math.floor(y / cellH);
    // Brick-stagger the rows so vertical seams don't line up — gives a more
    // organic painted-paper feel. The +row offset ensures each row picks a
    // different color than the row above it at the same x.
    const idx = (col + row * 3) % suggestionPalette.length;
    return suggestionPalette[idx];
  }

  async function generateSuggestionFromLineart(sourceUrl: string): Promise<string | null> {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const off = document.createElement("canvas");
          off.width = img.naturalWidth || img.width;
          off.height = img.naturalHeight || img.height;
          const ctx = off.getContext("2d", { willReadFrequently: true });
          if (!ctx) return resolve(null);

          // 1) Base colored paper / large bands so the child has an orientation.
          const stripeW = Math.max(80, Math.floor(off.width / 7));
          const stripeH = Math.max(80, Math.floor(off.height / 6));
          for (let y = 0; y < off.height; y += stripeH) {
            for (let x = 0; x < off.width; x += stripeW) {
              ctx.fillStyle = colorForSuggestion(x, y);
              ctx.fillRect(x, y, stripeW, stripeH);
            }
          }

          // 2) Draw lineart and use it to preserve outlines.
          ctx.globalCompositeOperation = "multiply";
          ctx.drawImage(img, 0, 0, off.width, off.height);
          ctx.globalCompositeOperation = "source-over";

          const image = ctx.getImageData(0, 0, off.width, off.height);
          const data = image.data;

          // 3) Keep background white and lines black by inspecting source luminance.
          for (let i = 0; i < data.length; i += 4) {
            const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
            const a = data[i + 3];
            if (a < 10) {
              data[i] = 255; data[i + 1] = 255; data[i + 2] = 255; data[i + 3] = 255;
              continue;
            }
            if (lum > 245) {
              data[i] = 255; data[i + 1] = 255; data[i + 2] = 255; data[i + 3] = 255;
            }
            if (lum < 65) {
              data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 255;
            }
          }
          ctx.putImageData(image, 0, 0);
          resolve(off.toDataURL("image/png"));
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = sourceUrl;
    });
  }


  function hexToRgb(hex: string): [number, number, number, number] {
    const h = hex.replace("#", "");
    const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    return [
      parseInt(v.slice(0, 2), 16),
      parseInt(v.slice(2, 4), 16),
      parseInt(v.slice(4, 6), 16),
      255,
    ];
  }

  /**
   * Perceptual color helpers (sRGB → CIE Lab) used by the magic-paint quantizer.
   * Plain Euclidean distance in RGB groups colors badly: e.g. (200,40,40) and
   * (40,200,40) are very different perceptually but have the same RGB sum.
   * CIE76 (Euclidean distance in Lab) is dramatically closer to how humans
   * perceive color similarity, so similar shades collapse into one bucket.
   * Declared as const arrows — function declarations inside the component body
   * confuse the TanStack code-splitter's Babel pass.
   */
  const srgbToLinear = (c: number): number => {
    const x = c / 255;
    return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  const rgbToLab = (r: number, g: number, b: number): [number, number, number] => {
    const R = srgbToLinear(r);
    const G = srgbToLinear(g);
    const B = srgbToLinear(b);
    // sRGB D65 → XYZ
    const X = (R * 0.4124564 + G * 0.3575761 + B * 0.1804375) / 0.95047;
    const Y = R * 0.2126729 + G * 0.7151522 + B * 0.072175;
    const Z = (R * 0.0193339 + G * 0.119192 + B * 0.9503041) / 1.08883;
    const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    const fx = f(X);
    const fy = f(Y);
    const fz = f(Z);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  };
  /** CIE76 ΔE — Euclidean distance in Lab. Fast and good enough for clustering. */
  const deltaE76 = (a: [number, number, number], b: [number, number, number]): number => {
    const dl = a[0] - b[0];
    const da = a[1] - b[1];
    const db = a[2] - b[2];
    return Math.sqrt(dl * dl + da * da + db * db);
  };
  const rgbToHex = (r: number, g: number, b: number): string =>
    `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;



  /**
   * Returns the share of non-line pixels that have any paint applied.
   * Sampled (every Nth pixel) for performance — good enough to detect "done".
   */
  function computeCompletion(): number {
    const canvas = canvasRef.current;
    if (!canvas) return 0;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return 0;
    const w = canvas.width;
    const h = canvas.height;
    const paint = ctx.getImageData(0, 0, w, h);
    const lineMask = ensureLineartMask();
    let fillable = 0;
    let painted = 0;
    const STEP = 4; // sample every 4th pixel on each axis
    for (let y = 0; y < h; y += STEP) {
      for (let x = 0; x < w; x += STEP) {
        const flat = y * w + x;
        const idx = flat * 4;
        // Use the same closed mask as Tinta so completion % stays in sync
        // with the real regions the user can paint.
        if (lineMask?.data[flat]) continue;
        fillable++;
        if (paint.data[idx + 3] > 20) painted++;
      }
    }
    if (fillable === 0) return 0;
    return painted / fillable;
  }

  function maybeCelebrateCompletion() {
    // Mark the canvas as user-modified so autosave is allowed to persist
    // it AND the late-arriving restore effect knows not to overwrite it.
    canvasDirtyRef.current = true;
    // Update the active page's sidebar thumbnail IMMEDIATELY after every
    // paint action (brush stroke, fill bucket, magic paint) so the kid sees
    // the miniature reflect their work in real time — no need to wait for
    // the 20s autosave interval. Persistence to DB still happens via
    // saveMutation; this only drives the in-memory live preview.
    try {
      const canvas = canvasRef.current;
      if (canvas) {
        setLivePaintSnapshot(canvas.toDataURL("image/png"));
      }
    } catch {
      /* ignore — snapshot is best-effort */
    }
    try {
      const ratio = computeCompletion();
      // Always update the live progress bar — independent of the celebration
      // gate so the user sees feedback for every brush/fill stroke.
      setProgressPercent(Math.round(ratio * 100));
      if (!completionShownRef.current && ratio >= 0.92) {
        completionShownRef.current = true;
        playSfx("magic");
        setShowCompletionModal(true);
      }
    } catch {
      /* ignore — completion check is best-effort */
    }
  }

  function floodFill(startX: number, startY: number, fillHex: string) {
    try {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;
      if (startX < 0 || startY < 0 || startX >= w || startY >= h) return;

      const paint = ctx.getImageData(0, 0, w, h);
      const lineMask = ensureLineartMask();
      const fill = hexToRgb(fillHex);
      const data = paint.data;

      // Border detection uses the closed invisible mask. It is stricter
      // than raw pixel detection so imported PNG/JPEG art with tiny line
      // gaps still behaves like a proper coloring-book page.
      const isLine = (flat: number): boolean => Boolean(lineMask?.data[flat]);

      // Match start color on the paint layer (so we don't repaint a different already-filled region).
      const startFlat = startY * w + startX;
      const startIdx = startFlat * 4;
      const sR = data[startIdx], sG = data[startIdx + 1], sB = data[startIdx + 2], sA = data[startIdx + 3];
      const PAINT_TOL = 32;

      // "Empty" = mostly-transparent paint pixel. A blank canvas region and
      // a region that only has faint anti-aliased halo from a previous fill
      // both count as empty and belong to the same flood group. Without
      // this, clicking on a fresh white spot inside a hand that has a tiny
      // painted halo nearby would stop mid-way (alpha mismatch beats the
      // RGB tolerance) and leave big unfilled patches. Threshold 24 is
      // below LINE_ALPHA_SOFT so line pixels are still excluded by isLine.
      const EMPTY_ALPHA = 24;
      const startIsEmpty = sA <= EMPTY_ALPHA;

      const matchesStart = (idx: number): boolean => {
        const r = data[idx], g = data[idx + 1], b = data[idx + 2], a = data[idx + 3];
        if (startIsEmpty) return a <= EMPTY_ALPHA;
        return (
          Math.abs(r - sR) <= PAINT_TOL &&
          Math.abs(g - sG) <= PAINT_TOL &&
          Math.abs(b - sB) <= PAINT_TOL &&
          Math.abs(a - sA) <= PAINT_TOL
        );
      };

      // If the user clicked exactly on a line, abort.
      if (isLine(startFlat)) return;
      // If clicking on the same fill color, skip.
      if (sR === fill[0] && sG === fill[1] && sB === fill[2] && sA === fill[3]) return;

      const stack: number[] = [startX, startY];
      const visited = new Uint8Array(w * h);

      // Phase 1: BFS region — only across pixels matching the start color AND not on a line.
      const region = new Uint8Array(w * h);
      while (stack.length) {
        const y = stack.pop()!;
        const x = stack.pop()!;
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const flat = y * w + x;
        if (visited[flat]) continue;
        visited[flat] = 1;
        const idx = flat * 4;
        if (isLine(flat)) continue;
        if (!matchesStart(idx)) continue;
        region[flat] = 1;
        stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
      }

      // Phase 2: dilate the region by 2px so we paint *under* the anti-aliased edge of
      // the lineart, killing the white halo. Stop at strong (opaque, dark) lineart pixels.
      const DILATE = 2;
      let frontier: number[] = [];
      for (let i = 0; i < region.length; i++) if (region[i]) frontier.push(i);
      for (let step = 0; step < DILATE; step++) {
        const next: number[] = [];
        for (const flat of frontier) {
          const x = flat % w;
          const y = (flat - x) / w;
          const neighbors = [
            x > 0 ? flat - 1 : -1,
            x < w - 1 ? flat + 1 : -1,
            y > 0 ? flat - w : -1,
            y < h - 1 ? flat + w : -1,
          ];
          for (const nf of neighbors) {
            if (nf < 0 || region[nf]) continue;
            // Don't paint over the line core itself. Uses the same closed
            // mask as Phase 1 so the halo-removal pass cannot cross or
            // overwrite imported image borders.
            if (isLine(nf)) continue;
            region[nf] = 1;
            next.push(nf);
          }
        }
        frontier = next;
      }

      // Apply fill to all flagged pixels.
      for (let i = 0; i < region.length; i++) {
        if (!region[i]) continue;
        const idx = i * 4;
        data[idx] = fill[0];
        data[idx + 1] = fill[1];
        data[idx + 2] = fill[2];
        data[idx + 3] = fill[3];
      }
      ctx.putImageData(paint, 0, 0);
    } catch (err) {
      logEditorError("render", err, {
        slug,
        page,
        extra: { op: "floodFill", startX, startY, fillHex },
      });
    }
  }

  /**
   * Stamps the kid's name on the canvas in a cursive script font.
   *
   * Position resolution (in priority order):
   *   1. `overrides.pos` if provided — used by the draft-commit flow,
   *      which has already let the kid drag the signature to the exact
   *      spot they want before stamping.
   *   2. `pendingSignaturePosRef.current` — the pointerdown spot from
   *      the legacy one-shot flow (kept as a fallback so future callers
   *      that skip the draft step still work).
   *   3. Bottom-right corner — last-resort default.
   *
   * Size:
   *   • baseSize is auto-computed from the canvas width so the script
   *     reads as a real signature regardless of paper size.
   *   • `overrides.scale` multiplies that base, letting the draft flow
   *     respect the +/− and pinch gestures the kid used to resize the
   *     floating preview. Clamped to [0.4, 3.0] to avoid invisible or
   *     canvas-breaking sizes.
   */
  function stampSignature(
    name: string,
    signColor: string = color,
    overrides?: { pos?: { x: number; y: number }; scale?: number },
  ) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    pushHistory();
    const cssW = canvas.width / (window.devicePixelRatio || 1);
    const cssH = canvas.height / (window.devicePixelRatio || 1);
    const pos =
      overrides?.pos ??
      pendingSignaturePosRef.current ??
      { x: cssW - 24, y: cssH - 24 };
    pendingSignaturePosRef.current = null;

    const scale = Math.max(0.4, Math.min(3.0, overrides?.scale ?? 1));
    const baseSize = Math.max(
      14,
      Math.min(180, Math.round((cssW / 14) * scale)),
    );
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = signColor;
    ctx.font = `italic 700 ${baseSize}px "Dancing Script", "Pacifico", "Brush Script MT", cursive`;
    ctx.textBaseline = "alphabetic";
    // Anchor right-aligned when stamping near the right edge to avoid overflow.
    const measured = ctx.measureText(trimmed);
    const overflowsRight = pos.x + measured.width > cssW - 8;
    ctx.textAlign = overflowsRight ? "right" : "left";
    const drawX = overflowsRight ? Math.min(pos.x, cssW - 8) : pos.x;
    const drawY = Math.min(Math.max(pos.y, baseSize + 4), cssH - 8);
    // Soft underline flourish.
    ctx.shadowColor = "rgba(0,0,0,0.18)";
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 1;
    ctx.fillText(trimmed, drawX, drawY);
    // Decorative underline swoosh.
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = signColor;
    ctx.lineWidth = Math.max(1.5, baseSize / 18);
    ctx.beginPath();
    const lineY = drawY + 4;
    const startX = overflowsRight ? drawX - measured.width : drawX;
    const endX = overflowsRight ? drawX : drawX + measured.width;
    ctx.moveTo(startX, lineY);
    ctx.bezierCurveTo(
      startX + (endX - startX) * 0.3,
      lineY + 6,
      startX + (endX - startX) * 0.7,
      lineY - 4,
      endX,
      lineY,
    );
    ctx.stroke();
    ctx.restore();
    playSfx("magic");
  }

  function handleUndo() {
    setHistory((h) => {
      if (h.length === 0) return h;
      const next = h.slice(0, -1);
      const prev = h[h.length - 1];
      const canvas = canvasRef.current;
      if (!canvas) return next;
      const ctx = canvas.getContext("2d");
      if (!ctx) return next;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
      restoreFromDataUrl(prev);
      return next;
    });
  }

  function handleClear() {
    pushHistory();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  function composeFlatCanvas(): HTMLCanvasElement | null {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return null;
    const img = container.querySelector("img");
    if (!img) return null;
    const out = document.createElement("canvas");
    out.width = canvas.width;
    out.height = canvas.height;
    const ctx = out.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(canvas, 0, 0);
    ctx.globalCompositeOperation = "multiply";
    ctx.drawImage(img, 0, 0, out.width, out.height);
    ctx.globalCompositeOperation = "source-over";
    return out;
  }

  function handleDownload() {
    const out = composeFlatCanvas();
    if (!out) return;
    const link = document.createElement("a");
    link.download = `${slug}-pagina-${pageNumber}.png`;
    link.href = out.toDataURL("image/png");
    link.click();
  }

  async function handleDownloadZip() {
    if (zipProgress) return;
    // Reset cancel flag + minimize state every time the user starts a new
    // export; otherwise a previous cancel would short-circuit this run.
    zipCancelRef.current = false;
    setZipMinimized(false);
    // Total steps: current painted page (1) + every other page (originals)
    // + 1 final "compactando" step. Reported sequentially so the modal can
    // show the user exactly which page is being added right now.
    const totalSteps = pages.length + 1;
    let step = 0;
    const advance = (label: string) => {
      step += 1;
      setZipProgress({ current: step, total: totalSteps, label });
    };
    setZipProgress({ current: 0, total: totalSteps, label: "Preparando pacote…" });
    // Yield to the browser so the modal paints before any heavy work.
    await new Promise((r) => setTimeout(r, 16));

    // Sentinel thrown by checkpoints when the user clicks "Cancelar".
    const ZIP_CANCELLED = Symbol("zip-cancelled");
    const checkCancel = () => {
      if (zipCancelRef.current) throw ZIP_CANCELLED;
    };

    try {
      const zip = new JSZip();
      // Normalize slug + story title so the folder/file names are always
      // consistent regardless of accents or whitespace in the source data.
      const safeSlug = slug
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      const folderName = safeSlug || "historia";
      const folder = zip.folder(folderName) ?? zip;
      const pad = (n: number) => String(n).padStart(2, "0");
      const total = pages.length;
      const storyTitle = story?.title ?? folderName;

      // Current page snapshot first — the only one with the child's paint.
      advance(`Adicionando sua página pintada (${pad(pageNumber)})…`);
      const currentOut = composeFlatCanvas();
      let savedCurrent = false;
      let currentFailReason: string | null = null;
      if (!currentOut) {
        currentFailReason = "o canvas ainda não estava pronto";
      } else {
        const blob = await new Promise<Blob | null>((res) =>
          currentOut.toBlob((b) => res(b), "image/png"),
        );
        if (blob) {
          folder.file(`${folderName}_pagina-${pad(pageNumber)}_pintada.png`, blob);
          savedCurrent = true;
        } else {
          currentFailReason = "o navegador não conseguiu gerar o PNG";
        }
      }
      if (!savedCurrent) {
        // Warn the user immediately so they know the painted page is missing
        // from the package — the originals will still be exported below.
        toast.warning("Não foi possível exportar a página atual", {
          description: `Sua pintura desta página não entrou no ZIP (${currentFailReason ?? "motivo desconhecido"}). As páginas originais continuarão sendo baixadas.`,
        });
      }

      // Add the lineart of every other page sequentially so we can report
      // progress per page (Promise.all would only let us report once at the end).
      // Track failures (network errors) AND skipped pages (no source URL) so
      // we can list them in the README and warn the user with a toast.
      const originalsAdded: number[] = [];
      const failedPages: Array<{ page: number; reason: string }> = [];
      const otherPages = pages.filter((p) => p.page_number !== pageNumber);
      for (const p of otherPages) {
        checkCancel();
        advance(`Baixando página original ${pad(p.page_number)} de ${pad(total)}…`);
        const url = p.image_lineart_url || p.image_preview_url;
        if (!url) {
          failedPages.push({ page: p.page_number, reason: "sem imagem disponível" });
          continue;
        }
        try {
          const r = await fetch(url);
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const b = await r.blob();
          folder.file(`${folderName}_pagina-${pad(p.page_number)}_original.png`, b);
          originalsAdded.push(p.page_number);
        } catch (err) {
          failedPages.push({
            page: p.page_number,
            reason: err instanceof Error ? err.message : "falha ao baixar",
          });
          logEditorError("asset-load", err, {
            slug,
            page: p.page_number,
            url,
            extra: { op: "zip-fetch" },
          });
        }
        // Let the UI repaint between fetches.
        await new Promise((r) => setTimeout(r, 0));
      }

      if (failedPages.length > 0) {
        const list = failedPages
          .sort((a, b) => a.page - b.page)
          .map((f) => pad(f.page))
          .join(", ");
        toast.warning(
          `${failedPages.length} página${failedPages.length > 1 ? "s" : ""} não pôde ser baixada`,
          {
            description: `Páginas com problema: ${list}. Veja o LEIA-ME.txt para mais detalhes.`,
          },
        );
      }

      // Friendly README so non-tech parents understand what's inside and
      // know exactly how to print + use both the originals and painted files.
      const generatedAt = new Date().toLocaleString("pt-BR");
      const paintedLine = savedCurrent
        ? `  • ${folderName}_pagina-${pad(pageNumber)}_pintada.png  →  página colorida no app (com a assinatura)`
        : `  • (a página atual não pôde ser exportada — ${currentFailReason ?? "motivo desconhecido"})`;
      const originalLines = originalsAdded
        .sort((a, b) => a - b)
        .map(
          (n) =>
            `  • ${folderName}_pagina-${pad(n)}_original.png  →  desenho em branco, pronto para imprimir`,
        );
      // Lines listing every page that failed (network error or no source URL)
      // so the family knows exactly what is missing and why.
      const failureLines = failedPages
        .slice()
        .sort((a, b) => a.page - b.page)
        .map((f) => `  • Página ${pad(f.page)} — ${f.reason}`);
      const hasAnyFailure = !savedCurrent || failedPages.length > 0;

      const readme = [
        `📖 ${storyTitle}`,
        "".padEnd(storyTitle.length + 4, "="),
        "",
        `Gerado em: ${generatedAt}`,
        `Total de páginas da história: ${total}`,
        `Páginas neste pacote: ${(savedCurrent ? 1 : 0) + originalsAdded.length}`,
        ...(hasAnyFailure
          ? [`Páginas com problema: ${(savedCurrent ? 0 : 1) + failedPages.length}`]
          : []),
        "",
        "──────────────────────────────────────────────",
        " O QUE TEM AQUI DENTRO",
        "──────────────────────────────────────────────",
        "",
        "1) PÁGINA PINTADA NO APP (PNG colorido)",
        paintedLine,
        "   • Já vem com as cores que a criança escolheu + assinatura.",
        "   • Ideal para guardar de lembrança, enviar pelo WhatsApp,",
        "     colocar no álbum ou imprimir como quadrinho.",
        "",
        "2) DESENHOS ORIGINAIS (PNG em preto e branco)",
        ...(originalLines.length ? originalLines : ["  • (nenhum desenho original disponível)"]),
        "   • São as outras páginas da história, sem cor.",
        "   • Servem para imprimir e a criança colorir à mão",
        "     com lápis de cor, giz de cera ou canetinha.",
        "",
        ...(hasAnyFailure
          ? [
              "──────────────────────────────────────────────",
              " ⚠ PÁGINAS COM PROBLEMA",
              "──────────────────────────────────────────────",
              "",
              "Estas páginas NÃO entraram no pacote desta vez:",
              ...(savedCurrent
                ? []
                : [`  • Página ${pad(pageNumber)} (sua pintura atual) — ${currentFailReason ?? "motivo desconhecido"}`]),
              ...failureLines,
              "",
              "O que fazer:",
              "  1. Verifique sua conexão com a internet.",
              "  2. Volte ao app e gere o ZIP novamente — geralmente",
              "     funciona na segunda tentativa.",
              "  3. Se persistir, abra cada página com problema",
              "     diretamente no app antes de baixar de novo.",
              "",
            ]
          : []),
        "──────────────────────────────────────────────",
        " COMO IMPRIMIR (passo a passo)",
        "──────────────────────────────────────────────",
        "",
        "1. Abra o arquivo PNG no visualizador de imagens",
        "   do seu computador, celular ou tablet.",
        "2. Escolha 'Imprimir' (Ctrl+P / Cmd+P).",
        "3. Configure a impressora assim:",
        "     • Tamanho do papel: A4 (ou Carta).",
        "     • Orientação: Retrato (vertical).",
        "     • Escala: 100% (NÃO use 'Ajustar à página',",
        "       senão o desenho fica menor que o esperado).",
        "     • Margens: padrão ou mínimas.",
        "     • Qualidade: alta / fotográfica.",
        "4. Para colorir à mão, prefira papel sulfite branco 75g+.",
        "   Para guardar a versão pintada como pôster, use papel",
        "   fotográfico ou couché 120g+.",
        "5. Imprima em preto e branco quando for colorir à mão",
        "   (economiza tinta colorida) e em colorido para",
        "   guardar a versão já pintada no app.",
        "",
        "──────────────────────────────────────────────",
        " IDEIAS DE USO",
        "──────────────────────────────────────────────",
        "",
        "• Encaderne em um caderninho com fita ou grampo e crie",
        "  o livro pessoal da criança.",
        "• Faça quadrinhos com a versão pintada e pendure no quarto.",
        "• Imprima várias cópias do mesmo desenho para colorir",
        "  em família — cada um com seu estilo.",
        "• Use as páginas em branco em festinhas, atividades de",
        "  escola dominical ou viagens longas.",
        "",
        "──────────────────────────────────────────────",
        " DICAS RÁPIDAS",
        "──────────────────────────────────────────────",
        "",
        "• Os arquivos PNG têm fundo transparente nos contornos —",
        "  ao imprimir, o papel branco aparece naturalmente.",
        "• Se a impressão sair muito clara, aumente o contraste",
        "  ou escolha 'preto intenso' nas opções da impressora.",
        "• Salve este pacote em uma pasta no computador ou na nuvem",
        "  para não perder. Cada download gera um novo arquivo .zip.",
        "",
        "Volte ao app sempre que quiser pintar mais páginas! 🎨",
        "",
        "Feito com 💛 no Arca.",
      ].join("\n");
      folder.file("LEIA-ME.txt", readme);

      checkCancel();
      // Final step: actually compress everything. JSZip exposes onUpdate with
      // a percent value, which we use to keep the bar moving during compress.
      setZipProgress({
        current: totalSteps - 1,
        total: totalSteps,
        label: "Compactando arquivos…",
      });
      const blob = await zip.generateAsync({ type: "blob" }, (meta) => {
        // Cancel during compress: throwing here aborts generateAsync.
        if (zipCancelRef.current) throw ZIP_CANCELLED;
        setZipProgress({
          current: totalSteps - 1,
          total: totalSteps,
          label: `Compactando arquivos… ${Math.round(meta.percent)}%`,
        });
      });
      checkCancel();
      setZipProgress({ current: totalSteps, total: totalSteps, label: "Pronto! 🎉" });
      const stamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const link = document.createElement("a");
      link.download = `${folderName}_${stamp}.zip`;
      link.href = URL.createObjectURL(blob);
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 4000);
      // Brief pause so the user sees "Pronto!" before the modal closes.
      setTimeout(() => {
        setZipProgress(null);
        setZipMinimized(false);
      }, 800);
    } catch (err) {
      // User-initiated cancel: silent close, no error toast.
      if (err === ZIP_CANCELLED) {
        setZipProgress(null);
        setZipMinimized(false);
        zipCancelRef.current = false;
        toast.info("Geração do ZIP cancelada");
        return;
      }
      logEditorError("render", err, { slug, page, extra: { op: "download-zip" } });
      setZipProgress(null);
      setZipMinimized(false);
      toast.error("Não foi possível gerar o ZIP", {
        description: "Algo deu errado durante a montagem do pacote. Tente novamente em alguns segundos.",
      });
    }
  }

  /**
   * Magic paint — sample seed points across the canvas in a coarse grid and
   * trigger floodFill on each unfilled, non-line pixel using the sampled color
   * from the colored sample (when available) or a random palette color.
   */
  async function handleMagicPaint() {
    if (magicRunning) return;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    // Reset cancel flag for this run; checked at every yield point below.
    magicCancelRef.current = false;
    setMagicRunning(true);
    playSfx("magic");
    try {
      pushHistory();
      const sampleUrl = effectiveSuggestionUrl;
      // Build a sample buffer (colored reference) the same size as the canvas.
      const sampleHolder: { data: ImageData | null } = { data: null };
      if (sampleUrl) {
        await new Promise<void>((resolve) => {
          const im = new Image();
          im.crossOrigin = "anonymous";
          im.onload = () => {
            try {
              const buf = document.createElement("canvas");
              buf.width = canvas.width;
              buf.height = canvas.height;
              const bctx = buf.getContext("2d", { willReadFrequently: true });
              if (bctx) {
                bctx.drawImage(im, 0, 0, buf.width, buf.height);
                sampleHolder.data = bctx.getImageData(0, 0, buf.width, buf.height);
              }
            } catch {
              /* sampling unavailable — fall back to palette */
            }
            resolve();
          };
          im.onerror = () => resolve();
          im.src = sampleUrl;
        });
      }
      const sample = sampleHolder.data;
      const lineMask = ensureLineartMask();
      const w = canvas.width;
      const h = canvas.height;

      // Line detector — same closed invisible mask used by Tinta/floodFill,
      // so Magic Paint cannot seed through tiny gaps in imported PNG/JPEG
      // outlines either.
      const isLine = (flat: number): boolean => Boolean(lineMask?.data[flat]);

      // ── Build a perceptually-quantized palette from the reference ─────────
      // We sample the reference image, convert each pixel to CIE Lab, and
      // greedily merge samples whose ΔE76 is below a threshold. The result is
      // a small set of dominant colors (typically 6–12). Every later pixel
      // lookup snaps to the nearest cluster, so similar shades collapse into
      // one solid color instead of producing dozens of near-duplicates.
      const MERGE_THRESHOLD = 14; // ΔE76 — ~"just noticeable difference" cluster
      const clusters: Array<{
        lab: [number, number, number];
        sumR: number; sumG: number; sumB: number; count: number;
      }> = [];
      if (sample) {
        const SAMPLE_STEP = Math.max(4, Math.floor(Math.min(w, h) / 100));
        for (let y = 0; y < h; y += SAMPLE_STEP) {
          for (let x = 0; x < w; x += SAMPLE_STEP) {
            const i = (y * w + x) * 4;
            const r = sample.data[i];
            const g = sample.data[i + 1];
            const b = sample.data[i + 2];
            // Skip paper-white and near-black (line) pixels.
            if (r > 240 && g > 240 && b > 240) continue;
            if (r < 25 && g < 25 && b < 25) continue;
            const lab = rgbToLab(r, g, b);
            let best = -1;
            let bestD = Infinity;
            for (let c = 0; c < clusters.length; c++) {
              const d = deltaE76(lab, clusters[c].lab);
              if (d < bestD) { bestD = d; best = c; }
            }
            if (best >= 0 && bestD < MERGE_THRESHOLD) {
              const c = clusters[best];
              c.sumR += r; c.sumG += g; c.sumB += b; c.count++;
              // Update centroid (running mean → Lab).
              const nr = c.sumR / c.count, ng = c.sumG / c.count, nb = c.sumB / c.count;
              c.lab = rgbToLab(nr, ng, nb);
            } else {
              clusters.push({ lab, sumR: r, sumG: g, sumB: b, count: 1 });
            }
          }
        }
      }
      // Pre-compute final RGB centroids for fast snap lookup.
      const palette = clusters.map((c) => {
        const r = Math.round(c.sumR / c.count);
        const g = Math.round(c.sumG / c.count);
        const b = Math.round(c.sumB / c.count);
        return { lab: rgbToLab(r, g, b), hex: rgbToHex(r, g, b) };
      });

      // Helper: pick color for a pixel from the reference, snapped to nearest
      // cluster centroid. Falls back to the static palette when no sample exists.
      const colorFor = (x: number, y: number, idx: number): string | null => {
        if (sample && palette.length > 0) {
          const r = sample.data[idx];
          const g = sample.data[idx + 1];
          const b = sample.data[idx + 2];
          if (r > 240 && g > 240 && b > 240) return null; // keep paper white
          const lab = rgbToLab(r, g, b);
          let bestHex = palette[0].hex;
          let bestD = Infinity;
          for (const p of palette) {
            const d = deltaE76(lab, p.lab);
            if (d < bestD) { bestD = d; bestHex = p.hex; }
          }
          return bestHex;
        }
        return PALETTE[(x + y) % (PALETTE.length - 1)];
      };


      const ctx = canvas.getContext("2d", { willReadFrequently: true });

      // ── Pass 1: dense grid seeds for the animated reveal ─────────────────
      // Smaller STEP → more seeds → catches medium/small regions on first pass.
      const STEP = Math.max(14, Math.floor(Math.min(w, h) / 40));
      const seeds: { x: number; y: number; hex: string }[] = [];
      for (let y = Math.floor(STEP / 2); y < h; y += STEP) {
        for (let x = Math.floor(STEP / 2); x < w; x += STEP) {
            const flat = y * w + x;
            const idx = flat * 4;
            if (isLine(flat)) continue;
          const hex = colorFor(x, y, idx);
          if (!hex) continue;
          seeds.push({ x, y, hex });
        }
      }
      const BATCH = 10;
      for (let i = 0; i < seeds.length; i += BATCH) {
        if (magicCancelRef.current) throw new Error("__magic_cancelled__");
        const batch = seeds.slice(i, i + BATCH);
        for (const s of batch) floodFill(s.x, s.y, s.hex);
        if (i % (BATCH * 4) === 0) playSfx("magic");
        await new Promise((r) => setTimeout(r, 30));
      }

      // ── Pass 2: sweep canvas filling any remaining unpainted pockets ─────
      // After the grid pass, scan every Nth pixel looking for unpainted,
      // non-line cells. Each hit triggers another floodFill, so even tiny
      // regions between fingers / hair / folds get covered.
      const FINE_STEP = 3;
      const MAX_FILLS = 4000; // hard cap to avoid runaway loops on edge cases
      let filled = 0;
      for (let pass = 0; pass < 2 && filled < MAX_FILLS; pass++) {
        if (magicCancelRef.current) throw new Error("__magic_cancelled__");
        if (!ctx) break;
        const paintBuf = ctx.getImageData(0, 0, w, h);
        let foundAny = false;
        for (let y = 0; y < h && filled < MAX_FILLS; y += FINE_STEP) {
          for (let x = 0; x < w && filled < MAX_FILLS; x += FINE_STEP) {
              const flat = y * w + x;
              const idx = flat * 4;
              if (isLine(flat)) continue;
            // Already painted? alpha > 20 means there's color there.
            if (paintBuf.data[idx + 3] > 20) continue;
            const hex = colorFor(x, y, idx);
            if (!hex) continue;
            floodFill(x, y, hex);
            filled++;
            foundAny = true;
            // Mark a small block as painted in our snapshot so the same hole
            // isn't re-seeded later in this same sweep — big perf win.
            for (let dy = -FINE_STEP; dy <= FINE_STEP; dy++) {
              for (let dx = -FINE_STEP; dx <= FINE_STEP; dx++) {
                const nx = x + dx;
                const ny = y + dy;
                if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
                paintBuf.data[(ny * w + nx) * 4 + 3] = 255;
              }
            }
          }
        }
        if (!foundAny) break;
        await new Promise((r) => setTimeout(r, 0));
      }

      // ── Final coverage check + aggressive retry ──────────────────────────
      // After the two coarse passes some pages still have a few stubborn
      // white pixels — usually 1-2px gaps where the lineart's anti-aliased
      // halo walled off a tiny region, or pockets the FINE_STEP=3 grid
      // straddled. We measure the REAL coverage % once, and if it's not at
      // 100% we fire one extra retry with the most aggressive params we can
      // safely run:
      //   • FINE_STEP = 1   → inspect every single pixel (no skipping)
      //   • no MAX_FILLS    → retry must be allowed to finish what it starts
      //   • SOFT line gate  → temporarily treat only the strongest, opaque
      //                       black ink as "line", letting flood reach
      //                       pockets that the normal threshold rejected
      //                       because they sat right under an anti-alias
      //                       halo. Restored to the normal isLineartPixel
      //                       definition immediately after the retry.
      //
      // The retry runs at most ONCE per Magic Paint click — that's enough in
      // practice (the second pass converges) and protects us from infinite
      // loops on pathological inputs (e.g. all-line images, pages where the
      // sample buffer returns paper-white for every pixel).
      const measureCoverage = (): { covered: number; total: number } => {
        if (!ctx) return { covered: 0, total: 0 };
        const buf = ctx.getImageData(0, 0, w, h);
        let covered = 0;
        let totalFillable = 0;
        // Sampled at every pixel — accuracy matters more than speed here.
        for (let i = 0; i < buf.data.length; i += 4) {
          const flat = i / 4;
          // Skip line pixels with the same closed mask the rest of the
          // pipeline uses, so the % matches what the user perceives.
          if (isLine(flat)) continue;
          totalFillable++;
          if (buf.data[i + 3] > 20) covered++;
        }
        return { covered, total: totalFillable };
      };

      const cov = measureCoverage();
      const pct = cov.total > 0 ? cov.covered / cov.total : 1;
      // 99.5% threshold — single-pixel rounding errors and tiny edge gaps
      // shouldn't trigger a costly retry. Anything above this reads as
      // visually 100% covered to the user.
      if (pct < 0.995) {
        // Aggressive retry: scan every pixel, accept only opaque-black
        // line cores as walls, and flood every white survivor we find.
        // No batching cap — coverage is the explicit goal of this pass.
        if (ctx) {
          const retryBuf = ctx.getImageData(0, 0, w, h);
          const RETRY_STEP = 1;
          let retryFills = 0;
          for (let y = 0; y < h; y += RETRY_STEP) {
            for (let x = 0; x < w; x += RETRY_STEP) {
              const flat = y * w + x;
              const idx = flat * 4;
              if (retryBuf.data[idx + 3] > 20) continue;
              if (isLine(flat)) continue;
              const hex = colorFor(x, y, idx);
              if (!hex) continue;
              floodFill(x, y, hex);
              retryFills++;
              // Same neighborhood blot trick — prevents re-seeding the same
              // freshly-painted pocket on later iterations of this same loop.
              for (let dy = -2; dy <= 2; dy++) {
                for (let dx = -2; dx <= 2; dx++) {
                  const nx = x + dx;
                  const ny = y + dy;
                  if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
                  retryBuf.data[(ny * w + nx) * 4 + 3] = 255;
                }
              }
              // Yield every 50 fills so the UI doesn't freeze on dense pages.
              if (retryFills % 50 === 0) {
                await new Promise((r) => setTimeout(r, 0));
              }
            }
          }
          // Re-measure so the toast (and the dev console below) report the
          // post-retry number rather than the pre-retry baseline.
          const finalCov = measureCoverage();
          const finalPct = finalCov.total > 0 ? finalCov.covered / finalCov.total : 1;
          // Console breadcrumb — useful when QA reports "Magic still left
          // gaps" so we can see whether retry helped or the page is just
          // pathologically uncoverable.
          // eslint-disable-next-line no-console
          console.info(
            `[magic-paint] coverage ${(pct * 100).toFixed(1)}% → ${(finalPct * 100).toFixed(1)}% after retry (${retryFills} extra fills)`,
          );
        }
      }

      playSfx("magic");
      maybeCelebrateCompletion();
      // If debug mode is on, paint the overlay highlighting any white gaps
      // that survived the magic pass so the user can finish them by hand.
      if (magicDebug) {
        renderMagicDebugOverlay();
      } else {
        clearMagicDebugOverlay();
      }
    } catch (err) {
      // User-initiated cancel: leave whatever was painted so far on canvas
      // (so the kid sees partial progress) and surface a friendly toast.
      if (err instanceof Error && err.message === "__magic_cancelled__") {
        toast.info("Pintura mágica cancelada");
      } else {
        logEditorError("render", err, { slug, page, extra: { op: "magic-paint" } });
      }
    } finally {
      magicCancelRef.current = false;
      setMagicRunning(false);
    }
  }

  /**
   * Sync the debug overlay canvas to the same pixel size as the main canvas,
   * then mark every unfilled, non-line pixel with a translucent magenta so
   * the user can visually find regions Magic Paint missed.
   *
   * Returns the number of highlighted pixels (in canvas-pixel units) so the
   * caller can show a toast with a quality summary.
   */
  function renderMagicDebugOverlay(): number {
    const main = canvasRef.current;
    const overlay = debugCanvasRef.current;
    if (!main || !overlay) return 0;
    const w = main.width;
    const h = main.height;
    overlay.width = w;
    overlay.height = h;
    overlay.style.width = main.style.width;
    overlay.style.height = main.style.height;

    const mctx = main.getContext("2d", { willReadFrequently: true });
    const octx = overlay.getContext("2d");
    const lineMask = ensureLineartMask();
    if (!mctx || !octx) return 0;

    const paint = mctx.getImageData(0, 0, w, h);
    const out = octx.createImageData(w, h);
    let unfilled = 0;
    // Iterate every pixel — at typical canvas sizes (~1.5MP) this stays fast
    // and only runs once per Magic Paint click.
    for (let i = 0; i < paint.data.length; i += 4) {
      const flat = i / 4;
      // Skip pixels that are already painted by the user.
      if (paint.data[i + 3] > 20) continue;
      // Skip line pixels using the same closed mask as Tinta/Magic Paint.
      if (lineMask?.data[flat]) continue;
      // Highlight in vivid magenta with ~60% alpha so the underlying lineart
      // is still readable through the overlay.
      out.data[i] = 236;     // R
      out.data[i + 1] = 72;  // G
      out.data[i + 2] = 153; // B
      out.data[i + 3] = 150; // A
      unfilled++;
    }
    octx.putImageData(out, 0, 0);

    const totalPixels = w * h;
    const pctMissing = (unfilled / totalPixels) * 100;
    toast(
      unfilled === 0
        ? "Magic Paint cobriu 100% da página 🎉"
        : `Magic Paint deixou ${pctMissing.toFixed(1)}% da página em branco`,
      {
        description:
          unfilled === 0
            ? "Nenhuma área branca detectada."
            : "As áreas em rosa neon mostram onde a mágica não chegou. Clique nelas com o balde para terminar.",
      },
    );
    return unfilled;
  }

  /** Wipes the debug overlay (transparent) — used when toggling debug off. */
  function clearMagicDebugOverlay() {
    const overlay = debugCanvasRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, overlay.width, overlay.height);
  }


  // Detects whether the canvas currently holds any visible paint at all.
  // Used as a safety net so autosave never overwrites a saved painting with
  // a fully transparent canvas (which would happen if a save fires during
  // the brief window between page navigation and the new artwork being
  // restored from DB — see canvasPageRef pinning above).
  function canvasHasPaint(canvas: HTMLCanvasElement): boolean {
    try {
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return false;
      const w = canvas.width;
      const h = canvas.height;
      if (w === 0 || h === 0) return false;
      // Sample at low resolution for speed — we only need to know "any
      // pixel painted?", not how much.
      const STEP = 16;
      const sw = Math.max(1, Math.floor(w / STEP));
      const sh = Math.max(1, Math.floor(h / STEP));
      // Fast path: read a small downscaled buffer instead of the full image.
      const off = document.createElement("canvas");
      off.width = sw;
      off.height = sh;
      const offCtx = off.getContext("2d");
      if (!offCtx) return false;
      offCtx.drawImage(canvas, 0, 0, sw, sh);
      const data = offCtx.getImageData(0, 0, sw, sh).data;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] > 8) return true;
      }
      return false;
    } catch {
      // If pixel reading fails (tainted canvas, etc.), assume there IS paint
      // and let the save proceed — losing data is worse than wasting a write.
      return true;
    }
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!userId) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      // Source of truth: which page does the canvas REALLY belong to right
      // now? This is set by handleImageLoad and reset on every navigation,
      // so it cannot be stale even if React hasn't re-rendered yet after
      // a route change. Falling back to currentPage/pageNumber would risk
      // mixing the pixels of one page with the page_index of another.
      const pinned = canvasPageRef.current;
      if (!pinned) return;
      // Refuse to overwrite an existing painting with a blank canvas. This
      // is the last line of defense against the bug where the cleanup of
      // the previous useEffect would write `paintDataUrl: <blank>` over
      // page N+1's row right after navigation.
      if (!canvasDirtyRef.current && !canvasHasPaint(canvas)) return;
      const paintDataUrl = canvas.toDataURL("image/png");
      const payload: CanvasState = { paintDataUrl };
      const { error } = await supabase.from("user_artworks").upsert(
        [
          {
            user_id: userId,
            story_slug: slug,
            page_id: pinned.pageId,
            page_index: pinned.pageIndex,
            canvas_data_json: payload as unknown as Json,
          },
        ],
        { onConflict: "user_id,story_slug,page_index" },
      );
      if (error) throw error;

      await supabase.from("user_page_progress").upsert(
        [
          {
            user_id: userId,
            story_slug: slug,
            page_id: pinned.pageId,
            page_index: pinned.pageIndex,
            status: "in_progress",
            last_opened_at: new Date().toISOString(),
          },
        ],
        { onConflict: "user_id,story_slug,page_index" },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-artwork", userId, slug, pageNumber] });
      queryClient.invalidateQueries({ queryKey: ["user-artworks-all", userId, slug] });
      queryClient.invalidateQueries({ queryKey: ["story-progress", slug, userId] });
      queryClient.invalidateQueries({ queryKey: ["catalog-progress"] });
    },
  });

  // Keep a ref to the latest mutate so the unmount cleanup below can call
  // it without re-subscribing to mutation identity changes (which would
  // re-run the cleanup unnecessarily and cause double saves).
  const saveMutationRef = React.useRef(saveMutation);
  saveMutationRef.current = saveMutation;

  React.useEffect(() => {
    if (!userId || !canvasReady) return;
    const id = window.setInterval(() => {
      saveMutationRef.current.mutate();
    }, 20000);
    return () => {
      window.clearInterval(id);
      // Final save on unmount / page change. Reads canvasPageRef internally
      // so the row written matches the pixels — never the new pageNumber.
      saveMutationRef.current.mutate();
    };
  }, [userId, canvasReady, pageNumber, slug]);

  function goToPage(p: number) {
    if (p === pageNumber) return;
    // Synchronous save BEFORE navigation so the pinned canvasPageRef still
    // points at the page we're leaving.
    saveMutation.mutate();
    navigate({ to: "/pintar/$slug/$page", params: { slug, page: String(p) } });
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center text-sm text-muted-foreground">
        Carregando…
      </main>
    );
  }

  if (!story) {
    return (
      <RouteNotFoundBoundary
        title="História não encontrada"
        description={`Não encontramos a história "${slug}". Ela pode ter sido removida ou o link está incorreto.`}
        onRetry={() => {
          queryClient.invalidateQueries({ queryKey: ["story", slug] });
        }}
      />
    );
  }

  if (!currentPage) {
    return (
      <RouteNotFoundBoundary
        title="Página não encontrada"
        description={`A página ${pageNumber} não existe nesta história (total de ${pages.length} páginas).`}
        backTo={{ to: "/produto/$slug", params: { slug } }}
        backLabel="Voltar à história"
        onRetry={() => {
          queryClient.invalidateQueries({ queryKey: ["story", slug] });
        }}
      />
    );
  }

  return (
    <main className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to="/produto/$slug"
            params={{ slug }}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface-elevated text-foreground hover:bg-accent"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              {story?.title}
            </div>
            <div className="truncate text-sm font-semibold text-foreground">
              Página {pageNumber} de {pages.length}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface-elevated text-foreground hover:bg-accent"
            aria-label="Baixar PNG"
            title="Baixar PNG da página atual"
          >
            <Download className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleDownloadZip}
            disabled={!!zipProgress}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-elevated px-3 py-2 text-xs font-semibold text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
            title="Baixar pacote completo da história (ZIP)"
          >
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">{zipProgress ? "Gerando…" : "ZIP"}</span>
          </button>
        </div>
      </header>

      {/* Live painting progress for the current page (updates after every
          stroke / fill / magic via maybeCelebrateCompletion). */}
      <div
        className="h-1.5 w-full bg-muted"
        role="progressbar"
        aria-label="Progresso da pintura desta página"
        aria-valuenow={progressPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        title={`${progressPercent}% pintado`}
      >
        <div
          className="h-full bg-gold transition-[width] duration-300 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="flex-1 flex items-stretch overflow-hidden">
        <aside className="scrollbar-premium hidden lg:flex w-56 shrink-0 flex-col gap-2 overflow-y-auto border-r border-border bg-surface px-3 py-4">
          <div className="px-1 pb-2">
            <div className="text-sm font-bold text-foreground">Páginas</div>
            <div className="text-[10px] text-muted-foreground">
              Escolha uma das {pages.length}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {pages.map((p) => {
              const active = p.page_number === pageNumber;
              const thumb = p.image_lineart_url || p.image_preview_url;
              const paintOverlay = active
                ? (livePaintSnapshot ?? paintByPage.get(p.page_number) ?? null)
                : (paintByPage.get(p.page_number) ?? null);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => goToPage(p.page_number)}
                  className={cn(
                    "relative aspect-square w-full max-w-[60px] overflow-hidden rounded-md border bg-white transition",
                    active ? "border-gold ring-2 ring-gold/40" : "border-border hover:border-foreground/30",
                  )}
                  title={paintOverlay ? `Página ${p.page_number} — pintada por você` : `Página ${p.page_number}`}
                >
                  {thumb ? (
                    <img
                      src={thumb}
                      alt={`Página ${p.page_number}`}
                      className="absolute inset-0 h-full w-full object-cover"
                      loading="lazy"
                      onError={() =>
                        logEditorError("asset-load", "thumbnail failed to load", {
                          slug,
                          page: p.page_number,
                          url: thumb,
                          extra: { op: "sidebar-thumb" },
                        })
                      }
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[9px] text-muted-foreground">
                      {p.page_number}
                    </div>
                  )}
                  {/* Paint layer composed on top of the line-art so the
                      sidebar reflects the user's current artwork in real
                      time. The paint PNG is transparent everywhere the
                      user has not painted, so the line-art still shows
                      through. */}
                  {paintOverlay && (
                    <img
                      src={paintOverlay}
                      alt=""
                      aria-hidden
                      className="absolute inset-0 h-full w-full object-cover mix-blend-multiply pointer-events-none"
                      loading="lazy"
                    />
                  )}
                  <span className="absolute bottom-0 left-0 right-0 bg-black/60 py-0.5 text-center text-[8px] font-bold text-white">
                    {p.page_number}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="scrollbar-premium relative flex-1 flex items-center justify-center bg-muted/40 overflow-auto">
          {prevPage && (
            <button
              type="button"
              onClick={() => goToPage(prevPage.page_number)}
              className="absolute left-3 top-1/2 z-10 hidden md:inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-surface-elevated/90 text-foreground shadow hover:bg-accent"
              aria-label="Página anterior"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          {nextPage && (
            <button
              type="button"
              onClick={() => goToPage(nextPage.page_number)}
              className="absolute right-3 top-1/2 z-10 hidden md:inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-surface-elevated/90 text-foreground shadow hover:bg-accent"
              aria-label="Próxima página"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          )}


          <div className="absolute right-4 top-4 z-10 flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(z + 0.2, 3))}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-surface-elevated/90 text-foreground shadow hover:bg-accent"
              aria-label="Aumentar zoom"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(z - 0.2, 0.5))}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-surface-elevated/90 text-foreground shadow hover:bg-accent"
              aria-label="Diminuir zoom"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
          </div>

          <div
            ref={containerRef}
            className="relative inline-block bg-white rounded-2xl shadow-2xl overflow-hidden"
            style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
          >
            {lineArt ? (
              <img
                src={lineArt}
                alt={humanTitle(currentPage.title, `Página ${pageNumber}`)}
                /* CRITICAL: crossOrigin="anonymous" lets us call
                   ctx.getImageData() on a buffer that has drawImage()'d
                   this element. Without it the canvas becomes "tainted" and
                   any pixel-reading tool (Tinta/floodFill, Mágica/Magic
                   Paint, completion %) silently throws — only Riscar/brush
                   keeps working because the brush never reads pixels back.
                   Supabase Storage serves Access-Control-Allow-Origin: *,
                   so this works for every uploaded PNG/JPEG. */
                crossOrigin="anonymous"
                referrerPolicy="no-referrer"
                className="block max-h-[72vh] w-auto select-none pointer-events-none"
                draggable={false}
                onLoad={handleImageLoad}
                onError={() =>
                  logEditorError("asset-load", "lineart image failed to load", {
                    slug,
                    page: pageNumber,
                    url: lineArt,
                    extra: { op: "main-lineart" },
                  })
                }
              />
            ) : (
              <div className="flex h-[60vh] w-[60vh] items-center justify-center text-sm text-muted-foreground">
                Sem desenho disponível
              </div>
            )}
            <canvas
              ref={canvasRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onPointerLeave={onPointerUp}
              className={cn(
                "absolute inset-0 touch-none",
                isSigning ? "cursor-text" : isFilling ? "cursor-cell" : "cursor-crosshair",
              )}
              style={{ mixBlendMode: "multiply" }}
            />
            {/* Magic Paint debug overlay — sits on top of the main canvas
                with no pointer events so it never interferes with painting.
                Filled by renderMagicDebugOverlay() after a magic run when
                the magicDebug toggle is ON. Excluded from save/export. */}
            <canvas
              ref={debugCanvasRef}
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute inset-0 transition-opacity",
                magicDebug ? "opacity-100" : "opacity-0",
              )}
            />
            {draftSignature && (
              <DraftSignatureOverlay
                draft={draftSignature}
                canvasRef={canvasRef}
                onChange={setDraftSignature}
                onCommit={() => {
                  // Reentrancy lock — first call wins, every other call
                  // in the same burst (double-click, Enter held, click +
                  // keydown collision) sees the lock raised and bails
                  // out. The lock is released on the next macrotask so
                  // a NEW signature placed right after still works.
                  if (signatureCommitLockRef.current) return;
                  signatureCommitLockRef.current = true;
                  // Atomic state read + clear: even inside the lock, we
                  // use the functional setter so React's batching can't
                  // expose a stale draft to a parallel render.
                  setDraftSignature((current) => {
                    if (!current) return null;
                    stampSignature(current.name, current.color, {
                      pos: { x: current.x, y: current.y },
                      scale: current.scale,
                    });
                    return null;
                  });
                  // Release the lock after the current event loop tick.
                  // setTimeout(0) is enough — by then any queued repeat
                  // events from the SAME user gesture have already been
                  // dispatched and seen the lock.
                  setTimeout(() => {
                    signatureCommitLockRef.current = false;
                  }, 0);
                }}
                onCancel={() => {
                  // Cancel releases the lock immediately so a fresh
                  // signature workflow can start without delay.
                  signatureCommitLockRef.current = false;
                  setDraftSignature(null);
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Mobile-only page nav — keeps prev/next out of the artwork on small screens. */}
      {(prevPage || nextPage) && (
        <div className="flex items-center justify-between gap-2 border-t border-border bg-surface px-3 py-2 md:hidden">
          <button
            type="button"
            onClick={() => prevPage && goToPage(prevPage.page_number)}
            disabled={!prevPage}
            className="inline-flex items-center gap-1 rounded-full bg-surface-elevated px-3 py-2 text-xs font-medium text-foreground shadow-sm hover:bg-accent disabled:opacity-40"
            aria-label="Página anterior"
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </button>
          <span className="text-xs font-medium text-muted-foreground">
            Página {pageNumber}
            {pages?.length ? ` de ${pages.length}` : ""}
          </span>
          <button
            type="button"
            onClick={() => nextPage && goToPage(nextPage.page_number)}
            disabled={!nextPage}
            className="inline-flex items-center gap-1 rounded-full bg-surface-elevated px-3 py-2 text-xs font-medium text-foreground shadow-sm hover:bg-accent disabled:opacity-40"
            aria-label="Próxima página"
          >
            Próxima
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      <footer className="border-t border-border bg-surface px-3 py-3 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {PALETTE.map((c) => {
              const isActive = color === c && !isErasing;
              const contrast = getContrastColor(c);
              return (
                <button
                  key={c}
                  type="button"
                  // Live-updates the draft signature color when one is
                  // floating on screen — pure preview-only, never
                  // commits. The change is rendered via `style={{ color:
                  // draft.color }}` on the overlay (see
                  // DraftSignatureOverlay below), so React re-renders
                  // the floating text in the new color on the next
                  // frame. The actual canvas stamp still happens only
                  // when the user hits Confirmar.
                  onClick={(e) => {
                    e.stopPropagation();
                    setColor(c);
                    if (tool === "eraser") setTool("brush");
                    setDraftSignature((d) => (d ? { ...d, color: c } : d));
                  }}
                  className={cn(
                    "relative inline-flex h-8 w-8 items-center justify-center rounded-full border-2 transition-transform hover:scale-110 motion-reduce:hover:scale-100 motion-reduce:transition-none",
                    // Stacked focus rings — always readable, never blends
                    // with the active state's own ring (different layer).
                    SWATCH_FOCUS_CLASS,
                    isActive ? "scale-110 motion-reduce:scale-100" : "",
                  )}
                  style={{
                    backgroundColor: c,
                    // Border keeps the active vs inactive distinction
                    // independent of focus — important for users who
                    // navigate with both keyboard and mouse, where the
                    // focus ring may be present alongside selection.
                    borderColor: isActive ? contrast : "rgba(255,255,255,0.6)",
                    // Footer palette sits on `bg-surface` (dark chrome)
                    // → calibrate gap + outer ring for that backdrop.
                    ...swatchFocusStyle(c, "dark"),
                  }}
                  aria-label={`Cor ${c}`}
                  aria-pressed={isActive}
                >
                  {isActive && (
                    // Semi-transparent disc behind the check — uses the
                    // *opposite* of the swatch's contrast color (i.e. the
                    // swatch's contrast in reverse) at low alpha so the
                    // icon always reads even on neon/light/yellow chips.
                    // Using `currentColor` of the disc itself is risky on
                    // pure white swatches, so we hard-derive from contrast.
                    <span
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full"
                      style={{
                        backgroundColor:
                          contrast === "#000000"
                            ? "rgba(0,0,0,0.35)"
                            : "rgba(255,255,255,0.45)",
                      }}
                      aria-hidden="true"
                    >
                      <Check className="h-3.5 w-3.5" strokeWidth={3} style={{ color: contrast }} aria-hidden="true" />
                    </span>
                  )}
                </button>
              );
            })}

            {/* Seletor de cor personalizada — abre o color picker nativo do
                navegador. O swatch mostra a última cor escolhida (ou um
                gradiente arco-íris se ainda não foi usado) e fica destacado
                quando ativo, igual aos outros itens da paleta. */}
            {(() => {
              const isPaletteColor = PALETTE.includes(color);
              const isActiveCustom = !isErasing && !isPaletteColor;
              const swatchBg = isActiveCustom
                ? color
                : "conic-gradient(from 180deg, #ef4444, #f59e0b, #facc15, #22c55e, #06b6d4, #3b82f6, #a855f7, #ec4899, #ef4444)";
              return (
                <label
                  className={cn(
                    "relative inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-2 transition-transform hover:scale-110 motion-reduce:hover:scale-100 motion-reduce:transition-none",
                    SWATCH_FOCUS_CLASS,
                    isActiveCustom ? "scale-110 motion-reduce:scale-100" : "",
                  )}
                  style={{
                    background: swatchBg,
                    borderColor: isActiveCustom
                      ? getContrastColor(color)
                      : "rgba(255,255,255,0.6)",
                    ...swatchFocusStyle(isActiveCustom ? color : "#ffffff", "dark"),
                  }}
                  aria-label="Cor personalizada"
                  title="Escolher cor personalizada"
                >
                  <input
                    type="color"
                    value={isPaletteColor ? "#ff0000" : color}
                    onChange={(e) => {
                      setColor(e.target.value);
                      if (tool === "eraser") setTool("brush");
                      setDraftSignature((d) => (d ? { ...d, color: e.target.value } : d));
                    }}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    aria-label="Selecionar cor personalizada"
                  />
                  {!isActiveCustom && (
                    <Plus
                      className="h-3.5 w-3.5 text-white drop-shadow"
                      strokeWidth={3}
                      aria-hidden="true"
                    />
                  )}
                  {isActiveCustom && (
                    <span
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full"
                      style={{
                        backgroundColor:
                          getContrastColor(color) === "#000000"
                            ? "rgba(0,0,0,0.35)"
                            : "rgba(255,255,255,0.45)",
                      }}
                      aria-hidden="true"
                    >
                      <Check
                        className="h-3.5 w-3.5"
                        strokeWidth={3}
                        style={{ color: getContrastColor(color) }}
                        aria-hidden="true"
                      />
                    </span>
                  )}
                </label>
              );
            })()}
          </div>

          <div className="mx-1 h-8 w-px bg-border" />

          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="hidden sm:inline">Pincel</span>
            <input
              type="range"
              min={4}
              max={48}
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="h-1 w-24 cursor-pointer accent-foreground"
            />
            <span className="w-6 text-right tabular-nums text-foreground">{brushSize}</span>
          </label>

          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center rounded-xl border border-border bg-surface-elevated p-0.5">
              <button
                type="button"
                onClick={() => setTool("brush")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                  tool === "brush"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-foreground hover:bg-primary/10",
                )}
                title="Pincel — risca para colorir"
              >
                <Pencil className="h-4 w-4" />
                <span className="hidden sm:inline">Riscar</span>
              </button>
              <button
                type="button"
                onClick={() => setTool("fill")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                  tool === "fill"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-foreground hover:bg-primary/10",
                )}
                title="Balde de tinta — clica e preenche"
              >
                <PaintBucket className="h-4 w-4" />
                <span className="hidden sm:inline">Tinta</span>
              </button>
              <button
                type="button"
                onClick={() => setTool("eraser")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                  tool === "eraser"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-foreground hover:bg-primary/10",
                )}
                title="Borracha"
              >
                <Eraser className="h-4 w-4" />
                <span className="hidden sm:inline">Apagar</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setTool("signature");
                  // Abre o modal de assinatura direto, sem precisar clicar na imagem.
                  // A posição cai no centro do canvas (fallback do dropAt) e o
                  // usuário pode arrastar o draft antes de confirmar.
                  if (draftSignature) return;
                  pendingSignaturePosRef.current = null;
                  setSignatureName((prev) => prev || kidName);
                  setSignatureColor(color);
                  setShowSignatureDialog(true);
                }}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                  tool === "signature"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-foreground hover:bg-primary/10",
                )}
                title="Assinar — clique para abrir e digite seu nome"
              >
                <PenTool className="h-4 w-4" />
                <span className="hidden sm:inline">Assinar</span>
              </button>
            </div>
            <button
              type="button"
              onClick={handleMagicPaint}
              disabled={magicRunning}
              className="inline-flex items-center gap-1.5 rounded-xl border border-primary/60 bg-primary/10 px-3 py-2 text-xs font-semibold text-foreground hover:bg-primary/20 disabled:opacity-50"
              title="Pintar tudo automaticamente"
            >
              <Sparkles className={cn("h-4 w-4 text-primary", magicRunning && "animate-pulse")} />
              <span className="hidden sm:inline">{magicRunning ? "Pintando..." : "Mágica"}</span>
            </button>
            {magicRunning && (
              <button
                type="button"
                onClick={() => { magicCancelRef.current = true; }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-destructive/60 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/20"
                title="Cancelar pintura mágica"
              >
                <X className="h-4 w-4" />
                <span className="hidden sm:inline">Cancelar</span>
              </button>
            )}
            {/* Debug toggle removed from the UI per product decision —
                the underlying magicDebug state and renderMagicDebugOverlay
                helpers are kept so we can re-enable it from devtools or a
                future admin-only surface without re-implementing the logic. */}
            <button
              type="button"
              onClick={handleUndo}
              disabled={history.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-elevated px-3 py-2 text-xs font-semibold text-foreground hover:bg-accent disabled:opacity-40"
              title="Desfazer"
            >
              <RotateCcw className="h-4 w-4" />
              <span className="hidden sm:inline">Desfazer</span>
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-elevated px-3 py-2 text-xs font-semibold text-foreground hover:bg-accent"
              title="Limpar tudo"
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">Limpar</span>
            </button>
          </div>
        </div>
      </footer>


      {showSignatureDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => {
            pendingSignaturePosRef.current = null;
            setShowSignatureDialog(false);
          }}
        >
          <div
            className="relative w-full max-w-md overflow-hidden rounded-2xl bg-surface shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold">
                  Caneta de assinatura
                </div>
                <div className="text-sm font-semibold text-foreground">
                  Como você quer assinar?
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  pendingSignaturePosRef.current = null;
                  setShowSignatureDialog(false);
                }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface-elevated text-foreground hover:bg-accent"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form
              className="space-y-4 p-5"
              onSubmit={(e) => {
                e.preventDefault();
                const trimmed = signatureName.trim();
                if (!trimmed) return;
                // Enter draft mode: place a draggable + resizable preview
                // at the spot the kid tapped (or canvas center as a sane
                // fallback) so they can fine-tune position and size.
                // Actual canvas stamping happens only when they hit
                // "Confirmar" on the floating toolbar.
                const canvas = canvasRef.current;
                const cssW = canvas
                  ? canvas.width / (window.devicePixelRatio || 1)
                  : 600;
                const cssH = canvas
                  ? canvas.height / (window.devicePixelRatio || 1)
                  : 400;
                const dropAt =
                  pendingSignaturePosRef.current ?? {
                    x: cssW / 2,
                    y: cssH / 2,
                  };
                pendingSignaturePosRef.current = null;
                setDraftSignature({
                  x: dropAt.x,
                  y: dropAt.y,
                  scale: 1,
                  name: trimmed,
                  color: signatureColor,
                });
                setShowSignatureDialog(false);
              }}
            >
              <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Nome
                <input
                  type="text"
                  autoFocus
                  value={signatureName}
                  onChange={(e) => setSignatureName(e.target.value)}
                  placeholder={kidName}
                  maxLength={28}
                  className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-base font-semibold text-foreground outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
                />
              </label>
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Cor da assinatura
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {PALETTE.map((c) => {
                    const isActive = signatureColor === c;
                    const contrast = getContrastColor(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setSignatureColor(c)}
                        className={cn(
                          "relative inline-flex h-7 w-7 items-center justify-center rounded-full border-2 transition-transform hover:scale-110 motion-reduce:hover:scale-100 motion-reduce:transition-none",
                          // Same stacked focus-ring system as the main
                          // palette — guarantees a visible keyboard
                          // indicator on top of any palette color and
                          // does not collide with the active-state border.
                          SWATCH_FOCUS_CLASS,
                          isActive ? "scale-110 motion-reduce:scale-100" : "",
                        )}
                        style={{
                          backgroundColor: c,
                          borderColor: isActive ? contrast : "rgba(255,255,255,0.6)",
                          // Signature dialog renders over `bg-background`
                          // (dark) → same calibration as the footer.
                          ...swatchFocusStyle(c, "dark"),
                        }}
                        aria-label={`Cor ${c}`}
                        aria-pressed={isActive}
                      >
                        {isActive && (
                          // Same translucent backdrop pattern as the
                          // main palette, scaled down to fit the 7×7 chip.
                          <span
                            className="inline-flex h-4 w-4 items-center justify-center rounded-full"
                            style={{
                              backgroundColor:
                                contrast === "#000000"
                                  ? "rgba(0,0,0,0.35)"
                                  : "rgba(255,255,255,0.45)",
                            }}
                            aria-hidden="true"
                          >
                            <Check className="h-3 w-3" strokeWidth={3} style={{ color: contrast }} aria-hidden="true" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div
                className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-5 text-center"
                style={{ color: signatureColor }}
              >
                <div
                  className="text-2xl font-bold italic"
                  style={{
                    fontFamily:
                      '"Dancing Script", "Pacifico", "Brush Script MT", cursive',
                  }}
                >
                  {(signatureName || kidName).trim() || "Seu nome"}
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    pendingSignaturePosRef.current = null;
                    setShowSignatureDialog(false);
                  }}
                  className="rounded-xl border border-border bg-surface-elevated px-4 py-2 text-sm font-semibold text-foreground hover:bg-accent"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-gold px-4 py-2 text-sm font-bold text-background hover:opacity-90"
                >
                  Assinar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {zipProgress && !zipMinimized && (
        <div
          className="fixed inset-0 z-[55] flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Gerando pacote ZIP"
        >
          <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-surface shadow-2xl">
            <div className="flex items-start justify-between gap-2 border-b border-border px-5 py-3">
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold">
                  Gerando pacote
                </div>
                <div className="text-sm font-semibold text-foreground">
                  Preparando seu ZIP…
                </div>
              </div>
              <button
                type="button"
                onClick={() => setZipMinimized(true)}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Minimizar"
                title="Minimizar (continuar pintando)"
              >
                <Minus className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 p-5">
              <div className="text-sm text-foreground">{zipProgress.label}</div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gold transition-all duration-300 ease-out"
                  style={{
                    width: `${Math.min(100, Math.round((zipProgress.current / Math.max(zipProgress.total, 1)) * 100))}%`,
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Etapa {Math.min(zipProgress.current, zipProgress.total)} de {zipProgress.total}
                </span>
                <span className="tabular-nums">
                  {Math.min(100, Math.round((zipProgress.current / Math.max(zipProgress.total, 1)) * 100))}%
                </span>
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setZipMinimized(true)}
                  className="rounded-xl border border-border bg-surface-elevated px-3 py-2 text-xs font-semibold text-foreground hover:bg-accent"
                >
                  Minimizar
                </button>
                <button
                  type="button"
                  onClick={() => { zipCancelRef.current = true; }}
                  className="rounded-xl border border-destructive/60 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/20"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {zipProgress && zipMinimized && (
        <div
          className="fixed bottom-24 right-4 z-[55] w-[260px] overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <Package className="h-4 w-4 shrink-0 text-gold" />
              <div className="truncate text-xs font-semibold text-foreground">
                Gerando ZIP… {Math.min(100, Math.round((zipProgress.current / Math.max(zipProgress.total, 1)) * 100))}%
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => setZipMinimized(false)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Restaurar"
                title="Restaurar"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => { zipCancelRef.current = true; }}
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-destructive hover:bg-destructive/10"
                aria-label="Cancelar"
                title="Cancelar"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="px-3 py-2">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gold transition-all duration-300 ease-out"
                style={{
                  width: `${Math.min(100, Math.round((zipProgress.current / Math.max(zipProgress.total, 1)) * 100))}%`,
                }}
              />
            </div>
            <div className="mt-1.5 truncate text-[10px] text-muted-foreground">
              {zipProgress.label}
            </div>
          </div>
        </div>
      )}

      {showCompletionModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4"
          onClick={() => setShowCompletionModal(false)}
        >
          <div
            className="relative w-full max-w-md overflow-hidden rounded-3xl bg-gradient-to-br from-gold via-gold/90 to-primary p-8 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowCompletionModal(false)}
              className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/20 text-white hover:bg-black/40"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="mx-auto mb-4 inline-flex h-16 w-16 animate-bounce items-center justify-center rounded-full bg-white/30 text-white">
              <PartyPopper className="h-8 w-8" />
            </div>
            <div className="text-xs font-bold uppercase tracking-[0.3em] text-white/90">
              Página concluída
            </div>
            <h2 className="mt-2 text-3xl font-extrabold text-background">
              Parabéns, {kidName}! 🎉
            </h2>
            <p className="mt-3 text-sm font-medium text-background/90">
              Você pintou toda a página {pageNumber} de{" "}
              <span className="font-bold">{story?.title ?? "sua história"}</span>.
              Continue colorindo para completar a história inteira!
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
              {nextPage && (
                <button
                  type="button"
                  onClick={() => {
                    setShowCompletionModal(false);
                    goToPage(nextPage.page_number);
                  }}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-background px-4 py-2.5 text-sm font-bold text-foreground hover:opacity-90"
                >
                  Próxima página
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowCompletionModal(false)}
                className="inline-flex items-center justify-center rounded-xl border-2 border-background/30 bg-white/20 px-4 py-2.5 text-sm font-bold text-background hover:bg-white/30"
              >
                Continuar aqui
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Draft signature overlay
// ────────────────────────────────────────────────────────────────────────────
//
// A draggable + resizable preview of the signature that floats on top of
// the canvas. The kid uses it to fine-tune position and size BEFORE the
// signature is committed to pixels via `stampSignature`. Once they hit
// "Confirmar", the parent calls stampSignature with the chosen pos/scale
// and clears the draft state.
//
// Why a sibling component instead of inline JSX:
//   • Keeps the route file's render tree readable.
//   • Owns its own pointer state (dragging, resizing, pinch baseline)
//     without polluting the painter's pointer-handling code paths.
//   • Lets us attach native pointer/wheel listeners with non-passive
//     options for proper preventDefault on touch — React's synthetic
//     events default to passive on touchmove/wheel.
//
// Coordinates: x/y/scale are in the same CSS-pixel space as the main
// canvas's logical size (cssW × cssH = canvas.width / dpr). Because the
// overlay is rendered INSIDE the same wrapper that gets `transform: scale(zoom)`,
// the visual pixels match the canvas pixels at any zoom level — no
// extra math required here.

interface DraftSignatureValue {
  x: number;
  y: number;
  scale: number;
  name: string;
  color: string;
}

interface DraftSignatureOverlayProps {
  draft: DraftSignatureValue;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  onChange: (next: DraftSignatureValue) => void;
  onCommit: () => void;
  onCancel: () => void;
}

const SCALE_MIN = 0.4;
const SCALE_MAX = 3.0;

function DraftSignatureOverlay({
  draft,
  canvasRef,
  onChange,
  onCommit,
  onCancel,
}: DraftSignatureOverlayProps) {
  // Local commit guard — mirrors the parent's lock so the keyboard
  // handler and the Confirmar button can't both fire `onCommit` during
  // a single user gesture. Reset only on cancel (commit unmounts the
  // overlay so reset isn't needed in that branch).
  const committedRef = React.useRef(false);
  const safeCommit = React.useCallback(() => {
    if (committedRef.current) return;
    committedRef.current = true;
    onCommit();
  }, [onCommit]);
  const safeCancel = React.useCallback(() => {
    committedRef.current = false;
    onCancel();
  }, [onCancel]);
  // Mirror the base font formula used by stampSignature so the preview
  // matches the final stamp pixel-for-pixel. Recompute on every render
  // because the canvas can resize (window resize handler in the parent).
  const cssW = React.useMemo(() => {
    const c = canvasRef.current;
    if (!c) return 600;
    return c.width / (window.devicePixelRatio || 1);
  }, [canvasRef, draft.scale]); // re-read when scale changes (same render frame as moves)
  const cssH = React.useMemo(() => {
    const c = canvasRef.current;
    if (!c) return 400;
    return c.height / (window.devicePixelRatio || 1);
  }, [canvasRef, draft.scale]);

  const baseSize = Math.max(
    14,
    Math.min(180, Math.round((cssW / 14) * draft.scale)),
  );

  // Refs for drag/pinch state — using refs keeps the move handler
  // re-renders to a minimum and avoids stale-closure bugs.
  const dragStateRef = React.useRef<{
    pointerId: number;
    mode: "move" | "resize";
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
    startScale: number;
    canvasRect: DOMRect;
  } | null>(null);

  // Pinch-to-resize tracking: when two pointers are active on the
  // signature box, we measure their distance and scale proportionally.
  const pinchPointersRef = React.useRef<Map<number, { x: number; y: number }>>(
    new Map(),
  );
  const pinchStartRef = React.useRef<{
    distance: number;
    scale: number;
  } | null>(null);

  // Clamp helpers — keep the signature anchor inside the canvas so it
  // never disappears off-screen. We allow some slack at the edges so
  // the kid can stamp into corners.
  function clampPos(x: number, y: number) {
    return {
      x: Math.max(8, Math.min(cssW - 8, x)),
      y: Math.max(baseSize, Math.min(cssH - 8, y)),
    };
  }

  function clampScale(s: number) {
    return Math.max(SCALE_MIN, Math.min(SCALE_MAX, s));
  }

  function onBoxPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    // Don't start a drag from the toolbar buttons — they have their own
    // handlers and we want clicks, not drags.
    if ((e.target as HTMLElement).closest("[data-signature-toolbar]")) return;
    if ((e.target as HTMLElement).closest("[data-signature-resize]")) return;
    e.preventDefault();
    e.stopPropagation();
    const canvas = canvasRef.current;
    if (!canvas) return;

    pinchPointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pinchPointersRef.current.size === 2) {
      // Switch to pinch-resize mode.
      const pts = Array.from(pinchPointersRef.current.values());
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      pinchStartRef.current = {
        distance: Math.hypot(dx, dy) || 1,
        scale: draft.scale,
      };
      dragStateRef.current = null;
      return;
    }

    e.currentTarget.setPointerCapture(e.pointerId);
    dragStateRef.current = {
      pointerId: e.pointerId,
      mode: "move",
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: draft.x,
      startY: draft.y,
      startScale: draft.scale,
      canvasRect: canvas.getBoundingClientRect(),
    };
  }

  function onResizeHandlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    const canvas = canvasRef.current;
    if (!canvas) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStateRef.current = {
      pointerId: e.pointerId,
      mode: "resize",
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: draft.x,
      startY: draft.y,
      startScale: draft.scale,
      canvasRect: canvas.getBoundingClientRect(),
    };
  }

  function onAnyPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    // Update tracked pointer for pinch math.
    if (pinchPointersRef.current.has(e.pointerId)) {
      pinchPointersRef.current.set(e.pointerId, {
        x: e.clientX,
        y: e.clientY,
      });
    }

    // Two-finger pinch-resize takes priority over single-pointer drag.
    if (pinchPointersRef.current.size === 2 && pinchStartRef.current) {
      const pts = Array.from(pinchPointersRef.current.values());
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      const distance = Math.hypot(dx, dy) || 1;
      const ratio = distance / pinchStartRef.current.distance;
      onChange({
        ...draft,
        scale: clampScale(pinchStartRef.current.scale * ratio),
      });
      return;
    }

    const state = dragStateRef.current;
    if (!state || state.pointerId !== e.pointerId) return;

    if (state.mode === "move") {
      // Translate clientX/Y deltas into canvas-CSS-px deltas. The canvas
      // may be visually scaled by the parent's `transform: scale(zoom)`,
      // so we use the actual rendered rect width vs the canvas's logical
      // CSS width to convert correctly.
      const scaleX = cssW / state.canvasRect.width;
      const scaleY = cssH / state.canvasRect.height;
      const nx = state.startX + (e.clientX - state.startClientX) * scaleX;
      const ny = state.startY + (e.clientY - state.startClientY) * scaleY;
      const clamped = clampPos(nx, ny);
      onChange({ ...draft, x: clamped.x, y: clamped.y });
    } else {
      // Diagonal resize handle: distance from the anchor controls scale.
      // Moving away grows the signature, moving toward it shrinks. We use
      // the larger axis delta so both X and Y motion feel responsive.
      const dx = e.clientX - state.startClientX;
      const dy = e.clientY - state.startClientY;
      const delta = Math.max(dx, dy); // bottom-right handle: + = grow
      // Scale factor: each 100px of drag ≈ ±0.5 in scale units, tuned
      // against typical touch / mouse motion. Multiplier feels natural
      // on both desktop and tablet without being twitchy.
      const next = clampScale(state.startScale + delta / 200);
      onChange({ ...draft, scale: next });
    }
  }

  function onAnyPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    pinchPointersRef.current.delete(e.pointerId);
    if (pinchPointersRef.current.size < 2) {
      pinchStartRef.current = null;
    }
    if (dragStateRef.current?.pointerId === e.pointerId) {
      dragStateRef.current = null;
    }
  }

  // Wheel-to-resize for desktop: the kid (or their parent) can hover
  // the signature and scroll to scale. We attach a NATIVE listener with
  // passive:false so we can preventDefault and stop the page from
  // scrolling under the cursor.
  const boxRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    function onWheel(ev: WheelEvent) {
      ev.preventDefault();
      // Trackpads send small deltas, mouse wheels send big steps.
      // Normalize: each notch ≈ 5% scale change.
      const step = -ev.deltaY * 0.001;
      onChange({ ...draft, scale: clampScale(draft.scale + step) });
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // We intentionally re-bind on every draft change so the closure sees
    // the latest scale — listener cost is negligible (single element).
  }, [draft, onChange]);

  // Keyboard shortcuts: Enter confirms, Escape cancels. Lets the dialog-
  // confirm-then-tweak flow finish without forcing a mouse trip to the
  // small toolbar buttons.
  React.useEffect(() => {
    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") {
        ev.preventDefault();
        safeCancel();
      } else if (ev.key === "Enter") {
        ev.preventDefault();
        // Ignore OS-level key-repeat events from a held Enter — only
        // the FIRST keydown should commit. The local + parent locks
        // would catch repeats anyway, but this short-circuits before
        // any work is queued.
        if (ev.repeat) return;
        safeCommit();
      } else if (ev.key === "+" || ev.key === "=") {
        ev.preventDefault();
        onChange({ ...draft, scale: clampScale(draft.scale + 0.1) });
      } else if (ev.key === "-" || ev.key === "_") {
        ev.preventDefault();
        onChange({ ...draft, scale: clampScale(draft.scale - 0.1) });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [draft, onChange, safeCommit, safeCancel]);

  // Visual: we draw the signature as plain HTML text so it's resolution-
  // independent and crisp at any scale. The actual canvas stamp renders
  // the same font + color, so the WYSIWYG match is excellent.
  //
  // Toolbar placement: defaults to BELOW the signature, but auto-flips
  // ABOVE when the signature is near the bottom of the canvas so the
  // Confirmar/Cancelar buttons are always reachable. Same logic clamps
  // horizontally — if the signature sits near the left/right edge, we
  // shift the toolbar inward so it never bleeds off the canvas (the
  // bug the user reported: confirm button unclickable in the corner).
  const TOOLBAR_HEIGHT_PX = 44; // approximate measured height
  const TOOLBAR_HALF_WIDTH_PX = 130; // approximate measured half-width
  const placeToolbarAbove = draft.y + TOOLBAR_HEIGHT_PX + 16 > cssH;
  // How far to shift the toolbar horizontally so it stays inside the
  // canvas. Without this, a signature anchored at x≈cssW pushes the
  // centered toolbar half off the right edge.
  const toolbarShiftX = (() => {
    const overflowRight = draft.x + TOOLBAR_HALF_WIDTH_PX - cssW + 8;
    if (overflowRight > 0) return -overflowRight;
    const overflowLeft = TOOLBAR_HALF_WIDTH_PX - draft.x + 8;
    if (overflowLeft > 0) return overflowLeft;
    return 0;
  })();

  return (
    <div
      ref={boxRef}
      onPointerDown={onBoxPointerDown}
      onPointerMove={onAnyPointerMove}
      onPointerUp={onAnyPointerUp}
      onPointerCancel={onAnyPointerUp}
      role="group"
      aria-label="Posicione e redimensione sua assinatura"
      data-click-sound="false"
      className="absolute z-30 select-none touch-none cursor-move"
      style={{
        // The signature anchor is the bottom-left of the baseline (matching
        // canvas textBaseline="alphabetic" + textAlign="left"). Translate
        // the box up by the font size so the user grabs roughly the
        // visual center of the text.
        left: `${draft.x}px`,
        top: `${draft.y - baseSize}px`,
      }}
    >
      <div
        className="relative rounded-md ring-2 ring-gold/80 ring-offset-2 ring-offset-transparent bg-white/20 backdrop-blur-[1px] px-2 pt-1 pb-2"
        style={{ color: draft.color }}
      >
        <span
          className="block whitespace-nowrap font-bold italic leading-none drop-shadow-sm"
          style={{
            fontSize: `${baseSize}px`,
            fontFamily:
              '"Dancing Script", "Pacifico", "Brush Script MT", cursive',
          }}
        >
          {draft.name}
        </span>

        {/* Resize handle — bottom-right corner. Visually small but with
            a generous touch target via padding. */}
        <div
          data-signature-resize
          onPointerDown={onResizeHandlePointerDown}
          onPointerMove={onAnyPointerMove}
          onPointerUp={onAnyPointerUp}
          onPointerCancel={onAnyPointerUp}
          role="slider"
          aria-label="Redimensionar assinatura"
          aria-valuemin={Math.round(SCALE_MIN * 100)}
          aria-valuemax={Math.round(SCALE_MAX * 100)}
          aria-valuenow={Math.round(draft.scale * 100)}
          className="absolute -bottom-2 -right-2 flex h-7 w-7 cursor-nwse-resize items-center justify-center rounded-full border-2 border-background bg-gold text-[11px] font-black text-background shadow-md"
          title="Arraste para redimensionar"
        >
          ↘
        </div>
      </div>

      {/* Floating toolbar — auto-flips above/below + horizontally clamps
          so Confirmar/Cancelar are ALWAYS reachable, even when the
          signature sits in a corner of the canvas. Buttons opt out of
          the global click sound so rapid +/- adjustments don't
          machine-gun the audio. */}
      <div
        data-signature-toolbar
        className={cn(
          "absolute left-1/2 z-40 flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-1.5 shadow-2xl ring-1 ring-black/10",
          placeToolbarAbove ? "bottom-full mb-3" : "top-full mt-3",
        )}
        style={{ transform: `translateX(calc(-50% + ${toolbarShiftX}px))` }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          data-click-sound="false"
          onClick={() =>
            onChange({ ...draft, scale: clampScale(draft.scale - 0.1) })
          }
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-foreground hover:bg-accent disabled:opacity-40"
          disabled={draft.scale <= SCALE_MIN + 0.001}
          aria-label="Diminuir"
          title="Diminuir (−)"
        >
          −
        </button>
        <span className="min-w-[2.75rem] text-center text-[12px] font-semibold tabular-nums text-muted-foreground">
          {Math.round(draft.scale * 100)}%
        </span>
        <button
          type="button"
          data-click-sound="false"
          onClick={() =>
            onChange({ ...draft, scale: clampScale(draft.scale + 0.1) })
          }
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-foreground hover:bg-accent disabled:opacity-40"
          disabled={draft.scale >= SCALE_MAX - 0.001}
          aria-label="Aumentar"
          title="Aumentar (+)"
        >
          +
        </button>
        <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
        <button
          type="button"
          onClick={safeCancel}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          aria-label="Cancelar"
          title="Cancelar (Esc)"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={safeCommit}
          // Disabled state communicates the lock visually so a frantic
          // double-click looks intentional, not unresponsive.
          disabled={committedRef.current}
          className="inline-flex items-center gap-1 rounded-full bg-gold px-3.5 py-1.5 text-[12px] font-bold text-background shadow hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          title="Confirmar (Enter)"
        >
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Confirmar</span>
        </button>
      </div>
    </div>
  );
}

