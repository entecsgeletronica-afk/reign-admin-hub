import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { ExternalLink, RefreshCw, Eye, Search, X, ShieldAlert, UserRound, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useUsers } from "@/hooks/use-users";
import { useUserProfile } from "@/hooks/use-profile";
import type { AdminUser } from "@/services/users";
import { safeStorage } from "@/lib/safe-storage";
import { useVariations } from "@/integrations/variations/variation-context";
import { useViewAsMode } from "@/hooks/use-view-as-mode";

export const Route = createFileRoute("/admin/_shell/ver-como-usuario")({
  validateSearch: (search: Record<string, unknown>) => ({
    area: typeof search.area === "string" ? search.area : undefined,
  }),
  component: VerComoUsuarioPage,
});

const STORAGE_KEY = "admin:view-as-user";

interface StoredTarget {
  id: string;
  name: string;
  email: string;
}

function loadStoredTarget(): StoredTarget | null {
  try {
    const raw = safeStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredTarget;
    if (!parsed?.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

function VerComoUsuarioPage() {
  const { area } = Route.useSearch();
  const { variations, activeId, setActive } = useVariations();
  const [path, setPath] = React.useState("/home");
  const [target, setTarget] = React.useState<StoredTarget | null>(() => loadStoredTarget());
  const [pickerOpen, setPickerOpen] = React.useState(false);
  // Shared, cross-component view-mode state. Persisted in localStorage and
  // broadcast to every other surface (area cards, area editor header, etc.)
  // so the choice of "Ver como admin" vs "Ver como aluno" is global.
  const [viewMode, setViewMode] = useViewAsMode();
  // Manual reload counter — bumped by the "Recarregar" button. Mode/area/path
  // changes already produce a new URL via the `as` query param below, so they
  // auto-refresh the iframe without needing this counter.
  const [reloadNonce, setReloadNonce] = React.useState(0);

  // Sync the active variation when arriving from a specific area card.
  React.useEffect(() => {
    if (area && area !== activeId) {
      setActive(area);
    }
  }, [area, activeId, setActive]);

  const currentVariation = React.useMemo(
    () => variations.find((v) => v.id === (area ?? activeId)) ?? null,
    [variations, area, activeId],
  );

  React.useEffect(() => {
    if (target) safeStorage.setItem(STORAGE_KEY, JSON.stringify(target));
    else safeStorage.removeItem(STORAGE_KEY);
  }, [target]);

  const reload = () => setReloadNonce((n) => n + 1);

  const exitMode = () => {
    setTarget(null);
    setPickerOpen(false);
  };

  const profile = useUserProfile(target?.id);
  const avatarUrl = profile.data?.avatar_url ?? null;
  const displayName = profile.data?.display_name || target?.name || "Usuário";

  // Build the iframe URL with `?variation=<id>&as=<mode>`. The `as` param is
  // the single source of truth for the view mode — when it changes, the URL
  // changes, which changes the iframe's `src`, which forces the iframe to
  // reload. The entitlements layer reads `preview=user` to skip the admin
  // override and show lock badges as a real customer would.
  const variationForPreview = area ?? activeId;
  const previewUrl = React.useMemo(() => {
    const sep = path.includes("?") ? "&" : "?";
    const parts: string[] = [];
    if (variationForPreview) parts.push(`variation=${encodeURIComponent(variationForPreview)}`);
    parts.push(`as=${viewMode}`);
    if (viewMode === "user") parts.push("preview=user");
    return `${path}${sep}${parts.join("&")}`;
  }, [path, variationForPreview, viewMode]);

  // Force iframe remount whenever the URL changes OR the user clicks reload.
  // Deriving the key from previewUrl guarantees that any future change to the
  // URL (mode, area, path, extra params) triggers a fresh load — we no longer
  // depend on remembering to bump a counter from every event handler.
  const iframeKey = `${previewUrl}#${reloadNonce}`;

  return (
    <div className="-mx-4 -my-6 sm:-mx-6 lg:-mx-10 lg:-my-10">
      {/* Toolbar */}
      <div className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur">
        <div className="flex flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gold/10 text-gold">
              <Eye className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-gold">
                {viewMode === "user" ? "Modo aluno" : "Modo admin"}
              </div>
              <div className="text-sm font-semibold text-foreground">
                {viewMode === "user" ? "Ver como aluno" : "Ver como admin"}
                {currentVariation && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    — {currentVariation.title}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* View-mode toggle: alterna entre visão de cliente (com cadeados)
              e visão de admin (acesso total). */}
          <div
            className="inline-flex items-center gap-0.5 rounded-full border border-border bg-background p-0.5"
            role="tablist"
            aria-label="Alternar visão"
          >
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "user"}
              onClick={() => {
                setViewMode("user");
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition",
                viewMode === "user"
                  ? "bg-gold text-gold-foreground shadow"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <UserRound className="h-3.5 w-3.5" />
              Ver como aluno
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "admin"}
              onClick={() => {
                setViewMode("admin");
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition",
                viewMode === "admin"
                  ? "bg-gold text-gold-foreground shadow"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Ver como admin
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-1.5">
              {[
                { to: "/home", label: "Home" },
                { to: "/buscar", label: "Buscar" },
                { to: "/favoritos", label: "Favoritos" },
                { to: "/perfil", label: "Perfil" },
                { to: "/perfil/compras", label: "Compras" },
                { to: "/perfil/explorar", label: "Explorar" },
              ].map((item) => (
                <button
                  key={item.to}
                  onClick={() => {
                    setPath(item.to);
                  }}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                    path === item.to
                      ? "border-gold bg-gold/10 text-gold"
                      : "border-border bg-background text-muted-foreground hover:text-foreground",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="ml-auto flex items-center gap-2 lg:ml-2">
              <Button variant="outline" size="icon" onClick={reload} aria-label="Recarregar">
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                onClick={() => window.open(previewUrl, "_blank", "noopener,noreferrer")}
                className="gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Nova aba
              </Button>
            </div>
          </div>
        </div>

        {/* Address bar + impersonation header */}
        <div className="border-t border-border px-4 py-2 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-1 items-center gap-2 rounded-full border border-border bg-background px-4 py-1.5 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="font-mono">{path}</span>
            </div>

            {target ? (
              <div className="flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs text-amber-700 dark:text-amber-300">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt=""
                    className="h-5 w-5 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20">
                    <UserRound className="h-3 w-3" />
                  </span>
                )}
                <div className="leading-tight">
                  <div className="font-semibold">{displayName}</div>
                  <div className="text-[10px] opacity-80">{target.email}</div>
                </div>
                <button
                  type="button"
                  onClick={exitMode}
                  className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full hover:bg-amber-500/20"
                  aria-label="Sair do modo impersonation"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : null}

            <Button
              size="sm"
              variant={target ? "outline" : "default"}
              className="gap-2"
              onClick={() => setPickerOpen((v) => !v)}
            >
              <Search className="h-3.5 w-3.5" />
              {target ? "Trocar usuário" : "Selecionar usuário"}
            </Button>
          </div>
        </div>

        {pickerOpen && (
          <UserPicker
            onSelect={(u) => {
              setTarget({ id: u.id, name: u.name, email: u.email });
              setPickerOpen(false);
            }}
            onClose={() => setPickerOpen(false)}
          />
        )}
      </div>

      {/* Iframe stage */}
      <div className="relative">
        {target && (
          <>
            {/* Persistent badge */}
            <div className="pointer-events-none absolute left-4 top-4 z-20">
              <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-amber-500 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-amber-950 shadow-lg">
                <ShieldAlert className="h-3.5 w-3.5" />
                Modo impersonation (visual)
              </div>
            </div>

            {/* Outline frame */}
            <div className="pointer-events-none absolute inset-0 z-10 border-4 border-amber-500/60" />
          </>
        )}

        <iframe
          key={iframeKey}
          src={previewUrl}
          title="Visualização do cliente"
          className="block h-[calc(100vh-180px)] w-full border-0 bg-background"
        />
      </div>

      {target && (
        <div className="border-t border-border bg-muted/40 px-4 py-2 text-[11px] text-muted-foreground sm:px-6 lg:px-8">
          <strong className="text-foreground">Aviso:</strong> esta visualização usa{" "}
          <em>sua sessão de admin</em>. Não há troca de JWT — você vê as rotas como o cliente,
          mas dados pessoais do usuário-alvo (favoritos, progresso, compras) não são carregados
          dentro do iframe. Use para validar catálogo, branding e navegação.
        </div>
      )}
    </div>
  );
}

function UserPicker({
  onSelect,
  onClose,
}: {
  onSelect: (user: AdminUser) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading } = useUsers({ search: debounced, status: "all" });

  return (
    <div className="border-t border-border bg-background px-4 py-3 sm:px-6 lg:px-8">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, e-mail ou ID..."
            className="pl-9"
          />
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-3 max-h-72 overflow-y-auto rounded-lg border border-border">
        {isLoading ? (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">Carregando…</div>
        ) : !data || data.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            Nenhum usuário encontrado.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {data.slice(0, 25).map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => onSelect(u)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-accent"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium text-foreground">
                      {u.name || "Sem nome"}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">{u.email}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-[10px] uppercase tracking-wider">
                    {u.plan_name ? (
                      <span className="rounded-full bg-gold/10 px-2 py-0.5 font-semibold text-gold">
                        {u.plan_name}
                      </span>
                    ) : (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                        Sem plano
                      </span>
                    )}
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 font-semibold",
                        u.status === "active" && "bg-emerald-500/10 text-emerald-600",
                        u.status === "pending" && "bg-amber-500/10 text-amber-600",
                        u.status === "canceled" && "bg-red-500/10 text-red-600",
                        u.status === "no_plan" && "bg-muted text-muted-foreground",
                      )}
                    >
                      {u.status}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
