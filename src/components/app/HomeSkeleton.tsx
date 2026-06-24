import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton premium neutro exibido enquanto a área de membros carrega.
 *
 * Importante: NÃO exibir textos genéricos ("Histórias para colorir",
 * "BEM-VINDO", "Carregando vitrine…"). Usar apenas blocos neutros que
 * combinem com o tema da plataforma — assim o usuário nunca vê uma
 * identidade incorreta antes dos dados reais carregarem.
 */
export function HomeSkeleton() {
  return (
    <main className="min-h-screen bg-background">
      {/* Header skeleton discreto */}
      <header className="flex w-full items-center justify-between px-4 py-4 sm:px-8 lg:px-16">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-xl" />
          <Skeleton className="h-5 w-36" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-full" />
          <Skeleton className="h-9 w-9 rounded-full" />
          <Skeleton className="h-9 w-9 rounded-full" />
        </div>
      </header>

      {/* Hero skeleton */}
      <section className="relative isolate w-full overflow-hidden border-b border-border">
        <div
          className="absolute inset-0 -z-10 bg-gradient-to-br from-surface-elevated/40 via-background to-background"
          aria-hidden
        />
        <div className="relative w-full px-4 pt-16 pb-12 sm:px-8 sm:pt-20 sm:pb-16 lg:px-16 lg:pt-24 lg:pb-20">
          <div className="max-w-3xl space-y-4">
            <Skeleton className="h-6 w-32 rounded-full" />
            <Skeleton className="h-12 w-3/4 sm:h-14 lg:h-16" />
            <Skeleton className="h-12 w-2/3 sm:h-14 lg:h-16" />
            <Skeleton className="h-5 w-full max-w-xl" />
            <Skeleton className="h-5 w-5/6 max-w-lg" />
            <Skeleton className="mt-4 h-14 w-48 rounded-2xl" />
          </div>
        </div>
      </section>

      {/* Grid skeleton */}
      <div className="w-full space-y-12 px-4 py-10 sm:px-8 lg:px-16">
        <section>
          <Skeleton className="mb-6 h-8 w-56" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square w-full rounded-3xl" />
            ))}
          </div>
        </section>
        <section>
          <Skeleton className="mb-6 h-8 w-48" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square w-full rounded-3xl" />
            ))}
          </div>
        </section>

        <p className="pt-2 text-center text-xs text-muted-foreground">
          Carregando sua área…
        </p>
      </div>
    </main>
  );
}
