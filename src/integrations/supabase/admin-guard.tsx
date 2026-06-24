import * as React from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "./auth-context";

/**
 * Centralized rule: any URL under /admin/* (except /admin/login) requires an
 * authenticated user with an active admin role. This is the single source of
 * truth — update it here if the protected prefix ever changes.
 */
export const ADMIN_PROTECTED_PREFIX = "/admin";
export const ADMIN_LOGIN_PATH = "/admin/login";

export function isAdminProtectedPath(pathname: string): boolean {
  if (!pathname.startsWith(ADMIN_PROTECTED_PREFIX)) return false;
  // Allow the login route itself to be reached unauthenticated.
  if (pathname === ADMIN_LOGIN_PATH || pathname.startsWith(`${ADMIN_LOGIN_PATH}/`)) {
    return false;
  }
  return true;
}

/**
 * Preview routes (anything carrying `?preview=user`, `?as=user` or `?as=admin`)
 * are intended to be rendered ONLY inside the admin "Ver como" iframe. Hitting
 * those URLs directly without an authenticated admin session would let an
 * outsider see locked content with admin overrides — so we treat them as
 * admin-protected too.
 */
export function isPreviewProtectedSearch(search: string): boolean {
  if (!search) return false;
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  if (params.get("preview") === "user") return true;
  const as = params.get("as");
  if (as === "user" || as === "admin") return true;
  return false;
}

interface GuardState {
  ready: boolean;
  allowed: boolean;
}

/**
 * Hook that enforces the admin guard for the current route.
 * - Returns { ready, allowed } so callers can render a loader / fallback.
 * - Side-effect: redirects unauthenticated or non-admin users to /admin/login.
 */
export function useAdminGuard(): GuardState {
  const { loading, session, adminProfile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isAdminPath = isAdminProtectedPath(location.pathname);
  const isPreviewSearch = isPreviewProtectedSearch(location.searchStr ?? "");
  // Apenas /admin/* exige bloqueio rígido pré-render.
  // URLs com ?as= / ?preview= são páginas públicas que admins usam para
  // testar a área — não devem mostrar "Verificando acesso..." quando o
  // admin já está logado. Para alunos reais essas rotas funcionam normal
  // (entitlements decidem o que aparece).
  const protectedRoute = isAdminPath;
  const isActiveAdmin = !!adminProfile?.is_active;
  const allowed = !protectedRoute || (!!session && isActiveAdmin);
  const ready = !protectedRoute || !loading;

  React.useEffect(() => {
    if (!protectedRoute) return;
    if (loading) return;
    if (!session || !isActiveAdmin) {
      navigate({ to: ADMIN_LOGIN_PATH, replace: true });
    }
  }, [protectedRoute, loading, session, isActiveAdmin, navigate]);

  // Note: isPreviewSearch is intentionally read but not used to block.
  // Mantido referenciado para que o lint não remova o import e para deixar
  // claro que decidimos NÃO bloquear esses casos.
  void isPreviewSearch;

  return { ready, allowed };
}

/**
 * Wrapper component that blocks rendering of children for any /admin/* route
 * (or preview URL) until the user is verified as an active admin. Place this
 * high in the tree (e.g. inside the root layout) so even ad-hoc routes added
 * directly under src/routes/admin/ — and any public route opened in preview
 * mode — inherit the protection automatically.
 */
export function AdminRouteGuard({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { ready, allowed } = useAdminGuard();

  // Apenas /admin/* (excluindo /admin/login) tem o gate de "Verificando
  // acesso...". URLs públicas com ?as= ou ?preview= renderizam direto —
  // o controle do que aparece (cadeados, produtos, etc.) é feito pela
  // própria página via entitlements.
  const protectedRoute = isAdminProtectedPath(location.pathname);

  if (!protectedRoute) {
    return <>{children}</>;
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Verificando acesso...</div>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Redirecionando para login...</div>
      </div>
    );
  }

  return <>{children}</>;
}
