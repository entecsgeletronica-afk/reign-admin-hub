import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  AtSign,
  Save,
  Info,
  AlertTriangle,
  Plus,
  Pencil,
  Trash2,
  Mail,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/admin/PageHeader";
import {
  getEmailSettings,
  saveEmailSettings,
  listEmailTemplates,
  upsertEmailTemplate,
  deleteEmailTemplate,
  toggleEmailTemplate,
  type EmailSettings,
  type EmailTemplate,
} from "@/services/settings";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/_shell/templates")({
  component: TemplatesPage,
});

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function TemplatesPage() {
  const qc = useQueryClient();
  const [data, setData] = React.useState<(EmailSettings & { id?: string }) | null>(null);
  const [touched, setTouched] = React.useState(false);
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<EmailTemplate | null>(null);

  React.useEffect(() => {
    getEmailSettings().then(setData).catch((e: Error) => toast.error(e.message));
  }, []);

  const templatesQuery = useQuery({
    queryKey: ["email_templates"],
    queryFn: listEmailTemplates,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      toggleEmailTemplate(id, enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email_templates"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteEmailTemplate,
    onSuccess: () => {
      toast.success("Template removido.");
      qc.invalidateQueries({ queryKey: ["email_templates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!data) return null;

  const emailValid = EMAIL_RX.test(data.sender_email.trim());
  const blocked = !emailValid;

  function update<K extends keyof EmailSettings>(key: K, value: EmailSettings[K]) {
    setData((d) => (d ? { ...d, [key]: value } : d));
  }

  async function onSaveSender() {
    if (!data) return;
    setTouched(true);
    if (!emailValid) {
      toast.error("Preencha um e-mail válido.");
      return;
    }
    try {
      await saveEmailSettings(data);
      const fresh = await getEmailSettings();
      setData(fresh);
      toast.success("E-mail principal salvo.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function openCreate() {
    setEditing(null);
    setEditorOpen(true);
  }

  function openEdit(tpl: EmailTemplate) {
    setEditing(tpl);
    setEditorOpen(true);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="E-mails"
        title="Templates e remetente"
        description="Configure o e-mail oficial da plataforma e gerencie os modelos visuais usados nos disparos transacionais."
      />

      {blocked && (
        <div className="flex items-start gap-3 rounded-3xl border border-gold/40 bg-gold-soft p-5">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
          <div className="space-y-1 text-sm">
            <div className="font-semibold text-foreground">Defina o e-mail principal</div>
            <p className="text-muted-foreground">
              Ele será o <strong className="text-foreground">remetente / contato responsável</strong>{" "}
              pelos disparos automáticos de{" "}
              <strong className="text-foreground">compra aprovada</strong> (com login e senha) e{" "}
              <strong className="text-foreground">recuperação de senha</strong>. Sem esse endereço,
              os e-mails são enviados sem identificação da sua marca.
            </p>
          </div>
        </div>
      )}

      {/* Sender */}
      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gold-soft text-gold">
            <AtSign className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-gold">
              E-mail principal da plataforma
            </div>
            <h2 className="mt-1 text-xl font-bold text-foreground sm:text-2xl">
              Endereço responsável pelos disparos
            </h2>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Nome do remetente</label>
            <input
              type="text"
              value={data.sender_name}
              onChange={(e) => update("sender_name", e.target.value)}
              className="h-11 w-full rounded-xl border border-border bg-surface-elevated px-4 text-sm text-foreground focus:border-gold focus:outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">E-mail principal</label>
            <input
              type="email"
              value={data.sender_email}
              onChange={(e) => {
                update("sender_email", e.target.value);
                setTouched(true);
              }}
              placeholder="contato@seudominio.com"
              className={cn(
                "h-11 w-full rounded-xl border bg-surface-elevated px-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none",
                touched && !emailValid
                  ? "border-destructive/60 focus:border-destructive"
                  : "border-border focus:border-gold",
              )}
            />
            {touched && !emailValid && (
              <p className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
                <AlertTriangle className="h-3.5 w-3.5" />
                E-mail obrigatório.
              </p>
            )}
          </div>
        </div>

        <div className="mt-5 flex items-start gap-2 rounded-2xl border border-border bg-surface-elevated p-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
          <span>
            Ao salvar, este endereço passa a assinar automaticamente os e-mails de
            compra aprovada (com login e senha) e recuperação de senha. Os clientes
            verão o nome e respondem direto para você.
          </span>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onSaveSender}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-gold px-5 text-sm font-semibold text-gold-foreground shadow transition hover:brightness-105"
          >
            <Save className="h-4 w-4" /> Salvar e-mail principal
          </button>
        </div>
      </section>

      {/* Templates list */}
      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Modelos de e-mail</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Cadastre os modelos transacionais. Cada modelo possui uma chave única (
              <code>template_key</code>) usada pelo backend ao disparar.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-gold px-4 text-sm font-semibold text-gold-foreground shadow transition hover:brightness-105"
          >
            <Plus className="h-4 w-4" /> Novo template
          </button>
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface-elevated text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Nome</th>
                <th className="px-4 py-3 text-left">Chave</th>
                <th className="px-4 py-3 text-left">Assunto</th>
                <th className="px-4 py-3 text-left">Ativo</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {templatesQuery.isLoading ? (
                <tr>
                  <td className="px-4 py-6 text-center text-muted-foreground" colSpan={5}>
                    Carregando...
                  </td>
                </tr>
              ) : (templatesQuery.data ?? []).length === 0 ? (
                <tr>
                  <td className="px-4 py-10 text-center text-muted-foreground" colSpan={5}>
                    <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
                      <Mail className="h-6 w-6 text-muted-foreground" />
                      Nenhum template cadastrado ainda.
                    </div>
                  </td>
                </tr>
              ) : (
                (templatesQuery.data ?? []).map((t) => (
                  <tr key={t.id} className="hover:bg-surface-elevated/50">
                    <td className="px-4 py-3 font-semibold text-foreground">{t.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {t.template_key}
                    </td>
                    <td className="px-4 py-3 text-foreground">{t.subject}</td>
                    <td className="px-4 py-3">
                      <Switch
                        checked={t.enabled}
                        onCheckedChange={(v) =>
                          toggleMutation.mutate({ id: t.id, enabled: v })
                        }
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(t)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface-elevated text-muted-foreground transition hover:text-foreground"
                          title="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Remover o template "${t.name}"?`)) {
                              deleteMutation.mutate(t.id);
                            }
                          }}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-destructive/30 bg-destructive/10 text-destructive transition hover:bg-destructive/20"
                          title="Remover"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {editorOpen && (
        <TemplateEditor
          template={editing}
          onClose={() => setEditorOpen(false)}
          onSaved={() => {
            setEditorOpen(false);
            qc.invalidateQueries({ queryKey: ["email_templates"] });
          }}
        />
      )}
    </div>
  );
}

function TemplateEditor({
  template,
  onClose,
  onSaved,
}: {
  template: EmailTemplate | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = React.useState(template?.name ?? "");
  const [key, setKey] = React.useState(template?.template_key ?? "");
  const [subject, setSubject] = React.useState(template?.subject ?? "");
  const [body, setBody] = React.useState(template?.body_html ?? "");
  const [enabled, setEnabled] = React.useState(template?.enabled ?? true);
  const [saving, setSaving] = React.useState(false);

  async function handleSave() {
    if (!name.trim() || !key.trim() || !subject.trim() || !body.trim()) {
      toast.error("Preencha todos os campos.");
      return;
    }
    setSaving(true);
    try {
      await upsertEmailTemplate({
        id: template?.id,
        template_key: key.trim(),
        name: name.trim(),
        subject: subject.trim(),
        body_html: body,
        enabled,
      });
      toast.success(template ? "Template atualizado." : "Template criado.");
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h3 className="text-lg font-semibold text-foreground">
            {template ? "Editar template" : "Novo template"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase text-muted-foreground">
                Nome
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Recuperação de senha"
                className="h-10 w-full rounded-xl border border-border bg-surface-elevated px-3 text-sm text-foreground focus:border-gold focus:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase text-muted-foreground">
                Chave (template_key)
              </label>
              <input
                type="text"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="ex: password_reset"
                className="h-10 w-full rounded-xl border border-border bg-surface-elevated px-3 font-mono text-sm text-foreground focus:border-gold focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase text-muted-foreground">Assunto</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ex.: Redefina sua senha em {{app_name}}"
              className="h-10 w-full rounded-xl border border-border bg-surface-elevated px-3 text-sm text-foreground focus:border-gold focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase text-muted-foreground">
              Corpo HTML
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={14}
              placeholder="<h1>Olá {{name}}</h1><p>...</p>"
              className="w-full rounded-xl border border-border bg-surface-elevated p-3 font-mono text-xs text-foreground focus:border-gold focus:outline-none"
            />
            <p className="text-xs text-muted-foreground">
              Use <code>{"{{variavel}}"}</code> para placeholders. Variáveis comuns:{" "}
              <code>{"{{name}}"}</code>, <code>{"{{app_name}}"}</code>, <code>{"{{link}}"}</code>.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={enabled} onCheckedChange={setEnabled} />
            <span className="text-sm text-foreground">Template ativo</span>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border bg-surface-elevated/50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground transition hover:bg-surface-elevated"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-gold px-5 text-sm font-semibold text-gold-foreground shadow transition hover:brightness-105 disabled:opacity-60"
          >
            <Save className="h-4 w-4" /> {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
