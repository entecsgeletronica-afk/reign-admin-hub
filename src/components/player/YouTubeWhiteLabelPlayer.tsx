// Player white-label para YouTube.
// - Renderiza o iframe oficial com os parâmetros mais limpos possíveis
// - Coloca um overlay com botão de play customizado (identidade da plataforma)
// - Esconde a barra inferior inicial com gradiente sutil
// - Ao clicar: tenta postMessage(playVideo); se em ~700ms o vídeo não tiver
//   começado, faz fallback recarregando o iframe com autoplay=1
// - Estados: vazio / inválido / carregando / erro

import * as React from "react";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  buildYouTubeEmbedUrl,
  extractYouTubeId,
  extractYouTubeListId,
  type YouTubePlayerSettings,
} from "@/lib/youtube-player";

interface YouTubeWhiteLabelPlayerProps {
  url: string | null;
  settings: YouTubePlayerSettings;
  title?: string;
  /** Quando true, o iframe carrega já com autoplay (ex.: preview do admin não precisa). */
  autoplayOnMount?: boolean;
  className?: string;
}

type PlayerState = "idle" | "playing" | "loading" | "error";

export function YouTubeWhiteLabelPlayer({
  url,
  settings,
  title = "Aula em vídeo",
  autoplayOnMount = false,
  className,
}: YouTubeWhiteLabelPlayerProps) {
  const videoId = React.useMemo(() => extractYouTubeId(url), [url]);
  const listId = React.useMemo(() => extractYouTubeListId(url), [url]);
  const iframeRef = React.useRef<HTMLIFrameElement | null>(null);

  // Quando o usuário aceitou play, mudamos para "playing" e já carregamos
  // o iframe com autoplay=1 — funciona como fallback caso postMessage falhe.
  const [state, setState] = React.useState<PlayerState>(
    autoplayOnMount ? "playing" : "idle",
  );

  const baseUrl = React.useMemo(() => {
    if (!videoId) return null;
    return buildYouTubeEmbedUrl(videoId, settings, {
      autoplay: false,
      list: listId,
    });
  }, [videoId, settings, listId]);

  const playUrl = React.useMemo(() => {
    if (!videoId) return null;
    return buildYouTubeEmbedUrl(videoId, settings, {
      autoplay: true,
      list: listId,
    });
  }, [videoId, settings, listId]);

  // Voltamos ao overlay quando a URL ou as configurações mudam (preview no admin).
  React.useEffect(() => {
    setState(autoplayOnMount ? "playing" : "idle");
  }, [videoId, settings, autoplayOnMount]);

  const handlePlay = () => {
    if (!videoId) return;
    // Estratégia 1 — postMessage no iframe atual.
    try {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: "command", func: "playVideo", args: [] }),
        "*",
      );
    } catch {
      /* noop */
    }
    // Estratégia 2 — recarrega o iframe com autoplay=1 (fallback) trocando o estado.
    // Esconde overlay imediatamente para o usuário sentir resposta.
    setState("playing");
  };

  // ----- Estados de "vazio" e "inválido" -----
  if (!url || !url.trim()) {
    return (
      <PlaceholderShell className={className}>
        <span className="text-sm text-muted-foreground">
          Adicione uma URL do YouTube para visualizar o player.
        </span>
      </PlaceholderShell>
    );
  }
  if (!videoId || !baseUrl || !playUrl) {
    return (
      <PlaceholderShell className={className}>
        <span className="text-sm text-destructive">
          URL do YouTube inválida. Verifique o link informado.
        </span>
      </PlaceholderShell>
    );
  }

  const showOverlay = state === "idle" && settings.customPlayButton;
  const iframeSrc = state === "playing" ? playUrl : baseUrl;

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-2xl bg-[#0B1020] shadow-xl",
        className,
      )}
      style={{ aspectRatio: "16 / 9" }}
    >
      <iframe
        ref={iframeRef}
        key={iframeSrc /* força reload no fallback */}
        src={iframeSrc}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
        className="absolute inset-0 block h-full w-full border-0"
      />

      {/* Gradiente inferior — esconde a barra inicial do YouTube antes do play. */}
      {settings.hideInitialBottomBar && state === "idle" && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[7] h-[52px] sm:h-[72px]"
          style={{
            background:
              "linear-gradient(to top, rgba(5,8,18,0.78), rgba(5,8,18,0))",
          }}
        />
      )}

      {/* Overlay com botão play premium */}
      {showOverlay && (
        <button
          type="button"
          onClick={handlePlay}
          aria-label="Reproduzir vídeo"
          className={cn(
            "group absolute inset-0 z-10 flex items-center justify-center",
            "bg-[rgba(5,8,18,0.18)] transition-colors hover:bg-[rgba(5,8,18,0.28)]",
          )}
        >
          <span
            className={cn(
              "flex h-16 w-16 items-center justify-center rounded-full sm:h-20 sm:w-20",
              "bg-primary text-primary-foreground shadow-2xl ring-1 ring-white/10",
              "transition-transform group-hover:scale-105 group-active:scale-95",
            )}
            style={{
              boxShadow:
                "0 24px 48px -12px color-mix(in oklab, var(--primary) 55%, transparent)",
            }}
          >
            <Play className="h-7 w-7 translate-x-[2px] fill-current sm:h-9 sm:w-9" />
          </span>
        </button>
      )}
    </div>
  );
}

function PlaceholderShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex w-full items-center justify-center overflow-hidden rounded-2xl border border-border/40 bg-[#0B1020]",
        className,
      )}
      style={{ aspectRatio: "16 / 9" }}
    >
      {children}
    </div>
  );
}
