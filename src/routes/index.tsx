import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/integrations/supabase/auth-context";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Área de membros" },
      {
        name: "description",
        content: "Acesse sua área de membros.",
      },
    ],
  }),
  component: RootRedirect,
});

function RootRedirect() {
  const { session, adminProfile, loading } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (loading) return;

    // Preserva query params (ex: ?variation=ID&as=user&preview=user)
    // para que o contexto de variação e o modo "Ver como aluno" funcionem
    // corretamente após o redirect.
    const search =
      typeof window !== "undefined" ? window.location.search : "";
    const params = new URLSearchParams(search);

    // Qualquer modo de preview (Ver como admin / Ver como aluno) deve cair
    // direto na home da área de membros (/home), mantendo os params, mesmo
    // que o usuário logado seja admin.
    const isPreviewMode =
      params.has("as") ||
      params.has("preview") ||
      params.has("variation");
    const qs = search ? search : "";

    if (!session) {
      window.location.replace(`/login${qs}`);
      return;
    }

    if (adminProfile?.is_active && !isPreviewMode) {
      navigate({ to: "/admin/dashboard", replace: true });
    } else {
      // Aluno (ou admin em preview): vai para a home da área, NÃO para /perfil.
      // /perfil agora é apenas a tela de conta acessível pelo menu do usuário.
      window.location.replace(`/home${qs}`);
    }
  }, [session, adminProfile, loading, navigate]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-sm text-muted-foreground">Redirecionando…</div>
    </main>
  );
}
