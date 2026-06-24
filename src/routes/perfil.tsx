// Layout route for /perfil with sub-tabs:
//   /perfil           → Perfil (account, child, password, progress)
//   /perfil/compras   → Minhas Compras
//   /perfil/explorar  → Desbloquear Mais Histórias
//
// The shared header lives in this layout so it stays mounted across tab
// switches (no remount, no flash).

import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { User as UserIcon, ShoppingBag, Sparkles } from "lucide-react";
import * as React from "react";
import { AppHeader } from "@/components/app/AppHeader";
import { useAuth } from "@/integrations/supabase/auth-context";
import { useNavigate } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/perfil")({
  component: PerfilLayout,
});

function PerfilLayout() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  React.useEffect(() => {
    if (!session) navigate({ to: "/login" });
  }, [session, navigate]);

  if (!session) return null;

  const tabs: Array<{
    to: "/perfil" | "/perfil/compras" | "/perfil/explorar";
    label: string;
    icon: typeof UserIcon;
    exact?: boolean;
  }> = [
    { to: "/perfil", label: "Perfil", icon: UserIcon, exact: true },
    { to: "/perfil/compras", label: "Minhas compras", icon: ShoppingBag },
    {
      to: "/perfil/explorar",
      label: "Desbloquear mais histórias",
      icon: Sparkles,
    },
  ];

  return (
    <main className="min-h-screen bg-background">
      <AppHeader />

      {/* Sticky tab bar — uses semantic tokens */}
      <div className="sticky top-[64px] z-20 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1400px] gap-1 overflow-x-auto px-4 sm:px-6 lg:px-10">
          {tabs.map((t) => {
            const isActive = t.exact
              ? location.pathname === t.to
              : location.pathname.startsWith(t.to);
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                className={cn(
                  "relative inline-flex items-center gap-2 whitespace-nowrap px-4 py-3 text-sm font-semibold transition",
                  isActive
                    ? "text-gold"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {t.label}
                {isActive && (
                  <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-gold" />
                )}
              </Link>
            );
          })}
        </div>
      </div>

      <Outlet />
    </main>
  );
}
