/**
 * Centralized logger for editor (paint page) loading errors.
 *
 * - Single greppable prefix: [editor:<scope>] slug=… page=…
 * - In-memory ring buffer accessible via window.__editorErrors (for devtools)
 */

export type EditorErrorScope =
  | "story-load"
  | "artwork-load"
  | "asset-load"
  | "save"
  | "navigation"
  | "render";

export interface EditorErrorContext {
  slug?: string;
  page?: number | string;
  userId?: string | null;
  url?: string;
  extra?: Record<string, unknown>;
}

export interface EditorErrorEntry {
  timestamp: string;
  scope: EditorErrorScope;
  message: string;
  context: EditorErrorContext;
  stack?: string;
}

const MAX_BUFFER = 50;
const buffer: EditorErrorEntry[] = [];

function pushToBuffer(entry: EditorErrorEntry) {
  buffer.push(entry);
  if (buffer.length > MAX_BUFFER) buffer.shift();
  if (typeof window !== "undefined") {
    (window as unknown as { __editorErrors?: EditorErrorEntry[] }).__editorErrors = buffer;
  }
}

function normalizeError(err: unknown): { message: string; stack?: string } {
  if (err instanceof Error) return { message: err.message, stack: err.stack };
  if (typeof err === "string") return { message: err };
  try {
    return { message: JSON.stringify(err) };
  } catch {
    return { message: String(err) };
  }
}

export function logEditorError(
  scope: EditorErrorScope,
  err: unknown,
  context: EditorErrorContext = {},
): EditorErrorEntry {
  const { message, stack } = normalizeError(err);
  const entry: EditorErrorEntry = {
    timestamp: new Date().toISOString(),
    scope,
    message,
    context,
    stack,
  };
  pushToBuffer(entry);

  const tag = `[editor:${scope}]`;
  const slugTag = context.slug ? ` slug=${context.slug}` : "";
  const pageTag = context.page !== undefined ? ` page=${context.page}` : "";
  // eslint-disable-next-line no-console
  console.error(`${tag}${slugTag}${pageTag} ${message}`, { context, stack });

  return entry;
}

export function getRecentEditorErrors(): EditorErrorEntry[] {
  return buffer.slice();
}
