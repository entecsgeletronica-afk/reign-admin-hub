import * as React from "react";
import { Link, useRouter, type LinkProps } from "@tanstack/react-router";
import { ArrowLeft, AlertTriangle, Compass } from "lucide-react";
import { logEditorError, type EditorErrorScope, type EditorErrorContext } from "@/lib/editor-logger";

/**
 * Type-safe target for the "back" link in RouteNotFoundBoundary.
 *
 * We restrict to a known whitelist of routes (home + product detail) so that
 * the discriminated union below stays narrow and the TanStack Router type
 * checker validates `params` against the actual route definition. To add a
 * new destination, extend `BackToTarget` with another `LinkProps` variant.
 */
type BackToTarget =
  | (LinkProps & { to: "/" })
  | (LinkProps & { to: "/produto/$slug"; params: { slug: string } });

/**
 * Reusable error/not-found UI for app routes.
 * Keep visual + behavior identical between /pintar, /produto, etc.
 */

interface BoundaryShellProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
}

function BoundaryShell({ icon, title, description, children }: BoundaryShellProps) {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-sm w-full text-center space-y-4 rounded-2xl border border-border bg-surface-elevated p-6 shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          {icon}
        </div>
        <h1 className="text-lg font-bold text-foreground">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground break-words">{description}</p>
        )}
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          {children}
        </div>
      </div>
    </main>
  );
}

interface RouteErrorBoundaryProps {
  error: Error;
  reset: () => void;
  title?: string;
  /** When provided, automatically calls logEditorError on mount/error change. */
  logScope?: EditorErrorScope;
  logContext?: EditorErrorContext;
}

export function RouteErrorBoundary({ error, reset, title, logScope, logContext }: RouteErrorBoundaryProps) {
  const router = useRouter();
  const contextKey = logContext ? JSON.stringify(logContext) : "";
  React.useEffect(() => {
    if (logScope) logEditorError(logScope, error, logContext ?? {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error, logScope, contextKey]);
  return (
    <BoundaryShell
      icon={<AlertTriangle className="h-5 w-5" />}
      title={title ?? "Algo deu errado"}
      description={error.message}
    >
      <button
        type="button"
        onClick={() => {
          router.invalidate();
          reset();
        }}
        className="inline-flex items-center gap-2 rounded-xl bg-foreground px-4 py-2 text-xs font-semibold text-background hover:opacity-90"
      >
        Tentar novamente
      </button>
      <Link
        to="/"
        className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2 text-xs font-semibold text-foreground hover:bg-accent"
      >
        <Compass className="h-4 w-4" /> Início
      </Link>
    </BoundaryShell>
  );
}

interface RouteNotFoundBoundaryProps {
  title?: string;
  description?: string;
  /** Optional "back" link target. Defaults to home. Extend BackToTarget to add destinations. */
  backTo?: BackToTarget;
  backLabel?: string;
  /** When provided, shows a "Tentar novamente" button calling this handler. */
  onRetry?: () => void;
  /** When provided, automatically calls logEditorError on mount. */
  logScope?: EditorErrorScope;
  logContext?: EditorErrorContext;
  /** Message used for the log entry. Defaults to "route not found". */
  logMessage?: string;
}

export function RouteNotFoundBoundary({
  title = "Página não encontrada",
  description = "O conteúdo que você procura não existe ou foi removido.",
  backTo,
  backLabel = "Voltar",
  onRetry,
  logScope,
  logContext,
  logMessage = "route not found",
}: RouteNotFoundBoundaryProps) {
  const contextKey = logContext ? JSON.stringify(logContext) : "";
  React.useEffect(() => {
    if (logScope) logEditorError(logScope, logMessage, logContext ?? {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logScope, logMessage, contextKey]);
  return (
    <BoundaryShell
      icon={<Compass className="h-5 w-5" />}
      title={title}
      description={description}
    >
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-xl bg-foreground px-4 py-2 text-xs font-semibold text-background hover:opacity-90"
        >
          Tentar novamente
        </button>
      )}
      {backTo && backTo.to === "/produto/$slug" ? (
        <Link
          to="/produto/$slug"
          params={backTo.params}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2 text-xs font-semibold text-foreground hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" /> {backLabel}
        </Link>
      ) : (
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2 text-xs font-semibold text-foreground hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" /> {backTo ? backLabel : "Início"}
        </Link>
      )}
    </BoundaryShell>
  );
}
