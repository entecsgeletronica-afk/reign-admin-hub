import * as React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  Save,
  Loader2,
  GripVertical,
  PlayCircle,
  FileText,
  Link as LinkIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PageHeader } from "@/components/admin/PageHeader";
import { ConfirmDeleteDialog } from "@/components/admin/ConfirmDeleteDialog";
import { useCourseLessons, useCourseModules } from "@/hooks/use-courses";
import {
  createLesson,
  createModule,
  deleteLesson,
  deleteModule,
  LESSON_PROVIDERS,
  reorderLessons,
  reorderModules,
  updateLesson,
  updateModule,
  type CourseLessonRow,
  type CourseModuleRow,
  type LessonProvider,
} from "@/services/courses";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  DEFAULT_YOUTUBE_SETTINGS,
  normalizeYouTubeSettings,
  type YouTubePlayerSettings,
} from "@/lib/youtube-player";
import { YouTubeWhiteLabelPlayer } from "@/components/player/YouTubeWhiteLabelPlayer";
import { Info, Sparkles } from "lucide-react";

export const Route = createFileRoute("/admin/_shell/produtos/$productId/aulas")(
  {
    component: CourseEditorPage,
    loader: async ({ params }) => {
      const { data, error } = await supabase
        .from("catalog_products")
        .select("id, title, product_type")
        .eq("id", params.productId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error("Produto não encontrado");
      return { product: data };
    },
  },
);

function CourseEditorPage() {
  const { product } = Route.useLoaderData();
  const productId = product.id;
  const qc = useQueryClient();
  const navigate = useNavigate();

  const modulesQ = useCourseModules(productId);
  const lessonsQ = useCourseLessons(productId);
  const modules = modulesQ.data ?? [];
  const lessons = lessonsQ.data ?? [];

  const [selectedLessonId, setSelectedLessonId] = React.useState<string | null>(
    null,
  );
  const selectedLesson = React.useMemo(
    () => lessons.find((l) => l.id === selectedLessonId) ?? null,
    [lessons, selectedLessonId],
  );

  // Auto-select first lesson when nothing is selected
  React.useEffect(() => {
    if (!selectedLessonId && lessons.length > 0) {
      setSelectedLessonId(lessons[0].id);
    }
  }, [lessons, selectedLessonId]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["course", "modules", productId] });
    qc.invalidateQueries({ queryKey: ["course", "lessons", productId] });
  };

  // ---- Module mutations ----
  const [moduleDialog, setModuleDialog] = React.useState<{
    open: boolean;
    editing: CourseModuleRow | null;
  }>({ open: false, editing: null });

  const createModuleMut = useMutation({
    mutationFn: createModule,
    onSuccess: () => {
      invalidate();
      toast.success("Módulo criado");
      setModuleDialog({ open: false, editing: null });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateModuleMut = useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<CourseModuleRow>;
    }) => updateModule(id, patch),
    onSuccess: () => {
      invalidate();
      toast.success("Módulo atualizado");
      setModuleDialog({ open: false, editing: null });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteModuleMut = useMutation({
    mutationFn: deleteModule,
    onSuccess: () => {
      invalidate();
      toast.success("Módulo excluído");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reorderModulesMut = useMutation({
    mutationFn: reorderModules,
    onSuccess: invalidate,
  });

  // ---- Lesson mutations ----
  const createLessonMut = useMutation({
    mutationFn: createLesson,
    onSuccess: (lesson) => {
      invalidate();
      setSelectedLessonId(lesson.id);
      toast.success("Aula criada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteLessonMut = useMutation({
    mutationFn: deleteLesson,
    onSuccess: () => {
      invalidate();
      setSelectedLessonId(null);
      toast.success("Aula excluída");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reorderLessonsMut = useMutation({
    mutationFn: reorderLessons,
    onSuccess: invalidate,
  });

  // ---- Confirm dialogs ----
  const [confirmDelete, setConfirmDelete] = React.useState<
    | { type: "module"; id: string; title: string; lessonCount: number }
    | { type: "lesson"; id: string; title: string }
    | null
  >(null);

  const handleMoveModule = (id: string, direction: -1 | 1) => {
    const ids = modules.map((m) => m.id);
    const idx = ids.indexOf(id);
    const nextIdx = idx + direction;
    if (nextIdx < 0 || nextIdx >= ids.length) return;
    [ids[idx], ids[nextIdx]] = [ids[nextIdx], ids[idx]];
    reorderModulesMut.mutate(ids);
  };

  const handleMoveLesson = (
    moduleId: string,
    lessonId: string,
    direction: -1 | 1,
  ) => {
    const moduleLessons = lessons.filter((l) => l.module_id === moduleId);
    const ids = moduleLessons.map((l) => l.id);
    const idx = ids.indexOf(lessonId);
    const nextIdx = idx + direction;
    if (nextIdx < 0 || nextIdx >= ids.length) return;
    [ids[idx], ids[nextIdx]] = [ids[nextIdx], ids[idx]];
    reorderLessonsMut.mutate(ids);
  };

  if (product.product_type !== "course") {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            navigate({ to: "/admin/catalogo", search: { tab: "produtos" } as never })
          }
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao catálogo
        </Button>
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6 text-sm text-amber-200">
          Este produto não é do tipo "Curso em vídeo". A configuração de aulas
          está disponível apenas para cursos.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="-ml-2 mb-2 text-muted-foreground hover:text-foreground"
        >
          <Link to="/admin/catalogo">
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao catálogo
          </Link>
        </Button>
        <PageHeader
          eyebrow="Editor de curso"
          title={`Aulas — ${product.title}`}
          description="Estruture seu curso por módulos e aulas. Cada aula pode ter vídeo, texto complementar, PDF e um link de apoio."
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        {/* LEFT: modules + lessons tree */}
        <aside className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Módulos
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setModuleDialog({ open: true, editing: null })}
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Novo
            </Button>
          </div>

          {modulesQ.isLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : modules.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/60 bg-surface/40 p-6 text-center text-sm text-muted-foreground">
              Nenhum módulo ainda.
              <br />
              Comece criando o primeiro.
            </div>
          ) : (
            <div className="space-y-3">
              {modules.map((m, mIdx) => {
                const moduleLessons = lessons.filter(
                  (l) => l.module_id === m.id,
                );
                return (
                  <div
                    key={m.id}
                    className="overflow-hidden rounded-xl border border-border/60 bg-surface/40"
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-border/40 bg-surface/60 px-3 py-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">
                            {m.title}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {moduleLessons.length} aula
                            {moduleLessons.length === 1 ? "" : "s"}
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          disabled={mIdx === 0}
                          onClick={() => handleMoveModule(m.id, -1)}
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          disabled={mIdx === modules.length - 1}
                          onClick={() => handleMoveModule(m.id, 1)}
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() =>
                            setModuleDialog({ open: true, editing: m })
                          }
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() =>
                            setConfirmDelete({
                              type: "module",
                              id: m.id,
                              title: m.title,
                              lessonCount: moduleLessons.length,
                            })
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1 p-2">
                      {moduleLessons.map((l, lIdx) => (
                        <div
                          key={l.id}
                          className={cn(
                            "group flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm transition-colors",
                            selectedLessonId === l.id
                              ? "bg-primary/15 text-white [&_button]:text-white [&_svg]:text-white"
                              : "hover:bg-surface/80",
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedLessonId(l.id)}
                            className="flex min-w-0 flex-1 items-center gap-2 text-left"
                          >
                            <PlayCircle
                              className={cn(
                                "h-3.5 w-3.5 shrink-0",
                                l.status === "published"
                                  ? "text-emerald-400"
                                  : "text-muted-foreground/60",
                              )}
                            />
                            <span className="truncate">
                              {l.title || "Sem título"}
                            </span>
                          </button>
                          <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              disabled={lIdx === 0}
                              onClick={() =>
                                handleMoveLesson(m.id, l.id, -1)
                              }
                            >
                              <ArrowUp className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              disabled={lIdx === moduleLessons.length - 1}
                              onClick={() =>
                                handleMoveLesson(m.id, l.id, 1)
                              }
                            >
                              <ArrowDown className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                              onClick={() =>
                                setConfirmDelete({
                                  type: "lesson",
                                  id: l.id,
                                  title: l.title,
                                })
                              }
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-full justify-start text-xs text-muted-foreground hover:text-foreground"
                        onClick={() =>
                          createLessonMut.mutate({
                            module_id: m.id,
                            title: "Nova aula",
                            order_index: moduleLessons.length,
                          })
                        }
                      >
                        <Plus className="mr-1 h-3 w-3" /> Adicionar aula
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </aside>

        {/* RIGHT: lesson editor */}
        <div className="min-w-0">
          {selectedLesson ? (
            <LessonEditor
              key={selectedLesson.id}
              lesson={selectedLesson}
              onSaved={invalidate}
            />
          ) : (
            <div className="flex h-[60vh] items-center justify-center rounded-2xl border border-dashed border-border/60 bg-surface/30 text-center text-sm text-muted-foreground">
              {modules.length === 0
                ? "Crie um módulo para começar a estruturar o curso."
                : "Selecione uma aula para editar."}
            </div>
          )}
        </div>
      </div>

      {/* Module create/edit dialog */}
      <Dialog
        open={moduleDialog.open}
        onOpenChange={(open) =>
          setModuleDialog((prev) => ({ ...prev, open }))
        }
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {moduleDialog.editing ? "Editar módulo" : "Novo módulo"}
            </DialogTitle>
          </DialogHeader>
          <ModuleForm
            initial={moduleDialog.editing}
            onSubmit={(values) => {
              if (moduleDialog.editing) {
                updateModuleMut.mutate({
                  id: moduleDialog.editing.id,
                  patch: values,
                });
              } else {
                createModuleMut.mutate({
                  product_id: productId,
                  title: values.title,
                  description: values.description,
                  order_index: modules.length,
                });
              }
            }}
            saving={createModuleMut.isPending || updateModuleMut.isPending}
            onCancel={() =>
              setModuleDialog({ open: false, editing: null })
            }
          />
        </DialogContent>
      </Dialog>

      {/* Confirm delete dialog (module or lesson) */}
      <ConfirmDeleteDialog
        open={!!confirmDelete}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title={confirmDelete?.type === "module" ? "Excluir módulo?" : "Excluir aula?"}
        confirmText={confirmDelete?.title ?? ""}
        actionLabel={confirmDelete?.type === "module" ? "Excluir módulo" : "Excluir aula"}
        loading={deleteModuleMut.isPending || deleteLessonMut.isPending}
        description={
          confirmDelete?.type === "module" ? (
            <p>
              O módulo <strong>"{confirmDelete.title}"</strong> será removido permanentemente.
              {confirmDelete.lessonCount > 0 && (
                <>
                  {" "}
                  Ele possui{" "}
                  <strong>
                    {confirmDelete.lessonCount} aula
                    {confirmDelete.lessonCount === 1 ? "" : "s"}
                  </strong>{" "}
                  que também serão excluídas.
                </>
              )}
            </p>
          ) : (
            <p>
              A aula <strong>"{confirmDelete?.title}"</strong> será removida permanentemente. Essa
              ação não pode ser desfeita.
            </p>
          )
        }
        onConfirm={() => {
          if (!confirmDelete) return;
          if (confirmDelete.type === "module") {
            deleteModuleMut.mutate(confirmDelete.id);
          } else {
            deleteLessonMut.mutate(confirmDelete.id);
          }
          setConfirmDelete(null);
        }}
      />
    </div>
  );
}

function ModuleForm({
  initial,
  onSubmit,
  onCancel,
  saving,
}: {
  initial: CourseModuleRow | null;
  onSubmit: (values: { title: string; description: string | null }) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [title, setTitle] = React.useState(initial?.title ?? "");
  const [description, setDescription] = React.useState(
    initial?.description ?? "",
  );

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        onSubmit({ title: title.trim(), description: description.trim() || null });
      }}
    >
      <div className="space-y-2">
        <Label>Título do módulo</Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex.: Primeiros passos"
          required
          autoFocus
        />
      </div>
      <div className="space-y-2">
        <Label>Descrição (opcional)</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Breve descrição do que o aluno vai aprender"
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving || !title.trim()}>
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : initial ? (
            "Salvar"
          ) : (
            "Criar módulo"
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}

function LessonEditor({
  lesson,
  onSaved,
}: {
  lesson: CourseLessonRow;
  onSaved: () => void;
}) {
  const [title, setTitle] = React.useState(lesson.title);
  const [description, setDescription] = React.useState(lesson.description ?? "");
  const [provider, setProvider] = React.useState<LessonProvider>(lesson.provider);
  const [videoUrl, setVideoUrl] = React.useState(lesson.video_url ?? "");
  const [embedCode, setEmbedCode] = React.useState(lesson.embed_code ?? "");
  const [bodyText, setBodyText] = React.useState(lesson.body_text ?? "");
  const [pdfUrl, setPdfUrl] = React.useState(lesson.pdf_url ?? "");
  const [pdfLabel, setPdfLabel] = React.useState(lesson.pdf_label ?? "");
  const [complementaryUrl, setComplementaryUrl] = React.useState(
    lesson.complementary_url ?? "",
  );
  const [complementaryLabel, setComplementaryLabel] = React.useState(
    lesson.complementary_label ?? "",
  );
  const [published, setPublished] = React.useState(lesson.status === "published");
  const [ytSettings, setYtSettings] = React.useState<YouTubePlayerSettings>(() =>
    normalizeYouTubeSettings(lesson.youtube_settings ?? DEFAULT_YOUTUBE_SETTINGS),
  );

  const showVideoUrlField = provider === "youtube" || provider === "vimeo";
  const showEmbedField = provider === "iframe" || provider === "hostvsl" || provider === "panda" || provider === "vturb";
  const isYouTube = provider === "youtube";

  const saveMut = useMutation({
    mutationFn: () =>
      updateLesson(lesson.id, {
        title: title.trim() || "Sem título",
        description: description.trim() || null,
        provider,
        video_url: showVideoUrlField ? (videoUrl.trim() || null) : null,
        embed_code: showEmbedField ? (embedCode.trim() || null) : null,
        body_text: bodyText.trim() || null,
        pdf_url: pdfUrl.trim() || null,
        pdf_label: pdfLabel.trim() || null,
        complementary_url: complementaryUrl.trim() || null,
        complementary_label: complementaryLabel.trim() || null,
        status: published ? "published" : "draft",
        // A coluna é NOT NULL no banco; enviamos sempre um objeto válido
        // (para provedores não-YouTube o valor é simplesmente ignorado pelo player).
        youtube_settings: ytSettings,
      }),
    onSuccess: () => {
      toast.success("Aula salva");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 rounded-2xl border border-border/60 bg-surface/40 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Nome da aula
          </Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Digite o nome da aula…"
            className="mt-2 h-12 rounded-xl border border-border bg-background px-4 text-lg font-semibold text-foreground shadow-sm transition-colors placeholder:font-normal placeholder:text-muted-foreground/70 hover:border-gold/60 focus-visible:border-gold focus-visible:ring-2 focus-visible:ring-gold/30"
          />
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Esse é o título que aparece para o aluno.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex items-center gap-2 rounded-full bg-surface/60 px-3 py-1.5 text-xs">
            <Switch checked={published} onCheckedChange={setPublished} />
            <span>{published ? "Publicada" : "Rascunho"}</span>
          </div>
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
            {saveMut.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Salvar
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Descrição curta</Label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Resumo de uma linha"
        />
      </div>

      {/* Video block */}
      <div className="space-y-4 rounded-xl border border-border/40 bg-surface/30 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <PlayCircle className="h-4 w-4 text-primary" /> Vídeo da aula
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Provedor</Label>
            <Select
              value={provider}
              onValueChange={(v) => setProvider(v as LessonProvider)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LESSON_PROVIDERS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {showVideoUrlField && (
            <div className="space-y-2">
              <Label>URL do vídeo</Label>
              <Input
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder={
                  provider === "youtube"
                    ? "https://youtube.com/watch?v=..."
                    : provider === "vimeo"
                      ? "https://vimeo.com/..."
                      : "https://..."
                }
              />
            </div>
          )}
        </div>
        {showEmbedField && (
          <div className="space-y-2">
            <Label>
              {provider === "iframe"
                ? "Código de embed (iframe)"
                : "Código de embed (opcional)"}
            </Label>
            <Textarea
              value={embedCode}
              onChange={(e) => setEmbedCode(e.target.value)}
              rows={4}
              placeholder='<iframe src="..." allowfullscreen></iframe>'
              className="font-mono text-xs"
            />
          </div>
        )}

        {isYouTube && (
          <YouTubePlayerSettingsBlock
            videoUrl={videoUrl}
            settings={ytSettings}
            onChange={setYtSettings}
          />
        )}
      </div>

      {/* Body text */}
      <div className="space-y-2">
        <Label>Texto abaixo da aula</Label>
        <Textarea
          value={bodyText}
          onChange={(e) => setBodyText(e.target.value)}
          rows={5}
          placeholder="Resumo, observações, instruções, CTA, etc."
        />
        <p className="text-xs text-muted-foreground">
          Aparece logo abaixo do player na visão do aluno.
        </p>
      </div>

      {/* Materials */}
      <div className="space-y-4 rounded-xl border border-border/40 bg-surface/30 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <FileText className="h-4 w-4 text-primary" /> Materiais complementares
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>URL do PDF</Label>
            <Input
              value={pdfUrl}
              onChange={(e) => setPdfUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className="space-y-2">
            <Label>Rótulo do botão de PDF</Label>
            <Input
              value={pdfLabel}
              onChange={(e) => setPdfLabel(e.target.value)}
              placeholder="Ex.: Baixar PDF da aula"
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>
              <span className="inline-flex items-center gap-1">
                <LinkIcon className="h-3 w-3" /> URL complementar
              </span>
            </Label>
            <Input
              value={complementaryUrl}
              onChange={(e) => setComplementaryUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className="space-y-2">
            <Label>Rótulo do botão complementar</Label>
            <Input
              value={complementaryLabel}
              onChange={(e) => setComplementaryLabel(e.target.value)}
              placeholder="Ex.: Acessar material extra"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  YouTube player settings (admin)                                            */
/* -------------------------------------------------------------------------- */

type YouTubeBoolKey = {
  [K in keyof YouTubePlayerSettings]: YouTubePlayerSettings[K] extends boolean
    ? K
    : never;
}[keyof YouTubePlayerSettings];

const YT_TOGGLES: Array<{
  key: YouTubeBoolKey;
  label: string;
  hint?: string;
}> = [
  {
    key: "whiteLabelMode",
    label: "Reduzir identidade visual do YouTube",
    hint: "Aplica parâmetros e camada visual personalizada para deixar o player mais limpo.",
  },
  {
    key: "showControls",
    label: "Mostrar controles do YouTube",
    hint: "Permite que o aluno veja barra de tempo, volume e tela cheia.",
  },
  { key: "hideRelated", label: "Ocultar vídeos relacionados" },
  { key: "hideAnnotations", label: "Ocultar anotações/cards" },
  { key: "disableKeyboard", label: "Desativar atalhos do teclado" },
  {
    key: "customPlayButton",
    label: "Usar botão play personalizado",
    hint: "Mostra um botão com a identidade da plataforma sobre o player antes do vídeo iniciar.",
  },
  {
    key: "hideInitialBottomBar",
    label: "Esconder barra inferior inicial",
    hint: "Adiciona um degradê sutil sobre a barra inferior do YouTube antes da interação.",
  },
];

function YouTubePlayerSettingsBlock({
  videoUrl,
  settings,
  onChange,
}: {
  videoUrl: string;
  settings: YouTubePlayerSettings;
  onChange: (next: YouTubePlayerSettings) => void;
}) {
  const updateBool = (key: YouTubeBoolKey, value: boolean) =>
    onChange({ ...settings, [key]: value });

  return (
    <div className="space-y-4 rounded-xl border border-primary/20 bg-primary/[0.04] p-4">
      <div className="flex items-start gap-2">
        <Sparkles className="mt-0.5 h-4 w-4 text-primary" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-foreground">
            Configurações do Player YouTube
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Deixe o player mais limpo e com aparência de plataforma própria.
            Alguns elementos do YouTube podem continuar aparecendo por limitação
            do próprio provedor.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {YT_TOGGLES.map((t) => (
          <label
            key={t.key}
            className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border border-border/50 bg-surface/40 px-3 py-2.5 transition-colors hover:border-primary/40"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-medium text-foreground">
                {t.label}
              </span>
              {t.hint && (
                <span className="mt-0.5 block text-[11px] text-muted-foreground">
                  {t.hint}
                </span>
              )}
            </span>
            <Switch
              checked={settings[t.key]}
              onCheckedChange={(v) => updateBool(t.key, v)}
            />
          </label>
        ))}
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-border/40 bg-surface/30 p-3">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Para uma experiência 100% white-label, sem marca, anúncios ou
          elementos externos, recomendamos usar Host VSL, Vimeo, Bunny, Panda
          ou embed próprio.
        </p>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground">
          Pré-visualização
        </Label>
        <YouTubeWhiteLabelPlayer
          url={videoUrl || null}
          settings={settings}
          title="Pré-visualização da aula"
        />
        <p className="text-[11px] text-muted-foreground">
          A prévia atualiza ao vivo conforme você liga e desliga as opções.
          Salve a aula para aplicar para os alunos.
        </p>
      </div>
    </div>
  );
}

