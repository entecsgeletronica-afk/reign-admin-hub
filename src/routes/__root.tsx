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
      { title: "Reino das Cores — Atividades bíblicas para colorir" },
      { name: "description", content: "Reino das Cores é a área de membros com histórias bíblicas para crianças colorirem, pintarem e aprenderem brincando — acesse, escolha um desenho e comece a pintar." },
      { name: "author", content: "Reino das Cores" },
      { property: "og:site_name", content: "Reino das Cores" },
      { property: "og:title", content: "Reino das Cores — Atividades bíblicas para colorir" },
      { property: "og:description", content: "Histórias bíblicas para crianças colorirem, pintarem e aprenderem brincando." },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "Reino das Cores — Atividades bíblicas para colorir" },
      { name: "twitter:description", content: "Histórias bíblicas para crianças colorirem, pintarem e aprenderem brincando." },
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
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Reino das Cores",
          url: "https://reign-admin-hub.lovable.app",
          description:
            "Área de membros com histórias bíblicas para crianças colorirem, pintarem e aprenderem brincando.",
          publisher: {
            "@type": "Organization",
            name: "Reino das Cores",
            url: "https://reign-admin-hub.lovable.app",
          },
        }),
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
