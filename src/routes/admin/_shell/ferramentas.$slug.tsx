import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink, Wrench } from "lucide-react";

export const Route = createFileRoute("/admin/_shell/ferramentas/$slug")({
  component: ToolStubPage,
});

const TOOL_LABELS: Record<string, string> = {
  "criar-replicar-sites": "Criar e Replicar Sites",
  "criar-quiz": "Criar Quiz",
  "hospedar-video": "Hospedar Vídeo",
  "cadastrar-perfect-pay": "Cadastrar na Perfect Pay",
};

function ToolStubPage() {
  const { slug } = Route.useParams();
  const title = TOOL_LABELS[slug] ?? "Ferramenta";

  return (
    <div className="space-y-6">
      <header className="overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-gold">
          Ferramentas
        </div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
          Aguardando a URL externa desta ferramenta. Assim que você enviar o link, ele será
          configurado para abrir em uma nova aba diretamente do menu lateral.
        </p>
      </header>

      <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-border bg-card/50 p-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gold-soft text-gold">
          <Wrench className="h-6 w-6" />
        </div>
        <div className="text-sm font-medium text-foreground">URL não configurada</div>
        <p className="max-w-sm text-xs text-muted-foreground">
          Envie a URL desta ferramenta para que o atalho do menu abra em uma nova aba
          automaticamente.
        </p>
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-3 py-1 text-[11px] font-medium text-muted-foreground">
          <ExternalLink className="h-3 w-3" />
          /admin/ferramentas/{slug}
        </div>
      </div>
    </div>
  );
}
