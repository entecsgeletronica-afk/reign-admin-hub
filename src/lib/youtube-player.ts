// Helpers para o player YouTube white-label.
// - Extrai o VIDEO_ID a partir de várias formas de URL.
// - Monta a URL final do embed com parâmetros otimizados.
// - Define o tipo das configurações persistidas em course_lessons.youtube_settings.

export interface YouTubePlayerSettings {
  whiteLabelMode: boolean;
  showControls: boolean;
  hideRelated: boolean;
  hideAnnotations: boolean;
  disableKeyboard: boolean;
  customPlayButton: boolean;
  hideInitialBottomBar: boolean;
}

export const DEFAULT_YOUTUBE_SETTINGS: YouTubePlayerSettings = {
  whiteLabelMode: true,
  showControls: true,
  hideRelated: true,
  hideAnnotations: true,
  disableKeyboard: true,
  customPlayButton: true,
  hideInitialBottomBar: true,
};

/** Faz merge seguro entre o default e o JSON salvo no banco. */
export function normalizeYouTubeSettings(
  raw: unknown,
): YouTubePlayerSettings {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_YOUTUBE_SETTINGS };
  const obj = raw as Record<string, unknown>;
  const pickBool = (
    key: keyof YouTubePlayerSettings,
    fallback: boolean,
  ): boolean => {
    const v = obj[key];
    if (typeof v === "boolean") return v;
    return fallback;
  };
  return {
    whiteLabelMode: pickBool("whiteLabelMode", DEFAULT_YOUTUBE_SETTINGS.whiteLabelMode),
    showControls: pickBool("showControls", DEFAULT_YOUTUBE_SETTINGS.showControls),
    hideRelated: pickBool("hideRelated", DEFAULT_YOUTUBE_SETTINGS.hideRelated),
    hideAnnotations: pickBool("hideAnnotations", DEFAULT_YOUTUBE_SETTINGS.hideAnnotations),
    disableKeyboard: pickBool("disableKeyboard", DEFAULT_YOUTUBE_SETTINGS.disableKeyboard),
    customPlayButton: pickBool("customPlayButton", DEFAULT_YOUTUBE_SETTINGS.customPlayButton),
    hideInitialBottomBar: pickBool("hideInitialBottomBar", DEFAULT_YOUTUBE_SETTINGS.hideInitialBottomBar),
  };
}

/**
 * Extrai o VIDEO_ID de qualquer URL comum do YouTube.
 * Suporta:
 *  - https://youtu.be/ID
 *  - https://www.youtube.com/watch?v=ID
 *  - https://youtube.com/watch?v=ID
 *  - https://www.youtube.com/embed/ID
 *  - https://www.youtube.com/shorts/ID
 *  - URLs com playlist (?list=...) ou parâmetros adicionais
 */
export function extractYouTubeId(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;
  const url = rawUrl.trim();
  if (!url) return null;
  // Pega o ID logo após youtu.be/, v=, /embed/ ou /shorts/.
  const m = url.match(
    /(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/)([A-Za-z0-9_-]{6,20})/,
  );
  return m?.[1] ?? null;
}

/**
 * Monta a URL final do iframe do YouTube com os parâmetros recomendados.
 * `autoplay` é controlado externamente (só é ligado depois do clique do usuário).
 */
export function buildYouTubeEmbedUrl(
  videoId: string,
  settings: YouTubePlayerSettings,
  options: { autoplay?: boolean; list?: string | null } = {},
): string {
  const params = new URLSearchParams({
    modestbranding: "1",
    rel: settings.hideRelated ? "0" : "1",
    showinfo: "0",
    iv_load_policy: settings.hideAnnotations ? "3" : "1",
    disablekb: settings.disableKeyboard ? "1" : "0",
    playsinline: "1",
    enablejsapi: "1",
    controls: settings.showControls ? "1" : "0",
  });
  if (options.autoplay) {
    params.set("autoplay", "1");
    params.set("mute", "0");
  }
  if (options.list) params.set("list", options.list);
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

/** Extrai o list (playlist id) de uma URL do YouTube, se houver. */
export function extractYouTubeListId(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;
  const m = rawUrl.match(/[?&]list=([A-Za-z0-9_-]+)/);
  return m?.[1] ?? null;
}
