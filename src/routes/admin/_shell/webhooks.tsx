import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ShieldAlert,
  Copy,
  Send,
  RotateCcw,
  RefreshCw,
  Save,
  AlertTriangle,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Activity,
  Mail,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { cn } from "@/lib/utils";
import {
  getIntegrationsSettings,
  saveIntegrationsSettings,
  getWebhookUrl,
  sendTestWebhook,
  resendLastPayload,
  listInvalidWebhooks,
  listWebhookEvents,
  listWebhookIntegrations,
  toggleWebhookIntegration,
  type WebhookEvent,
  type WebhookEventFull,
  type TestResult,
} from "@/services/integrations";
import { useEmailOutbox, markEmailSent } from "@/services/email-outbox";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import perfectPayLogo from "@/assets/perfectpay-logo.jpeg";

export const Route = createFileRoute("/admin/_shell/webhooks")({
  component: WebhooksPage,
});

/** Mask a token leaving only the last 4 characters visible. */
function maskToken(token: string): string {
  if (!token) return "";
  const last = token.slice(-4);
  return `${"•".repeat(Math.max(8, token.length - 4))}${last}`;
}

function WebhooksPage() {
  const [token, setToken] = React.useState("");
  const [savedToken, setSavedToken] = React.useState("");
  const [showToken, setShowToken] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [testing, setTesting] = React.useState(false);
  const [resending, setResending] = React.useState(false);
  const [lastResult, setLastResult] = React.useState<TestResult | null>(null);
  const [invalid, setInvalid] = React.useState<WebhookEvent[]>([]);
  const [refreshing, setRefreshing] = React.useState(false);
  const [selected, setSelected] = React.useState<WebhookEvent | null>(null);

  const webhookUrl = React.useMemo(() => getWebhookUrl(), []);
  const hasToken = savedToken.trim().length > 0;

  // Status badge: count recent webhook events to know if we're "receiving"
  const recentEvents = useQuery({
    queryKey: ["webhook_events_recent", "perfectpay"],
    queryFn: () => listWebhookEvents({ provider: "perfectpay", limit: 5 }),
    refetchInterval: 30_000,
  });
  const lastEventAt = recentEvents.data?.[0]?.received_at ?? null;
  const isReceiving = lastEventAt
    ? Date.now() - new Date(lastEventAt).getTime() < 24 * 60 * 60 * 1000
    : false;

  React.useEffect(() => {
    let active = true;
    Promise.all([getIntegrationsSettings(), listInvalidWebhooks()]).then(([s, list]) => {
      if (!active) return;
      setToken(s.perfectpay_token);
      setSavedToken(s.perfectpay_token);
      setInvalid(list);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      toast.success("URL copiada");
    } catch {
      toast.error("Não foi possível copiar a URL");
    }
  }

  async function handleSaveToken() {
    await saveIntegrationsSettings({ perfectpay_token: token.trim() });
    setSavedToken(token.trim());
    setEditing(false);
    setShowToken(false);
    toast.success(token.trim() ? "Token salvo" : "Token removido");
  }

  async function handleTest() {
    setTesting(true);
    const res = await sendTestWebhook(savedToken);
    setLastResult(res);
    if (res.ok) toast.success(res.message);
    else toast.error(res.message);
    const list = await listInvalidWebhooks();
    setInvalid(list);
    setTesting(false);
  }

  async function handleResend() {
    setResending(true);
    const res = await resendLastPayload(savedToken);
    setLastResult(res);
    if (res.ok) toast.success(res.message);
    else if (res.status === 0) toast.error(res.message);
    else toast.error(res.message);
    const list = await listInvalidWebhooks();
    setInvalid(list);
    setResending(false);
  }

  async function handleRefresh() {
    setRefreshing(true);
    const list = await listInvalidWebhooks();
    setInvalid(list);
    setRefreshing(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Admin"
        title="Integrações"
        description="Conecte serviços externos para automatizar vendas, ativações e cancelamentos."
      />

      {/* Premium Perfect Pay status card */}
      <section className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-start gap-4 sm:items-center">
          <img
            src={perfectPayLogo}
            alt="Perfect Pay"
            className="h-12 w-12 shrink-0 rounded-2xl border border-border object-cover shadow-sm"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">Perfect Pay</h2>
              <StatusBadge
                hasToken={hasToken}
                loading={loading}
                isReceiving={isReceiving}
                lastEventAt={lastEventAt}
              />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Conecte sua conta Perfect Pay para liberar produtos automaticamente após a
              confirmação de pagamento.
            </p>
          </div>
          <a
            href="https://help.perfectpay.com.br/article/597-integracao-via-webhook-com-a-perfect-pay"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-gold/50 hover:text-foreground"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Ver instruções
          </a>
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold text-foreground">Configuração da integração</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          A URL e o token abaixo são únicos da sua área. Cole-os no painel da Perfect Pay para começar
          a receber eventos.
        </p>

        {/* Status banner */}
        {!hasToken && !loading && (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div className="text-sm">
              <div className="font-semibold text-destructive">
                Endpoint desprotegido — Token não configurado
              </div>
              <p className="mt-1 text-destructive/80">
                Qualquer pessoa com a URL do webhook pode enviar eventos falsos. Configure o Public
                token da PerfectPay abaixo para validar a origem.
              </p>
            </div>
          </div>
        )}

        {/* Step 1 — URL */}
        <Step n={1} title="URL DO WEBHOOK (COLE NA PERFECTPAY)">
          <div className="rounded-2xl border border-border bg-muted/40 p-3 font-mono text-sm text-foreground">
            {webhookUrl}
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-gold px-4 py-2.5 text-sm font-semibold text-gold-foreground shadow-sm transition-opacity hover:opacity-90"
          >
            <Copy className="h-4 w-4" /> Copiar webhook
          </button>
        </Step>

        {/* Step 2 — Token */}
        <Step n={2} title="TOKEN PÚBLICO DA PERFECTPAY">
          <p className="text-sm text-muted-foreground">
            Na PerfectPay (tela do webhook), copie o campo{" "}
            <span className="font-semibold text-foreground">Public token</span> e cole abaixo. Ele
            garante que só os webhooks vindos da sua conta PerfectPay sejam aceitos.
          </p>
          {hasToken && !editing ? (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex h-11 flex-1 items-center justify-between gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 px-4 font-mono text-sm text-foreground">
                <span className="truncate">
                  {showToken ? savedToken : maskToken(savedToken)}
                </span>
                <button
                  type="button"
                  onClick={() => setShowToken((v) => !v)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label={showToken ? "Ocultar token" : "Revelar token"}
                >
                  {showToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditing(true);
                  setShowToken(true);
                }}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-muted px-5 text-sm font-semibold text-foreground transition-colors hover:bg-muted/70"
              >
                Trocar token
              </button>
            </div>
          ) : (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Ex.: d13f0cafd9470cef9eabe6c3ac94534d"
                className="h-11 flex-1 rounded-2xl border border-border bg-muted/40 px-4 font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-gold"
              />
              <button
                type="button"
                onClick={handleSaveToken}
                disabled={token === savedToken}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-muted px-5 text-sm font-semibold text-foreground transition-colors hover:bg-muted/70 disabled:opacity-50"
              >
                <Save className="h-4 w-4" /> Salvar token
              </button>
              {hasToken && editing && (
                <button
                  type="button"
                  onClick={() => {
                    setToken(savedToken);
                    setEditing(false);
                    setShowToken(false);
                  }}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-border bg-transparent px-5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
                >
                  Cancelar
                </button>
              )}
            </div>
          )}
          {!hasToken && !loading && (
            <div className="mt-2 inline-flex items-center gap-2 text-xs text-destructive">
              <AlertTriangle className="h-3.5 w-3.5" />
              Sem token configurado — recomendamos salvar para validar a origem dos webhooks.
            </div>
          )}
        </Step>

        {/* Step 3 — Test */}
        <Step n={3} title="TESTAR INTEGRAÇÃO">
          <p className="text-sm text-muted-foreground">
            Envia um evento de exemplo para a sua URL acima usando o token configurado. O resultado
            da chamada (status HTTP) aparece abaixo.
          </p>
          <button
            type="button"
            onClick={handleTest}
            disabled={testing}
            className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-gold/40 bg-gold/10 px-4 py-2.5 text-sm font-semibold text-gold transition-colors hover:bg-gold/20 disabled:opacity-50"
          >
            <Send className="h-4 w-4" /> {testing ? "Enviando..." : "Testar webhook"}
          </button>

          {lastResult && (
            <div
              className={cn(
                "mt-3 rounded-2xl border p-3 text-sm",
                lastResult.ok
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  : "border-destructive/30 bg-destructive/10 text-destructive",
              )}
            >
              <span className="font-semibold">HTTP {lastResult.status}</span> — {lastResult.message}
            </div>
          )}

          <div className="mt-5 rounded-2xl border border-border bg-muted/30 p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <RotateCcw className="mr-1 inline h-3 w-3" /> REENVIAR ÚLTIMO PAYLOAD RECEBIDO
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Busca o último evento real registrado em <code>webhook_events</code> e o reenvia para
              a sua URL — útil para validar se a checagem retorna 200 ou 400.
            </p>
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-muted px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted/70 disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4" /> {resending ? "Reenviando..." : "Reenviar último payload"}
            </button>
          </div>
        </Step>

        {/* Step 4 — Invalid */}
        <Step
          n={4}
          title="WEBHOOKS INVALIDADOS"
          actions={
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-2xl border border-border bg-muted/40 px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted/70 disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} /> Atualizar
            </button>
          }
        >
          <p className="text-sm text-muted-foreground">
            Últimos eventos rejeitados pela validação. Selecione um para ver quais campos faltaram
            ou vieram inválidos.
          </p>

          {invalid.length === 0 ? (
            <div className="mt-3 rounded-2xl border border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              Nenhum webhook invalidado nos últimos eventos.
            </div>
          ) : (
            <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1.2fr]">
              <ul className="flex flex-col gap-2">
                {invalid.map((evt) => (
                  <li key={evt.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(evt)}
                      className={cn(
                        "w-full rounded-2xl border p-3 text-left text-sm transition-colors",
                        selected?.id === evt.id
                          ? "border-gold bg-gold/10"
                          : "border-border bg-muted/30 hover:bg-muted/50",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs text-muted-foreground">
                          {new Date(evt.received_at).toLocaleString("pt-BR")}
                        </span>
                        <span className="rounded-full bg-destructive/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-destructive">
                          Inválido
                        </span>
                      </div>
                      <div className="mt-1 truncate text-foreground">{evt.reason ?? "Sem motivo"}</div>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="rounded-2xl border border-border bg-muted/30 p-4">
                {selected ? (
                  <>
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Payload
                    </div>
                    <pre className="mt-2 max-h-80 overflow-auto rounded-xl bg-background p-3 text-xs text-foreground">
                      {JSON.stringify(selected.payload, null, 2)}
                    </pre>
                  </>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    Selecione um evento para ver o payload.
                  </div>
                )}
              </div>
            </div>
          )}
        </Step>
      </section>

      <WebhookIntegrationsCard />
      <EmailOutboxCard />
      <WebhookEventsAudit />
    </div>
  );
}

function WebhookIntegrationsCard() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["webhook_integrations"],
    queryFn: listWebhookIntegrations,
  });
  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      toggleWebhookIntegration(id, active),
    onSuccess: () => {
      toast.success("Integração atualizada.");
      qc.invalidateQueries({ queryKey: ["webhook_integrations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
      <h2 className="text-lg font-semibold text-foreground">Integrações cadastradas</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Provedores que enviam webhooks para a plataforma.
      </p>

      <div className="mt-5 overflow-hidden rounded-2xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface-elevated text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Nome</th>
              <th className="px-4 py-3 text-left">Provedor</th>
              <th className="px-4 py-3 text-left">Endpoint</th>
              <th className="px-4 py-3 text-left">Última recepção</th>
              <th className="px-4 py-3 text-left">Ativo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {query.isLoading ? (
              <tr>
                <td className="px-4 py-6 text-center text-muted-foreground" colSpan={5}>
                  Carregando...
                </td>
              </tr>
            ) : (query.data ?? []).length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-muted-foreground" colSpan={5}>
                  Nenhuma integração cadastrada.
                </td>
              </tr>
            ) : (
              (query.data ?? []).map((i) => (
                <tr key={i.id} className="hover:bg-surface-elevated/50">
                  <td className="px-4 py-3 font-semibold text-foreground">{i.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{i.provider}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {i.endpoint_url}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {i.last_received_at
                      ? new Date(i.last_received_at).toLocaleString("pt-BR")
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Switch
                      checked={i.active}
                      onCheckedChange={(v) => toggle.mutate({ id: i.id, active: v })}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function WebhookEventsAudit() {
  const [status, setStatus] = React.useState<"all" | "ok" | "invalid">("all");
  const [selected, setSelected] = React.useState<WebhookEventFull | null>(null);

  const query = useQuery({
    queryKey: ["webhook_events_audit", status],
    queryFn: () => listWebhookEvents({ status, limit: 100 }),
  });

  return (
    <section className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Auditoria de eventos</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Histórico completo dos últimos 100 webhooks recebidos.
          </p>
        </div>
        <div className="inline-flex rounded-xl border border-border bg-surface-elevated p-1">
          {(["all", "ok", "invalid"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={cn(
                "h-8 rounded-lg px-3 text-xs font-semibold transition-colors",
                status === s
                  ? "bg-gold text-gold-foreground shadow"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s === "all" ? "Todos" : s === "ok" ? "Válidos" : "Inválidos"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_1.2fr]">
        <div className="overflow-hidden rounded-2xl border border-border">
          <ul className="max-h-[420px] divide-y divide-border overflow-auto">
            {query.isLoading ? (
              <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                Carregando...
              </li>
            ) : (query.data ?? []).length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                Nenhum evento encontrado.
              </li>
            ) : (
              (query.data ?? []).map((evt) => (
                <li key={evt.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(evt)}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm transition-colors",
                      selected?.id === evt.id
                        ? "bg-gold/10"
                        : "hover:bg-surface-elevated/60",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {evt.status === "ok" ? (
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />
                        )}
                        <span className="truncate font-semibold text-foreground">
                          {evt.event_type ?? "—"}
                        </span>
                        <span className="rounded-full border border-border bg-surface-elevated px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
                          {evt.provider}
                        </span>
                      </div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {new Date(evt.received_at).toLocaleString("pt-BR")}
                        {evt.reason ? ` · ${evt.reason}` : ""}
                      </div>
                    </div>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="rounded-2xl border border-border bg-surface-elevated/40 p-4">
          {selected ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-foreground">
                    {selected.event_type ?? "—"}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {selected.provider} ·{" "}
                    {new Date(selected.received_at).toLocaleString("pt-BR")}
                  </div>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                    selected.status === "ok"
                      ? "bg-emerald-500/15 text-emerald-500"
                      : "bg-destructive/15 text-destructive",
                  )}
                >
                  {selected.status}
                </span>
              </div>
              {selected.error_message && (
                <div className="mt-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                  {selected.error_message}
                </div>
              )}
              <div className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Payload
              </div>
              <pre className="mt-1 max-h-80 overflow-auto rounded-xl bg-background p-3 text-xs text-foreground">
                {JSON.stringify(selected.payload, null, 2)}
              </pre>
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Selecione um evento para ver o payload completo.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function EmailOutboxCard() {
  const [status, setStatus] = React.useState<"all" | "pending" | "sent" | "failed">("all");
  const [selected, setSelected] = React.useState<string | null>(null);
  const qc = useQueryClient();
  const query = useEmailOutbox({ status, limit: 50 });

  const rows = query.data ?? [];
  const selectedRow = rows.find((r) => r.id === selected) ?? null;
  const pendingCount = rows.filter((r) => r.status === "pending").length;

  async function handleMarkSent(id: string) {
    try {
      await markEmailSent(id);
      toast.success("E-mail marcado como enviado.");
      qc.invalidateQueries({ queryKey: ["email_outbox"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao marcar como enviado.");
    }
  }

  return (
    <section className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gold/15 text-gold">
            <Mail className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">
                Fila de e-mails de acesso
              </h2>
              {pendingCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-500">
                  <Clock className="h-3 w-3" /> {pendingCount} pendente{pendingCount > 1 ? "s" : ""}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Notificações geradas pelo webhook quando uma compra é aprovada e libera produtos.
              O envio efetivo ainda não está conectado a um provedor — os e-mails ficam aqui prontos para serem enviados.
            </p>
          </div>
        </div>
        <div className="inline-flex rounded-xl border border-border bg-surface-elevated p-1">
          {(["all", "pending", "sent", "failed"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={cn(
                "h-8 rounded-lg px-3 text-xs font-semibold transition-colors",
                status === s
                  ? "bg-gold text-gold-foreground shadow"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s === "all"
                ? "Todos"
                : s === "pending"
                  ? "Pendentes"
                  : s === "sent"
                    ? "Enviados"
                    : "Com erro"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_1.4fr]">
        <div className="overflow-hidden rounded-2xl border border-border">
          <ul className="max-h-[420px] divide-y divide-border overflow-auto">
            {query.isLoading ? (
              <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                Carregando...
              </li>
            ) : rows.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                Nenhum e-mail na fila.
              </li>
            ) : (
              rows.map((evt) => (
                <li key={evt.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(evt.id)}
                    className={cn(
                      "flex w-full items-start justify-between gap-3 px-4 py-3 text-left text-sm transition-colors",
                      selected === evt.id
                        ? "bg-gold/10"
                        : "hover:bg-surface-elevated/60",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <OutboxStatusDot status={evt.status} />
                        <span className="truncate font-semibold text-foreground">
                          {evt.recipient_email}
                        </span>
                      </div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {new Date(evt.created_at).toLocaleString("pt-BR")} · {evt.product_ids.length}{" "}
                        produto(s)
                        {evt.external_order_id ? ` · #${evt.external_order_id}` : ""}
                      </div>
                    </div>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="rounded-2xl border border-border bg-surface-elevated/40 p-4">
          {selectedRow ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-foreground">
                    {selectedRow.subject}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">
                    Para: {selectedRow.recipient_name ? `${selectedRow.recipient_name} · ` : ""}
                    {selectedRow.recipient_email}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                      selectedRow.status === "sent"
                        ? "bg-emerald-500/15 text-emerald-500"
                        : selectedRow.status === "failed"
                          ? "bg-destructive/15 text-destructive"
                          : "bg-amber-500/15 text-amber-500",
                    )}
                  >
                    {selectedRow.status}
                  </span>
                  {selectedRow.status === "pending" && (
                    <button
                      type="button"
                      onClick={() => handleMarkSent(selectedRow.id)}
                      className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-500 hover:bg-emerald-500/20"
                    >
                      Marcar enviado
                    </button>
                  )}
                </div>
              </div>
              {selectedRow.area_url && (
                <div className="mt-3 text-xs text-muted-foreground">
                  Link da área:{" "}
                  <a
                    href={selectedRow.area_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-foreground hover:text-gold"
                  >
                    {selectedRow.area_url}
                  </a>
                </div>
              )}
              <div className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Pré-visualização
              </div>
              <div
                className="mt-1 max-h-80 overflow-auto rounded-xl border border-border bg-background p-3"
                dangerouslySetInnerHTML={{ __html: selectedRow.body_html }}
              />
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Selecione um e-mail para visualizar.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function OutboxStatusDot({ status }: { status: string }) {
  const cls =
    status === "sent"
      ? "bg-emerald-500"
      : status === "failed"
        ? "bg-destructive"
        : "bg-amber-500";
  return <span className={cn("inline-block h-2 w-2 shrink-0 rounded-full", cls)} />;
}

function Step({
  n,
  title,
  actions,
  children,
}: {
  n: number;
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-6 border-t border-border pt-6 first-of-type:mt-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gold text-xs font-bold text-gold-foreground">
            {n}
          </span>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">{title}</h3>
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
}

function StatusBadge({
  hasToken,
  loading,
  isReceiving,
  lastEventAt,
}: {
  hasToken: boolean;
  loading: boolean;
  isReceiving: boolean;
  lastEventAt: string | null;
}) {
  if (loading) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Carregando…
      </span>
    );
  }
  if (!hasToken) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-destructive">
        <AlertTriangle className="h-3 w-3" /> Não configurado
      </span>
    );
  }
  if (isReceiving) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-500"
        title={lastEventAt ? `Último evento: ${new Date(lastEventAt).toLocaleString("pt-BR")}` : undefined}
      >
        <Activity className="h-3 w-3" /> Recebendo eventos
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gold">
      <CheckCircle2 className="h-3 w-3" /> Configurado
    </span>
  );
}

