import * as React from "react";
import { Link, useLocation, useNavigate, useRouter } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  BarChart3,
  Webhook,
  LogOut,
  Menu,
  X,
  LayoutGrid,
  Layers,
  Copy,
  HelpCircle,
  Video,
  Target,
  Sparkles,
  CreditCard,
  ShieldCheck,
  Mail,
} from "lucide-react";
import { OfferIcon } from "@/components/admin/OfferIcon";
import { ToolPromoModal, type ToolKey } from "@/components/admin/ToolPromoModal";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import logoApp from "@/assets/logo.png";
import { useAuth } from "@/integrations/supabase/auth-context";
import { useProtectedSettings } from "@/hooks/use-protected-settings";
import { logSecurityAttempt } from "@/services/protected-settings";
import { useQueryClient } from "@tanstack/react-query";
import {
  fetchDashboardKpis,
  fetchDashboardSeries,
  fetchSubscriptionStatus,
  fetchTopPlans,
  type PeriodKey,
} from "@/services/dashboard";

// Todos os períodos do filtro do Dashboard. Pré-carregamos todos quando
// a sidebar fica visível, para que clicar em "Hoje", "7 dias", etc. seja
// instantâneo (dados já em cache via React Query).
const ALL_PERIODS: PeriodKey[] = ["today", "7d", "30d", "90d", "month", "custom"];

interface NavItem {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Requires the user to be an active admin. Defaults to true. */
  adminOnly?: boolean;
  /** Soft "WIP" pill on items shipped as stubs in Fase 1. */
  soon?: boolean;
  /** When set, clicking opens a cross-sell promo modal instead of navigating. */
  promoTool?: ToolKey;
  /** When set, clicking opens this URL in a new tab (no modal, no internal nav). */
  externalUrl?: string;
  /**
   * Item institucional protegido. Apenas Super Admin pode editá-lo. Admins
   * comuns podem usá-lo normalmente, mas não conseguem alterar seu link nem
   * removê-lo (a UI de edição só aparece para super_admin).
   */
  protectedItem?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
  /** Toda a seção é protegida (não pode ser ocultada por admin comum). */
  protectedSection?: boolean;
}

/**
 * Sidebar reorganizada conforme PRD Fase 1 — agrupada em 6 blocos lógicos
 * para sair da bagunça de itens soltos. Itens marcados `soon` ainda apontam
 * para stubs até a fase correspondente entregar a tela completa.
 */
const groups: NavGroup[] = [
  {
    label: "Visão Geral",
    items: [
      { label: "Dashboard", to: "/admin/dashboard", icon: LayoutDashboard },
      { label: "Usuários", to: "/admin/usuarios", icon: Users },
    ],
  },
  {
    label: "Conteúdo",
    items: [
      { label: "Áreas de membros", to: "/admin/areas", icon: Layers },
      { label: "Cadastrar produto", to: "/admin/catalogo", icon: LayoutGrid },
      { label: "Oferta", to: "/admin/ofertas", icon: OfferIcon },
    ],
  },
  {
    label: "Integrações",
    items: [
      { label: "Webhooks", to: "/admin/webhooks", icon: Webhook },
      { label: "Templates", to: "/admin/templates", icon: Mail },
    ],
  },
  {
    label: "Ferramentas",
    protectedSection: true,
    items: [
      {
        label: "Criar Quiz",
        to: "#tool-funnelx",
        icon: HelpCircle,
        externalUrl: "https://funnelx.com.br/",
        protectedItem: true,
      },
      {
        label: "Criar e Clonar Sites",
        to: "#tool-replic",
        icon: Copy,
        externalUrl: "https://replic.com.br",
        protectedItem: true,
      },
      {
        label: "Espionar Ofertas",
        to: "#tool-adsniper",
        icon: Target,
        promoTool: "adsniper",
        protectedItem: true,
      },
      {
        label: "Hospedar Vídeos",
        to: "#tool-hostvsl",
        icon: Video,
        externalUrl: "https://www.hostvsl.com.br",
        protectedItem: true,
      },
      {
        label: "Cadastrar na Perfect Pay",
        to: "#tool-perfectpay",
        icon: CreditCard,
        externalUrl: "https://app.perfectpay.com.br/refer/REFPPU15CH55ZP",
        protectedItem: true,
      },
    ],
  },
];

export function AdminSidebar() {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <>
      {/* Mobile top bar */}
      <div className="flex h-14 items-center justify-between border-b border-border bg-sidebar px-4 lg:hidden">
        <div className="flex items-center gap-2">
          <BrandLogo imgClassName="h-7" />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-gold">
            Admin
          </span>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-foreground hover:bg-accent"
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <div className="absolute left-0 top-0 h-full w-72 overflow-y-auto bg-sidebar p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <SidebarBrand />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md text-foreground hover:bg-accent"
                aria-label="Fechar menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <SidebarNav onItemClick={() => setMobileOpen(false)} />
            <div className="px-3 py-3">
              <SidebarFooter />
            </div>
            <InstitutionalFooter />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-border/80 bg-sidebar shadow-[1px_0_0_0_hsl(var(--border)/0.4)] lg:sticky lg:top-0 lg:flex">
        {/* Topo da sidebar — altura idêntica à topbar (h-14) e divisória
            inferior alinhada exatamente com o divider horizontal do header
            da main, garantindo alinhamento 1:1 entre as duas linhas. */}
        <div className="flex h-14 items-center border-b border-sidebar-border/60 px-6">
          <SidebarBrand />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <SidebarNav />
        </div>
        <div className="px-3 py-3">
          <SidebarFooter />
        </div>
        <InstitutionalFooter />
      </aside>
    </>
  );
}

function SidebarBrand() {
  return (
    <div className="flex items-center gap-2.5">
      <BrandLogo imgClassName="h-7" />
      <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-gold">
        Admin
      </span>
    </div>
  );
}

/**
 * Logo do Reino das Cores com fallback automático.
 */
function BrandLogo({ imgClassName = "h-7" }: { imgClassName?: string }) {
  const [failed, setFailed] = React.useState(false);

  if (failed) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <Sparkles className="h-3.5 w-3.5 text-gold" aria-hidden />
        <span className="text-[11px] font-bold tracking-tight text-foreground">
          Reino das Cores
        </span>
      </span>
    );
  }

  return (
    <img
      src={logoApp}
      alt="Reino das Cores"
      className={cn("w-auto shrink-0 object-contain", imgClassName)}
      onError={() => setFailed(true)}
    />
  );
}

function SidebarNav({ onItemClick }: { onItemClick?: () => void }) {
  const location = useLocation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { adminProfile } = useAuth();
  const isActiveAdmin = !!adminProfile?.is_active;
  const [activeTool, setActiveTool] = React.useState<ToolKey | null>(null);

  // Routes that are real navigation targets (skip promo items).
  const allRoutes = React.useMemo(
    () =>
      groups.flatMap((g) =>
        g.items.filter((i) => !i.promoTool).map((i) => i.to),
      ),
    [],
  );

  // Eager preload of all admin sidebar routes once the sidebar mounts.
  // Uses requestIdleCallback so we don't compete with the initial render,
  // then primes the router cache so navigation between admin pages feels
  // instant. Each route is only preloaded once thanks to the router's
  // internal dedupe.
  React.useEffect(() => {
    if (!isActiveAdmin) return;

    // Priority routes — pré-carregadas IMEDIATAMENTE (sem esperar idle) para
    // que ao clicar no Dashboard / Usuários os dados já estejam em cache.
    // Isso dispara o `loader` da rota, que por sua vez chama prefetchQuery
    // para KPIs, séries, status das assinaturas, top plans e recorrência.
    const priority = ["/admin/dashboard", "/admin/usuarios"];
    for (const to of priority) {
      router.preloadRoute({ to }).catch(() => {});
    }

    const ric: (cb: () => void) => number =
      typeof window !== "undefined" &&
      typeof (window as unknown as { requestIdleCallback?: unknown }).requestIdleCallback ===
        "function"
        ? (cb) =>
            (
              window as unknown as {
                requestIdleCallback: (cb: () => void) => number;
              }
            ).requestIdleCallback(cb)
        : (cb) => window.setTimeout(cb, 200);

    const handle = ric(() => {
      for (const to of allRoutes) {
        if (priority.includes(to)) continue;
        // Fire and forget — router caches the result internally.
        router.preloadRoute({ to }).catch(() => {});
      }

      // Pré-carrega TODOS os períodos do Dashboard (Hoje / 7d / 30d / 90d /
      // Mês / Personalizado) em segundo plano. As queries usam o mesmo
      // `queryKey` consumido por `useDashboardKpis`/`useDashboardSeries`/
      // etc., então qualquer troca no PeriodFilter encontra os dados já em
      // cache e renderiza instantaneamente. `staleTime: Infinity` (cache
      // por sessão) garante que esses prefetches não sejam refeitos.
      for (const p of ALL_PERIODS) {
        queryClient.prefetchQuery({
          queryKey: ["dashboard", "kpis", p],
          queryFn: () => fetchDashboardKpis(p),
          staleTime: Infinity,
        });
        queryClient.prefetchQuery({
          queryKey: ["dashboard", "series", p],
          queryFn: () => fetchDashboardSeries(p),
          staleTime: Infinity,
        });
        queryClient.prefetchQuery({
          queryKey: ["dashboard", "subscription-status", p],
          queryFn: () => fetchSubscriptionStatus(p),
          staleTime: Infinity,
        });
        queryClient.prefetchQuery({
          queryKey: ["dashboard", "top-plans", p, "sales"],
          queryFn: () => fetchTopPlans(p, "sales"),
          staleTime: Infinity,
        });
      }
    });
    return () => {
      if (
        typeof window !== "undefined" &&
        typeof (window as unknown as { cancelIdleCallback?: unknown }).cancelIdleCallback ===
          "function"
      ) {
        (
          window as unknown as {
            cancelIdleCallback: (h: number) => void;
          }
        ).cancelIdleCallback(handle);
      } else {
        window.clearTimeout(handle);
      }
    };
  }, [isActiveAdmin, router, queryClient]);

  return (
    <>
      <nav className="flex flex-col gap-5 py-2">
      {groups.map((group) => {
        const visibleItems = group.items.filter((item) =>
          (item.adminOnly ?? true) ? isActiveAdmin : true,
        );
        if (visibleItems.length === 0) return null;
        return (
          <div key={group.label} className="flex flex-col gap-1">
            <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
              {group.label}
            </div>
            {visibleItems.map((item) => {
              const active =
                location.pathname === item.to || location.pathname.startsWith(item.to + "/");
              const Icon = item.icon;
              const baseClass = cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-gold text-gold-foreground shadow-sm"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground",
              );
              const iconEl = (
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0",
                    active
                      ? "text-gold-foreground"
                      : "text-muted-foreground group-hover:text-foreground",
                  )}
                />
              );
              const labelEl = <span className="truncate">{item.label}</span>;
              const soonBadge = item.soon && !active && (
                <span className="ml-auto rounded-full bg-muted/60 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                  em breve
                </span>
              );

              // Promo tool — opens cross-sell modal instead of navigating.
              if (item.promoTool) {
                const tool = item.promoTool;
                return (
                  <button
                    key={item.to}
                    type="button"
                    onClick={() => {
                      onItemClick?.();
                      setActiveTool(tool);
                    }}
                    className={cn(baseClass, "w-full text-left")}
                  >
                    {iconEl}
                    {labelEl}
                  </button>
                );
              }

              // External URL — opens in new tab (e.g. Perfect Pay referral).
              if (item.externalUrl) {
                return (
                  <a
                    key={item.to}
                    href={item.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={onItemClick}
                    className={baseClass}
                  >
                    {iconEl}
                    {labelEl}
                  </a>
                );
              }

              return (
                <Link
                  key={item.to}
                  to={item.to}
                  preload="intent"
                  onClick={onItemClick}
                  className={baseClass}
                >
                  {iconEl}
                  {labelEl}
                  {soonBadge}
                </Link>
              );
            })}
          </div>
        );
      })}
      {!isActiveAdmin && (
        <div className="px-3 py-2 text-xs text-muted-foreground">
          Nenhum item disponível para o seu nível de acesso.
        </div>
      )}
      </nav>
      <ToolPromoModal
        open={activeTool !== null}
        onOpenChange={(o) => {
          if (!o) setActiveTool(null);
        }}
        toolKey={activeTool ?? "adsniper"}
      />
    </>
  );
}

function SidebarFooter() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = React.useState(false);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
      toast.success("Sessão encerrada");
    } catch (err) {
      console.error("[admin] signOut error:", err);
      toast.error("Não foi possível encerrar a sessão. Redirecionando mesmo assim.");
    } finally {
      navigate({ to: "/admin/login", replace: true });
      setSigningOut(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={signingOut}
      aria-busy={signingOut}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
    >
      <LogOut className="h-4 w-4 text-muted-foreground" />
      <span>{signingOut ? "Saindo..." : "Sair"}</span>
    </button>
  );
}

/**
 * Rodapé institucional do menu lateral.
 *
 * • Texto + link da comunidade são lidos da tabela `protected_settings`
 *   (com fallback para defaults). Apenas Super Admin consegue alterá-los
 *   via banco/RLS — admins comuns nem veem botão de edição.
 * • É exibido somente quando `sidebar_footer_enabled = true` (config
 *   protegida). Esconder requer Super Admin.
 * • Se um admin comum tentar manipular via DOM/console, qualquer write é
 *   bloqueado pela RLS no banco e registrado na auditoria.
 */
function InstitutionalFooter() {
  const { values } = useProtectedSettings();
  const { adminProfile, user } = useAuth();
  const enabledRaw = values.sidebar_footer_enabled;
  const enabled = enabledRaw == null || enabledRaw === "" || enabledRaw === "true";
  if (!enabled) return null;

  const url = values.community_url || "https://www.appcolorir.com.br";
  const label = values.community_label || "www.appcolorir.com.br";
  const copyright = values.sidebar_footer_copyright || "© APP COLORIR";
  const isSuper = !!adminProfile?.is_super_admin;

  // Telemetria leve: se um admin comum tentar abrir o link com Alt/Ctrl
  // (intenção de copiar/manipular), registramos como tentativa.
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.altKey && !isSuper && user) {
      logSecurityAttempt({
        action: "inspect_protected_footer_link",
        resource: "sidebar_footer.community_url",
        status: "allowed",
        reason: "Alt-click leitura permitida; alterações continuam bloqueadas",
      });
    }
  };

  return (
    <div className="border-t border-sidebar-border/60 px-4 py-3 text-[11px] leading-snug text-muted-foreground">
      <div className="text-muted-foreground/80">
        {copyright || "© APP COLORIR"}
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        className="mt-0.5 inline-block break-all text-muted-foreground/90 underline-offset-2 hover:text-foreground hover:underline"
      >
        {label}
      </a>
      {isSuper && (
        <div
          className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-gold/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-gold"
          title="Você é Super Admin: pode editar este rodapé"
        >
          <ShieldCheck className="h-2.5 w-2.5" />
          Super Admin
        </div>
      )}
    </div>
  );
}
