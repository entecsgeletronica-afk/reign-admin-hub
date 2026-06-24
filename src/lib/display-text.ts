/**
 * Utilitários para tratar texto exibido na UI.
 *
 * Regra global: **nunca** mostrar nome de arquivo de imagem ou UUID como
 * título visível para o usuário. Quando um título estiver vazio ou parecer
 * com nome técnico (uuid, hash, com extensão de imagem), usar o fallback.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FILENAME_EXT_RE = /\.(png|jpe?g|webp|gif|svg|pdf|heic|tif|tiff|bmp)$/i;
// Hash longos (>= 24 chars hex/alfanumérico contínuo, sem espaço)
const LONG_HASH_RE = /^[a-z0-9_-]{24,}$/i;

/**
 * Retorna true se o texto parecer um nome de arquivo, UUID ou hash técnico.
 */
export function looksLikeFilename(text: string | null | undefined): boolean {
  if (!text) return true;
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (UUID_RE.test(trimmed)) return true;
  if (FILENAME_EXT_RE.test(trimmed)) return true;
  // Sem espaços + muito longo + sem letras humanas → considera técnico.
  if (!/\s/.test(trimmed) && LONG_HASH_RE.test(trimmed)) return true;
  return false;
}

/**
 * Devolve um título "humano". Se o texto original parecer técnico
 * (UUID/nome de arquivo/hash), usa o fallback.
 */
export function humanTitle(
  text: string | null | undefined,
  fallback: string,
): string {
  if (looksLikeFilename(text)) return fallback;
  return (text as string).trim();
}
