import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Layers,
  Loader2,
  Star,
  FileText,
  AlertTriangle,
  ShieldCheck,
  UserRound,
  ArrowLeft,
} from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { VariationFormDialog } from "@/components/admin/VariationFormDialog";
import { useVariations, VARIATIONS_QUERY_KEY } from "@/integrations/variations/variation-context";
import {
  buildFullDomainPreview,
  deleteVariation,
  isProtectedVariation,
  updateVariation,
  type Variation,
} from "@/services/variations";
import { cn } from "@/lib/utils";
import { useViewAsMode, appendViewAsMode } from "@/hooks/use-view-as-mode";

export const Route = createFileRoute("/admin/_shell/areas")({
  component: AreasPage,
});

const STATUS_TONE: Record<Variation["status"], string> = {
  active: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  draft: "bg-muted text-muted-foreground",
  paused: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
};

const STATUS_LABEL: Record<Variation["status"], string> = {
  active: "Ativa",
  draft: "Rascunho",
  paused: "Pausada",
};

const TYPE_LABEL: Record<Variation["primary_type"], string> = {
  mixed: "Misto",
  drawing: "Desenhos",
  course: "Cursos",
  download: "Downloads",
};

function AreasPage() {
  const { variations, isLoading, activeId, setActive } = useVariations();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [, setViewAsMode] = useViewAsMode();

  const goToArea = (areaId: string, tab: "geral" | "branding" | "cores" | "idioma" | "login" | "produtos" = "geral") => {
    navigate({
      to: "/admin/areas/$areaId",
      params: { areaId },
      search: { tab },
    });
  };

  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Variation | null>(null);
  const [removing, setRemoving] = React.useState<Variation | null>(null);
  const [removeMode, setRemoveMode] = React.useState<"choose" | "delete" | "draft">("choose");
  const [confirmText, setConfirmText] = React.useState("");

  React.useEffect(() => {
    if (!removing) {
      setConfirmText("");
      setRemoveMode("choose");
    }
  }, [removing]);

  const confirmMatches = !!removing && confirmText.trim() === removing.title.trim();

  const totalAreas = variations.length;

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteVariation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: VARIATIONS_QUERY_KEY });
      toast.success("Área removida");
      setRemoving(null);
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Erro ao remover";
      toast.error(message);
    },
  });

  const draftMutation = useMutation({
    mutationFn: (id: string) => updateVariation(id, { status: "draft" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: VARIATIONS_QUERY_KEY });
      toast.success("Área movida para rascunho");
      setRemoving(null);
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Erro ao mover para rascunho";
      toast.error(message);
    },
  });

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (v: Variation) => {
    setEditing(v);
    setFormOpen(true);
  };

  if (/^\/admin\/areas\/[^/]+/.test(location.pathname)) {
    return <Outlet />;
  }

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 h-8 gap-1.5 text-muted-foreground hover:text-foreground"
        onClick={() => {
          if (window.history.length > 1) window.history.back();
          else navigate({ to: "/admin/dashboard" });
        }}
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Button>

      <PageHeader
        eyebrow="Fase 2"
        title="Áreas de membros"
        description="Crie quantas áreas independentes quiser, cada uma com seu próprio catálogo, branding e regras de acesso."
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Nova área
          </Button>
        }
      />

      <div className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Layers className="h-4 w-4 text-gold" />
          <span>
            <strong className="text-foreground">{totalAreas}</strong>{" "}
            {totalAreas === 1 ? "área criada" : "áreas criadas"}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          Sem limite — crie quantas precisar.
        </span>
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Carregando áreas…
        </div>
      ) : variations.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface px-6 py-16 text-center">
          <Layers className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <h3 className="text-base font-semibold">Nenhuma área criada ainda</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Comece criando sua primeira área de membros. Você pode criar quantas precisar, cada uma
            totalmente isolada.
          </p>
          <Button className="mt-4" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Criar primeira área
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {variations.map((v) => {
            const isActive = v.id === activeId;
            return (
              <article
                key={v.id}
                className={cn(
                  "group relative flex flex-col rounded-2xl border bg-surface p-4 shadow-sm transition-all",
                  isActive
                    ? "border-gold/60 ring-1 ring-gold/30"
                    : "border-border hover:border-gold/40",
                )}
              >
                <div className="flex items-start gap-3">
                  <span
                    className="mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white"
                    style={{
                      background: v.accent_color ?? "hsl(var(--gold))",
                    }}
                  >
                    <Layers className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-sm font-semibold text-foreground">{v.title}</h3>
                      {isActive && (
                        <Star
                          className="h-3.5 w-3.5 fill-gold text-gold"
                          aria-label="Variação ativa"
                        />
                      )}
                    </div>
                    <p className="truncate font-mono text-[11px] text-muted-foreground">
                      app.{v.subdomain_key ?? "—"}.
                      <span className="opacity-60">{v.root_domain ?? "[seu-dominio].com"}</span>
                    </p>
                  </div>
                </div>

                {v.description && (
                  <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">{v.description}</p>
                )}

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge
                    variant="secondary"
                    className={cn("border-0 text-[10px]", STATUS_TONE[v.status])}
                  >
                    {STATUS_LABEL[v.status]}
                  </Badge>
                  {v.is_primary && (
                    <Badge
                      variant="secondary"
                      className="border-0 bg-gold/15 text-[10px] text-gold"
                    >
                      ★ Principal
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-[10px]">
                    {TYPE_LABEL[v.primary_type]}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] uppercase">
                    {v.default_locale}
                  </Badge>
                </div>

                <div className="mt-2 truncate text-[10px] text-muted-foreground">
                  URL:{" "}
                  <span className="font-mono">
                    {buildFullDomainPreview(v.subdomain_key, v.root_domain)}
                  </span>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                  {isActive ? (
                    <span className="text-[11px] font-medium text-gold">
                      Variação ativa no painel
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setActive(v.id);
                        toast.success(`Trocado para "${v.title}"`);
                      }}
                      className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
                    >
                      Tornar ativa
                    </button>
                  )}
                  <div className="flex items-center gap-1">
                    {(() => {
                      const protectedArea = isProtectedVariation(v.slug);
                      const isOnlyOne = variations.length === 1;
                      const disabled = protectedArea || isOnlyOne;
                      const title = protectedArea
                        ? "Área protegida — produto principal de desenhos"
                        : isOnlyOne
                          ? "Você precisa de pelo menos uma área"
                          : "Excluir";
                      return (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => !disabled && setRemoving(v)}
                          disabled={disabled}
                          title={title}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      );
                    })()}
                  </div>
                </div>

                {/* CTA principal — abre o editor inline com 7 abas. */}
                <Button
                  asChild
                  size="sm"
                  className="mt-3 w-full gap-2"
                >
                  <Link
                    to="/admin/areas/$areaId"
                    params={{ areaId: v.id }}
                    search={{ tab: "geral" }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Personalizar área
                  </Link>
                </Button>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-[11px] font-semibold"
                    onClick={() => {
                      setActive(v.id);
                      setViewAsMode("admin");
                      const url = appendViewAsMode(
                        `/home?variation=${encodeURIComponent(v.id)}`,
                        "admin",
                      );
                      window.open(url, "_blank", "noopener,noreferrer");
                    }}
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Ver como admin
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 border-gold/40 text-[11px] font-semibold text-gold hover:bg-gold/10 hover:text-gold"
                    onClick={() => {
                      setActive(v.id);
                      setViewAsMode("user");
                      const url = appendViewAsMode(
                        `/home?variation=${encodeURIComponent(v.id)}`,
                        "user",
                      );
                      window.open(url, "_blank", "noopener,noreferrer");
                    }}
                  >
                    <UserRound className="h-3.5 w-3.5" />
                    Ver como aluno
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <VariationFormDialog open={formOpen} onOpenChange={setFormOpen} variation={editing} />

      <Dialog open={!!removing} onOpenChange={(open) => !open && setRemoving(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {removeMode === "delete"
                ? "Excluir esta área de membros?"
                : removeMode === "draft"
                  ? "Mover para rascunho?"
                  : `O que fazer com "${removing?.title}"?`}
            </DialogTitle>
            <DialogDescription>
              {removeMode === "delete" ? (
                <>
                  A área <strong>{removing?.title}</strong> e todos os vínculos serão removidos
                  permanentemente. Esta ação não pode ser desfeita.
                </>
              ) : removeMode === "draft" ? (
                <>
                  A área <strong>{removing?.title}</strong> ficará oculta para os usuários, mas
                  continua salva. Você pode reativá-la a qualquer momento.
                </>
              ) : (
                <>Escolha como deseja remover esta área. Você pode mantê-la salva como rascunho ou excluí-la permanentemente.</>
              )}
            </DialogDescription>
          </DialogHeader>

          {removeMode === "choose" && (
            <div className="grid gap-3 py-2">
              <button
                type="button"
                onClick={() => setRemoveMode("draft")}
                className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 p-4 text-left transition-colors hover:border-gold/50 hover:bg-muted/60"
              >
                <FileText className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold">Mover para rascunho</div>
                  <div className="text-xs text-muted-foreground">
                    Oculta a área dos usuários sem apagar nada. Reversível.
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setRemoveMode("delete")}
                className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-left transition-colors hover:border-destructive/60 hover:bg-destructive/10"
              >
                <Trash2 className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-destructive">Excluir permanentemente</div>
                  <div className="text-xs text-muted-foreground">
                    Apaga a área e seus vínculos. Esta ação não pode ser desfeita.
                  </div>
                </div>
              </button>
            </div>
          )}

          {removeMode === "delete" && (
            <div className="space-y-2 py-2">
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Conteúdos vinculados ficarão sem variação até serem reatribuídos.</span>
              </div>
              <Label htmlFor="confirm-delete-area" className="text-sm">
                Para confirmar, digite{" "}
                <span className="font-semibold text-foreground">{removing?.title}</span> abaixo:
              </Label>
              <Input
                id="confirm-delete-area"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={removing?.title ?? ""}
                autoComplete="off"
                disabled={deleteMutation.isPending}
              />
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            {removeMode === "choose" ? (
              <Button variant="outline" onClick={() => setRemoving(null)}>
                Cancelar
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => setRemoveMode("choose")}
                  disabled={deleteMutation.isPending || draftMutation.isPending}
                >
                  Voltar
                </Button>
                {removeMode === "draft" ? (
                  <Button
                    onClick={() => removing && draftMutation.mutate(removing.id)}
                    disabled={draftMutation.isPending}
                    className="gap-2"
                  >
                    {draftMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Mover para rascunho
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      if (removing && confirmMatches) deleteMutation.mutate(removing.id);
                    }}
                    disabled={deleteMutation.isPending || !confirmMatches}
                    className="gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
                  >
                    {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Excluir
                  </Button>
                )}
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
