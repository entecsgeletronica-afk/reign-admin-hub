import * as React from "react";
import DOMPurify from "dompurify";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Play, Lock, FileText, ExternalLink, CheckCircle2, PlayCircle } from "lucide-react";
import { useCourseLessons, useCourseModules } from "@/hooks/use-courses";
import type { CourseLessonRow, LessonProvider } from "@/services/courses";
import type { CatalogProductRow } from "@/services/catalog-db";
import { resolveProductCover } from "@/lib/catalog-covers";
import { getContentProductId } from "@/lib/mirror";
import { cn } from "@/lib/utils";
import { YouTubeWhiteLabelPlayer } from "@/components/player/YouTubeWhiteLabelPlayer";
import {
  DEFAULT_YOUTUBE_SETTINGS,
  normalizeYouTubeSettings,
} from "@/lib/youtube-player";

// Sanitizer allowlist for admin-provided lesson embed_code. We only allow
// markup necessary for video embeds (iframes from common providers) and strip
// scripts and event handlers so a compromised admin cannot run arbitrary JS
// in students' sessions.
function sanitizeEmbedCode(raw: string): string {
  return DOMPurify.sanitize(raw, {
    ADD_TAGS: ["iframe"],
    ADD_ATTR: [
      "allow",
      "allowfullscreen",
      "frameborder",
      "scrolling",
      "src",
      "title",
      "referrerpolicy",
      "loading",
      "width",
      "height",
    ],
    FORBID_TAGS: ["script", "style"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus"],
  });
}

interface CourseViewProps {
  product: CatalogProductRow;
  hasAccess: boolean;
}

export function CourseView({ product, hasAccess }: CourseViewProps) {
  // Espelhos carregam módulos/aulas do produto original.
  const contentProductId = getContentProductId(product);
  const { data: modules = [], isLoading: loadingModules } = useCourseModules(contentProductId);
  const { data: lessons = [], isLoading: loadingLessons } = useCourseLessons(contentProductId);
  const [activeLessonId, setActiveLessonId] = React.useState<string | null>(null);

  const publishedLessons = React.useMemo(
    () => lessons.filter((l) => l.status === "published"),
    [lessons],
  );

  const lessonsByModule = React.useMemo(() => {
    const map = new Map<string, CourseLessonRow[]>();
    for (const l of publishedLessons) {
      const arr = map.get(l.module_id) ?? [];
      arr.push(l);
      map.set(l.module_id, arr);
    }
    return map;
  }, [publishedLessons]);

  // Auto-select first lesson when data loads
  React.useEffect(() => {
    if (!activeLessonId && publishedLessons.length > 0) {
      setActiveLessonId(publishedLessons[0].id);
    }
  }, [activeLessonId, publishedLessons]);

  const activeLesson = React.useMemo(
    () => publishedLessons.find((l) => l.id === activeLessonId) ?? null,
    [publishedLessons, activeLessonId],
  );

  const cover = resolveProductCover(product);
  const totalLessons = publishedLessons.length;
  const loading = loadingModules || loadingLessons;

  if (!hasAccess) {
    return (
      <section className="relative isolate flex min-h-[80vh] w-full items-end overflow-hidden">
        <div
          className="absolute inset-0 -z-10 bg-cover bg-center"
          style={{ backgroundImage: cover ? `url(${cover})` : undefined }}
          aria-hidden
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-background via-background/70 to-transparent" aria-hidden />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-64 bg-gradient-to-b from-transparent via-background/60 to-background" aria-hidden />
        <div className="relative w-full px-4 pb-20 pt-24 sm:px-8 lg:px-16">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface-elevated/70 px-3 py-2 text-xs font-semibold text-foreground backdrop-blur hover:bg-accent"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
          <div className="mt-8 max-w-3xl space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-gold">
              <PlayCircle className="h-3 w-3" /> Curso em vídeo
            </div>
            <h1 className="text-5xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-6xl lg:text-7xl">
              {product.title}
            </h1>
            {product.subtitle && (
              <p className="max-w-2xl text-lg text-muted-foreground sm:text-xl">{product.subtitle}</p>
            )}
            {product.external_url ? (
              <a
                href={product.external_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-2xl bg-gold px-7 py-4 text-base font-semibold text-gold-foreground shadow-lg transition-transform hover:-translate-y-0.5"
              >
                <Lock className="h-5 w-5" /> Adquirir acesso
              </a>
            ) : (
              <div className="inline-flex items-center gap-2 rounded-2xl border border-border bg-surface-elevated/80 px-6 py-4 text-base font-semibold text-muted-foreground backdrop-blur">
                <Lock className="h-5 w-5" /> Conteúdo bloqueado
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      {/* Player + sidebar */}
      <section className="w-full px-4 pb-20 pt-10 sm:px-8 lg:px-16">
        {loading ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface px-6 py-16 text-center text-sm text-muted-foreground">
            Carregando aulas...
          </div>
        ) : modules.length === 0 || totalLessons === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface px-6 py-16 text-center text-sm text-muted-foreground">
            Este curso ainda não possui aulas publicadas.
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            {/* Player + descrição */}
            <div className="space-y-5">
              <div className="overflow-hidden rounded-2xl border border-border bg-black shadow-xl">
                {activeLesson ? (
                  <LessonPlayer lesson={activeLesson} />
                ) : (
                  <div className="flex aspect-video items-center justify-center text-sm text-muted-foreground">
                    Selecione uma aula
                  </div>
                )}
              </div>

              {activeLesson && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
                      {activeLesson.title}
                    </h2>
                    {activeLesson.description && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {activeLesson.description}
                      </p>
                    )}
                  </div>

                  {activeLesson.body_text && (
                    <div className="whitespace-pre-wrap rounded-xl border border-border bg-surface p-4 text-sm leading-relaxed text-foreground">
                      {activeLesson.body_text}
                    </div>
                  )}

                  {(activeLesson.pdf_url || activeLesson.complementary_url) && (
                    <div className="flex flex-wrap gap-2">
                      {activeLesson.pdf_url && (
                        <a
                          href={activeLesson.pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface-elevated px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-accent"
                        >
                          <FileText className="h-4 w-4" />
                          {activeLesson.pdf_label ?? "Baixar PDF"}
                        </a>
                      )}
                      {activeLesson.complementary_url && (
                        <a
                          href={activeLesson.complementary_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface-elevated px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-accent"
                        >
                          <ExternalLink className="h-4 w-4" />
                          {activeLesson.complementary_label ?? "Material complementar"}
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Timeline unificada de módulos + aulas */}
            <aside className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start">
              <div className="overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-b from-surface to-surface/40 shadow-lg backdrop-blur">
                <div className="flex items-center justify-between border-b border-border/50 bg-surface-elevated/60 px-5 py-3.5">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold">
                      Conteúdo do curso
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {modules.length} {modules.length === 1 ? "módulo" : "módulos"} · {totalLessons} {totalLessons === 1 ? "aula" : "aulas"}
                    </div>
                  </div>
                </div>
                <div className="custom-scrollbar max-h-[calc(100vh-9rem)] overflow-y-auto px-5 py-4">
                  <ol className="relative space-y-1">
                    <span
                      className="absolute left-[14px] top-2 bottom-2 w-px bg-gradient-to-b from-gold/40 via-border to-border/30"
                      aria-hidden
                    />
                    {modules.map((mod, modIdx) => {
                      const modLessons = lessonsByModule.get(mod.id) ?? [];
                      if (modLessons.length === 0) return null;
                      return (
                        <li key={mod.id} className="relative">
                          <div className="relative flex items-center gap-3 pt-3 first:pt-0">
                            <span className="relative z-10 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gold to-gold/70 text-[11px] font-bold text-gold-foreground shadow-md ring-4 ring-surface">
                              {modIdx + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-gold/80">
                                Módulo {modIdx + 1}
                              </div>
                              <div className="truncate text-sm font-semibold text-foreground">
                                {mod.title}
                              </div>
                            </div>
                          </div>
                          <ul className="ml-[14px] mt-1 pl-5">
                            {modLessons.map((lesson, idx) => {
                              const active = lesson.id === activeLessonId;
                              return (
                                <li key={lesson.id} className="relative">
                                  <button
                                    type="button"
                                    onClick={() => setActiveLessonId(lesson.id)}
                                    className={cn(
                                      "group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all",
                                      active
                                        ? "bg-gradient-to-r from-gold/15 via-gold/5 to-transparent ring-1 ring-gold/30"
                                        : "hover:bg-accent/40",
                                    )}
                                  >
                                    <span
                                      className={cn(
                                        "absolute -left-5 top-1/2 h-px w-5 -translate-y-1/2 transition-colors",
                                        active ? "bg-gold/60" : "bg-border/50",
                                      )}
                                      aria-hidden
                                    />
                                    <span
                                      className={cn(
                                        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-all",
                                        active
                                          ? "bg-gold text-gold-foreground shadow-md shadow-gold/30"
                                          : "bg-muted text-muted-foreground group-hover:bg-muted/80",
                                      )}
                                    >
                                      {active ? (
                                        <Play className="h-3 w-3 fill-current" />
                                      ) : (
                                        idx + 1
                                      )}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                      <div
                                        className={cn(
                                          "truncate text-sm font-medium transition-colors",
                                          active ? "text-foreground" : "text-foreground/85 group-hover:text-foreground",
                                        )}
                                      >
                                        {lesson.title}
                                      </div>
                                      {lesson.description && (
                                        <div className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
                                          {lesson.description}
                                        </div>
                                      )}
                                    </div>
                                    {active && (
                                      <CheckCircle2 className="h-4 w-4 shrink-0 text-gold" />
                                    )}
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              </div>
            </aside>
          </div>
        )}
      </section>
    </>
  );
}

function LessonPlayer({ lesson }: { lesson: CourseLessonRow }) {
  // Embed customizado do admin tem prioridade.
  if (lesson.embed_code && lesson.embed_code.trim()) {
    return (
      <div
        className="aspect-video w-full"
        dangerouslySetInnerHTML={{ __html: sanitizeEmbedCode(lesson.embed_code) }}
      />
    );
  }

  // YouTube → player white-label.
  if (lesson.provider === "youtube" && lesson.video_url) {
    const settings = normalizeYouTubeSettings(
      lesson.youtube_settings ?? DEFAULT_YOUTUBE_SETTINGS,
    );
    return (
      <YouTubeWhiteLabelPlayer
        url={lesson.video_url}
        settings={settings}
        title={lesson.title}
      />
    );
  }

  const embedUrl = buildEmbedUrl(lesson.provider, lesson.video_url);
  if (embedUrl) {
    return (
      <div className="aspect-video w-full">
        <iframe
          src={embedUrl}
          title={lesson.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="h-full w-full"
        />
      </div>
    );
  }

  return (
    <div className="flex aspect-video items-center justify-center text-sm text-muted-foreground">
      Esta aula ainda não tem vídeo configurado.
    </div>
  );
}

function buildEmbedUrl(provider: LessonProvider, url: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  if (provider === "youtube") {
    // Handles: https://youtu.be/ID, https://www.youtube.com/watch?v=ID, https://www.youtube.com/embed/ID
    const idMatch =
      trimmed.match(/(?:youtu\.be\/|v=|\/embed\/|\/shorts\/)([A-Za-z0-9_-]{6,})/);
    const id = idMatch?.[1];
    const listMatch = trimmed.match(/[?&]list=([A-Za-z0-9_-]+)/);
    const list = listMatch?.[1];
    if (id) {
      const params = new URLSearchParams({ rel: "0", modestbranding: "1" });
      if (list) params.set("list", list);
      return `https://www.youtube.com/embed/${id}?${params.toString()}`;
    }
    return trimmed;
  }

  if (provider === "vimeo") {
    const m = trimmed.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    const id = m?.[1];
    if (id) return `https://player.vimeo.com/video/${id}`;
    return trimmed;
  }

  // For panda, hostvsl, vturb, iframe — assume URL is already an embed URL
  return trimmed;
}
