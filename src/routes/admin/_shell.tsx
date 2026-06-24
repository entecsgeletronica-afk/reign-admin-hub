import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { RevenueMilestoneTracker } from "@/components/admin/RevenueMilestoneTracker";

export const Route = createFileRoute("/admin/_shell")({
  component: AdminShell,
});

// Auth + admin role enforcement is centralized in <AdminRouteGuard /> at the
// root layout (see src/integrations/supabase/admin-guard.tsx). Any new route
// under /admin/* — even outside this _shell — is automatically protected.
// VariationProvider is mounted at __root.tsx so admin and public share state.
function AdminShell() {
  return (
    <div className="flex min-h-screen w-full flex-col bg-background lg:flex-row">
      <AdminSidebar />
      <main className="min-w-0 flex-1">
        {/* Topbar — barra superior com divisória horizontal sutil que
            separa visualmente a área do conteúdo. Mantida fina (h-14) e
            com borda de baixa opacidade para um visual premium. À direita
            mostramos o tracker de faturamento acumulado (estilo PerfectPay)
            com troféu e barra de progresso até o próximo marco. */}
        <div className="sticky top-0 z-30 hidden h-14 items-center justify-between gap-4 border-b border-border/60 bg-background/80 px-8 backdrop-blur-md lg:flex">
          <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground/70">
            Painel administrativo
          </div>
          <RevenueMilestoneTracker />
        </div>
        <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

