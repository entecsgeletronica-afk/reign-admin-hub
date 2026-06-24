import { Construction } from "lucide-react";

export function StubPage({ title }: { title: string }) {
  return (
    <div className="space-y-6">
      <header className="overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-gold">
          Em breve
        </div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
          Esta área está em construção. A estrutura da rota está pronta — preencheremos com a
          experiência completa nas próximas fases.
        </p>
      </header>
      <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-border bg-card/50 p-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gold-soft text-gold">
          <Construction className="h-6 w-6" />
        </div>
        <div className="text-sm font-medium text-foreground">Em construção</div>
        <p className="max-w-sm text-xs text-muted-foreground">
          Volte em breve. Esta tela faz parte do roadmap do painel administrativo.
        </p>
      </div>
    </div>
  );
}
