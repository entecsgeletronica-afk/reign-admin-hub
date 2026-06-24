import * as React from "react";
import { Link, useNavigate, useLocation } from "@tanstack/react-router";
import {
  Search,
  Bell,
  Heart,
  ShieldCheck,
  LogIn,
  LogOut,
  Smartphone,
  Sun,
  Moon,
  User as UserIcon,
} from "lucide-react";
import { useAuth } from "@/integrations/supabase/auth-context";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useCatalogProducts } from "@/hooks/use-catalog-db";
import { useUserProfile } from "@/hooks/use-profile";
import { resolveProductCover } from "@/lib/catalog-covers";
import { useI18n } from "@/integrations/i18n/i18n-context";
import { useTheme } from "@/integrations/theme/theme-context";
import { DEFAULT_THEME, THEME_PRESETS } from "@/services/theme";
import { cn } from "@/lib/utils";
import { safeStorage } from "@/lib/safe-storage";
import logo from "@/assets/logo.png";

interface NotificationItem {
  id: string;
  title: string;
  subtitle: string | null;
  cover: string | null;
}

export function AppHeader() {
  const { session, adminProfile, signOut } = useAuth();
  const { t } = useI18n();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const { data: products = [] } = useCatalogProducts();
  const { data: profile } = useUserProfile(session?.user?.id);

  const lightTheme = React.useMemo(
    () => THEME_PRESETS.find((preset) => preset.id === "light")?.theme,
    [],
  );

  const isLightTheme = React.useMemo(() => {
    if (!lightTheme) return false;
    return theme.background.toLowerCase() === lightTheme.background.toLowerCase();
  }, [lightTheme, theme.background]);

  function toggleColorMode() {
    setTheme(isLightTheme ? DEFAULT_THEME : (lightTheme ?? DEFAULT_THEME));
  }

  // Latest products = "novos temas" notifications.
  const notifications: NotificationItem[] = React.useMemo(() => {
    return [...products]
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
      .slice(0, 6)
      .map((p) => ({
        id: p.id,
        title: p.title,
        subtitle: p.subtitle,
        cover: resolveProductCover(p),
      }));
  }, [products]);

  // Track dismissed notifications so the dot disappears. Uses safeStorage
  // so private-mode / quota errors don't break notification handling —
  // the in-memory fallback keeps the dot dismissed for the current tab.
  const [dismissed, setDismissed] = React.useState<Set<string>>(new Set());
  React.useEffect(() => {
    try {
      const raw = safeStorage.getItem("rdc:notif:read");
      if (raw) setDismissed(new Set(JSON.parse(raw) as string[]));
    } catch {
      // Corrupted JSON — start fresh.
    }
  }, []);

  function markAllRead() {
    const ids = new Set(notifications.map((n) => n.id));
    setDismissed(ids);
    try {
      safeStorage.setItem("rdc:notif:read", JSON.stringify([...ids]));
    } catch {
      // Stringify can't realistically throw here; defensive only.
    }
  }

  const unreadCount = notifications.filter((n) => !dismissed.has(n.id)).length;
  const userInitial = (
    profile?.child_name?.[0] ??
    profile?.display_name?.[0] ??
    session?.user?.email?.[0] ??
    adminProfile?.name?.[0] ??
    "U"
  ).toUpperCase();

  async function handleAddToHome() {
    // Best-effort PWA install prompt fallback.
    const w = window as unknown as {
      deferredPrompt?: { prompt: () => Promise<void> };
    };
    if (w.deferredPrompt) {
      await w.deferredPrompt.prompt();
    } else {
      alert(
        "Para adicionar à tela inicial, use o menu do seu navegador (Adicionar à tela inicial / Instalar app).",
      );
    }
  }

  async function handleLogout() {
    await signOut();
    navigate({ to: "/login" });
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
      <div className="flex w-full items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8 xl:px-10">
        <Link to="/home" className="flex min-w-0 items-center gap-2 sm:gap-3">
          <img
            src={logo}
            alt="Reino das Cores"
            className="h-9 w-9 shrink-0 rounded-lg object-cover"
          />
          <div className="truncate whitespace-nowrap text-xs font-bold text-foreground sm:text-sm">
            Reino das Cores
          </div>
        </Link>

        <nav className="flex shrink-0 items-center gap-1 sm:gap-2">
          <Link
            to="/buscar"
            aria-label={t("header.search")}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            <Search className="h-5 w-5" />
          </Link>

          <button
            type="button"
            onClick={toggleColorMode}
            aria-label={isLightTheme ? "Ativar tema escuro" : "Ativar tema claro"}
            title={isLightTheme ? "Ativar tema escuro" : "Ativar tema claro"}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            {isLightTheme ? (
              <Moon className="h-5 w-5" />
            ) : (
              <Sun className="h-5 w-5" />
            )}
          </button>

          {/* Notifications */}
          {session && (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label={t("header.notifications")}
                  className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-accent hover:text-foreground"
                  onClick={() => {
                    // Mark read when opened (after small delay to let user see)
                    setTimeout(markAllRead, 800);
                  }}
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-gold-foreground">
                      {unreadCount}
                    </span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                sideOffset={8}
                className="w-[340px] p-0"
              >
                <div className="border-b border-border p-3">
                  <div className="text-sm font-semibold text-foreground">
                    {t("header.notifications.title")}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t("header.notifications.markAll")}
                  </div>
                </div>
                <div className="scrollbar-premium max-h-[360px] overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-xs text-muted-foreground">
                      {t("header.notifications.empty")}
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <Link
                        key={n.id}
                        to="/buscar"
                        className="flex items-center gap-3 border-b border-border/50 p-3 transition last:border-b-0 hover:bg-accent/40"
                      >
                        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-surface-elevated">
                          {n.cover ? (
                            <img
                              src={n.cover}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-gold">
                            Novo tema adicionado
                          </div>
                          <div className="truncate text-sm font-semibold text-foreground">
                            {n.title}
                          </div>
                          {n.subtitle && (
                            <div className="truncate text-xs text-muted-foreground">
                              {n.subtitle}
                            </div>
                          )}
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>
          )}

          {/* Favorites */}
          {session && (
            <Link
              to="/favoritos"
              aria-label={t("header.favorites")}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-accent hover:text-foreground"
            >
              <Heart className="h-5 w-5" />
            </Link>
          )}

          {/* Avatar / Auth */}
          {session ? (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label="Conta"
                  className="ml-1 inline-flex h-9 w-9 items-center justify-center rounded-full bg-gold text-[13px] font-bold text-gold-foreground ring-2 ring-transparent transition hover:ring-gold/40"
                >
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={profile?.avatar_url ?? undefined} alt="" />
                    <AvatarFallback className="bg-gold text-gold-foreground">
                      {userInitial}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                sideOffset={8}
                className="w-[260px] p-2"
              >
                <Link
                  to="/perfil"
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground transition hover:bg-accent"
                >
                  <UserIcon className="h-4 w-4" />
                  {t("header.profile")}
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground transition hover:bg-accent"
                >
                  <LogOut className="h-4 w-4" />
                  {t("common.signOut")}
                </button>
                <button
                  type="button"
                  onClick={handleAddToHome}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground transition hover:bg-accent"
                >
                  <Smartphone className="h-4 w-4" />
                  Adicionar aplicativo
                </button>
                {adminProfile?.is_active && (
                  <Link
                    to="/admin/dashboard"
                    className="mt-1 flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-accent"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Painel admin
                  </Link>
                )}
              </PopoverContent>
            </Popover>
          ) : (
            <button
              type="button"
              onClick={() => navigate({ to: "/login" })}
              className="ml-1 inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2 text-xs font-semibold text-gold-foreground shadow-sm transition-transform hover:-translate-y-0.5"
            >
              <LogIn className="h-4 w-4" /> Entrar
            </button>
          )}
        </nav>
      </div>

      <AdminBanner />
    </header>
  );
}

function AdminBanner() {
  const { adminProfile } = useAuth();
  const location = useLocation();

  // Show banner only when an admin is browsing the user-facing area
  // (anything outside /admin/*).
  if (!adminProfile?.is_active) return null;
  if (location.pathname.startsWith("/admin")) return null;

  return (
    <div className="border-t border-gold/20 bg-gold/5">
      <div
        className={cn(
          "flex w-full items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8 xl:px-10",
        )}
      >
        <div className="flex items-center gap-2 text-xs font-medium text-gold">
          <ShieldCheck className="h-4 w-4" />
          <span>Modo admin — visualizando área do usuário</span>
        </div>
        <Link
          to="/admin/dashboard"
          className="inline-flex items-center gap-1.5 rounded-lg border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs font-semibold text-gold transition hover:bg-gold/20"
        >
          <span aria-hidden>←</span> Voltar ao painel
        </Link>
      </div>
    </div>
  );
}
