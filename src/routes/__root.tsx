import {
  Outlet,
  Link,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import appCss from "../styles.css?url";
import { AuthProvider } from "@/integrations/supabase/auth-context";
import { AdminRouteGuard } from "@/integrations/supabase/admin-guard";
import { ThemeProvider } from "@/integrations/theme/theme-context";
import { I18nProvider } from "@/integrations/i18n/i18n-context";
import { Toaster } from "@/components/ui/sonner";
import { GlobalClickFx } from "@/components/app/GlobalClickFx";
import { VariationProvider } from "@/integrations/variations/variation-context";
import { DocumentBrandingSync } from "@/integrations/variations/document-branding";

interface MyRouterContext {
  queryClient: QueryClient;
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A página que você procura não existe ou foi movida.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Voltar para o início
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "APP COLORIR" },
      { name: "description", content: "APP COLORIR — Painel administrativo." },
      { name: "author", content: "APP COLORIR" },
      { property: "og:title", content: "APP COLORIR" },
      { property: "og:description", content: "APP COLORIR — Painel administrativo." },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "APP COLORIR" },
      { name: "twitter:description", content: "APP COLORIR — Painel administrativo." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/6e5aeb99-d405-4506-bf68-8eba5deca811/id-preview-0c3fbca4--035ec24e-9cb5-4078-90e9-e909e36a413c.lovable.app-1777772350577.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/6e5aeb99-d405-4506-bf68-8eba5deca811/id-preview-0c3fbca4--035ec24e-9cb5-4078-90e9-e909e36a413c.lovable.app-1777772350577.png" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      // Cursive font used by the painting "Sign your name" feature.
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Dancing+Script:wght@600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <VariationProvider>
          <DocumentBrandingSync />
          <ThemeProvider>
            <I18nProvider>
              <AdminRouteGuard>
                <Outlet />
              </AdminRouteGuard>
              <Toaster />
              <GlobalClickFx />
            </I18nProvider>
          </ThemeProvider>
        </VariationProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
