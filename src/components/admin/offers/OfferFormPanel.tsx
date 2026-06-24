import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Save, Copy, Webhook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useCatalogProducts } from "@/hooks/use-catalog-db";
import { useOffer } from "@/hooks/use-offers";
import {
  createOffer,
  parseCodesInput,
  setOfferProducts,
  updateOffer,
  type AccessDurationType,
  type OfferGateway,
  type OfferProductInput,
  type OfferSaleMode,
  type OfferStatus,
} from "@/services/offers";
import { cn } from "@/lib/utils";
import perfectPayLogo from "@/assets/perfectpay-logo.jpeg";

interface Props {
  variationId: string;
  offerId: string | null;
  onSaved: () => void;
  onCancel: () => void;
}

type Step = 1 | 2;

interface ProductRow {
  product_id: string;
  enabled: boolean;
  access_duration_type: AccessDurationType;
  access_duration_days: number | null;
}

const DURATION_OPTIONS: { value: AccessDurationType; days: number | null; label: string }[] = [
  { value: "lifetime", days: null, label: "Vitalício" },
  { value: "days", days: 7, label: "7 dias" },
  { value: "days", days: 15, label: "15 dias" },
  { value: "days", days: 30, label: "30 dias" },
  { value: "days", days: 90, label: "90 dias" },
  { value: "days", days: 365, label: "1 ano" },
  { value: "subscription_active", days: null, label: "Enquanto assinatura ativa" },
  { value: "custom", days: null, label: "Personalizado" },
];

function durationKey(t: AccessDurationType, d: number | null): string {
  if (t === "lifetime") return "lifetime";
  if (t === "custom") return "custom";
  if (t === "subscription_active") return "subscription_active";
  return `days:${d ?? 30}`;
}

export function OfferFormPanel({ variationId, offerId, onSaved, onCancel }: Props) {
  const qc = useQueryClient();
  const isEdit = !!offerId;
  const { data: existing } = useOffer(offerId);
  const { data: products = [] } = useCatalogProducts({
    includeUnpublished: true,
    variationId,
  });

  const [step, setStep] = React.useState<Step>(1);

  // Step 1 — dados
  const [gateway, setGateway] = React.useState<OfferGateway>("perfectpay");
  const [offerName, setOfferName] = React.useState("");
  const [saleMode, setSaleMode] = React.useState<OfferSaleMode>("one_time");
  const [codesText, setCodesText] = React.useState("");
  const [token, setToken] = React.useState("");
  const [status, setStatus] = React.useState<OfferStatus>("active");
  const [notes, setNotes] = React.useState("");

  // Step 2 — produtos
  const [productRows, setProductRows] = React.useState<ProductRow[]>([]);
  const [savedOfferId, setSavedOfferId] = React.useState<string | null>(offerId);

  // Hydrate from existing offer
  React.useEffect(() => {
    if (!existing) return;
    setGateway(existing.gateway);
    setOfferName(existing.offer_name);
    setSaleMode(existing.sale_mode);
    setCodesText(existing.codes.map((c) => c.code).join(", "));
    setToken(existing.token ?? "");
    setStatus(existing.status);
    setNotes(existing.notes ?? "");
    setSavedOfferId(existing.id);
  }, [existing]);

  // Build product rows when products list and existing data are ready
  React.useEffect(() => {
    if (products.length === 0) return;
    const existingMap = new Map(
      (existing?.products ?? []).map((p) => [p.product_id, p]),
    );
    setProductRows(
      products.map((p) => {
        const ex = existingMap.get(p.id);
        return {
          product_id: p.id,
          enabled: !!ex,
          access_duration_type: (ex?.access_duration_type ?? "lifetime") as AccessDurationType,
          access_duration_days: ex?.access_duration_days ?? null,
        };
      }),
    );
  }, [products, existing]);

  const saveStep1Mut = useMutation({
    mutationFn: async () => {
      const codes = parseCodesInput(codesText);
      if (!offerName.trim()) throw new Error("Informe o nome da entrega");
      if (codes.length === 0)
        throw new Error("Informe pelo menos um código de produto/plano");

      if (savedOfferId) {
        await updateOffer({
          id: savedOfferId,
          gateway,
          offer_name: offerName.trim(),
          sale_mode: saleMode,
          token: token.trim() || null,
          status,
          notes: notes.trim() || null,
          codes,
        });
        return savedOfferId;
      }

      const created = await createOffer({
        variation_id: variationId,
        gateway,
        offer_name: offerName.trim(),
        sale_mode: saleMode,
        token: token.trim() || null,
        status,
        notes: notes.trim() || null,
        codes,
      });
      return created.id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["offers"] });
      setSavedOfferId(id);
      setStep(2);
      toast.success(isEdit ? "Oferta atualizada" : "Oferta criada — agora vincule os produtos");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveStep2Mut = useMutation({
    mutationFn: async () => {
      if (!savedOfferId) throw new Error("Salve os dados da oferta primeiro");
      const enabled: OfferProductInput[] = productRows
        .filter((r) => r.enabled)
        .map((r, i) => ({
          product_id: r.product_id,
          access_duration_type: r.access_duration_type,
          access_duration_days:
            r.access_duration_type === "days" ? r.access_duration_days ?? 30 : null,
          release_mode: "immediate",
          order_index: i,
        }));
      await setOfferProducts(savedOfferId, enabled);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["offers"] });
      toast.success("Produtos vinculados à oferta");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const enabledCount = productRows.filter((r) => r.enabled).length;

  return (
    <div className="space-y-4">
      {/* Stepper */}
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3">
        <StepBadge n={1} active={step === 1} done={!!savedOfferId} label="Dados da oferta" />
        <div className="h-px flex-1 bg-border" />
        <StepBadge n={2} active={step === 2} done={false} label="Produtos liberados" />
      </div>

      {step === 1 ? (
        <div className="space-y-6 rounded-2xl border border-border bg-surface p-6">
          <SectionTitle
            title="Dados da oferta"
            subtitle="Configure o gateway e os identificadores que o webhook usará para localizar esta oferta."
          />

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Gateway" required>
              <div className="flex h-10 items-center gap-2.5 rounded-md border border-border bg-muted/40 px-3">
                <img
                  src={perfectPayLogo}
                  alt="Perfect Pay"
                  className="h-6 w-6 rounded-md object-cover"
                />
                <span className="text-sm font-medium text-foreground">Perfect Pay</span>
              </div>
            </Field>

            <Field label="Modalidade de venda" required>
              <Select value={saleMode} onValueChange={(v) => setSaleMode(v as OfferSaleMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="one_time">Venda única</SelectItem>
                  <SelectItem value="monthly">Assinatura mensal</SelectItem>
                  <SelectItem value="yearly">Assinatura anual</SelectItem>
                  <SelectItem value="lifetime">Vitalício</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="Nome da entrega" required className="md:col-span-2">
              <Input
                value={offerName}
                onChange={(e) => setOfferName(e.target.value)}
                placeholder="Ex.: Pack Desenhos Bíblicos Mensal"
                maxLength={120}
              />
            </Field>

            <Field
              label="Código do produto ou plano"
              required
              className="md:col-span-2"
              hint="Aceita 1 ou vários códigos. Separe por vírgula, ponto e vírgula ou quebra de linha. Ex.: PLANO_KIDS_MENSAL, OFERTA_DESAFIO24"
            >
              <Textarea
                value={codesText}
                onChange={(e) => setCodesText(e.target.value)}
                placeholder="ABC123, PLANO_KIDS_MENSAL, 001;002;003"
                rows={3}
                className="font-mono text-sm"
              />
            </Field>

            <Field
              label="Token"
              className="md:col-span-2"
              hint="Token público do gateway, usado pelo webhook para validar a origem da venda."
            >
              <Input
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Token do gateway"
              />
            </Field>
          </div>

          <WebhookHint />

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
            <Button variant="ghost" onClick={onCancel}>
              Cancelar
            </Button>
            <Button
              onClick={() => saveStep1Mut.mutate()}
              disabled={saveStep1Mut.isPending}
              className="bg-gold text-gold-foreground hover:bg-gold/90"
            >
              {saveStep1Mut.isPending ? "Salvando…" : (
                <>
                  Salvar e continuar <ArrowRight className="ml-1 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-6 rounded-2xl border border-border bg-surface p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <SectionTitle
              title="Produtos liberados por esta oferta"
              subtitle={`Marque os produtos da área e defina o tempo de acesso. ${enabledCount} produto${enabledCount === 1 ? "" : "s"} selecionado${enabledCount === 1 ? "" : "s"}.`}
            />
            {productRows.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const allOn = productRows.every((r) => r.enabled);
                  setProductRows((prev) => prev.map((r) => ({ ...r, enabled: !allOn })));
                }}
              >
                {productRows.every((r) => r.enabled) ? "Desmarcar todos" : "Liberar todos"}
              </Button>
            )}
          </div>

          {productRows.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Nenhum produto cadastrado nesta área de membros ainda.
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-surface-elevated text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Liberar</th>
                    <th className="px-3 py-2 text-left">Produto</th>
                    <th className="px-3 py-2 text-left">Tipo</th>
                    <th className="px-3 py-2 text-left">Tempo de acesso</th>
                  </tr>
                </thead>
                <tbody>
                  {productRows.map((row) => {
                    const product = products.find((p) => p.id === row.product_id);
                    if (!product) return null;
                    return (
                      <tr key={row.product_id} className="border-t border-border">
                        <td className="px-3 py-2">
                          <Switch
                            checked={row.enabled}
                            onCheckedChange={(v) =>
                              setProductRows((prev) =>
                                prev.map((r) =>
                                  r.product_id === row.product_id ? { ...r, enabled: v } : r,
                                ),
                              )
                            }
                          />
                        </td>
                        <td className="px-3 py-2 font-medium">{product.title}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {product.product_type}
                        </td>
                        <td className="px-3 py-2">
                          <Select
                            disabled={!row.enabled}
                            value={durationKey(row.access_duration_type, row.access_duration_days)}
                            onValueChange={(v) => {
                              const opt = DURATION_OPTIONS.find(
                                (o) => durationKey(o.value, o.days) === v,
                              );
                              if (!opt) return;
                              setProductRows((prev) =>
                                prev.map((r) =>
                                  r.product_id === row.product_id
                                    ? {
                                        ...r,
                                        access_duration_type: opt.value,
                                        access_duration_days: opt.days,
                                      }
                                    : r,
                                ),
                              );
                            }}
                          >
                            <SelectTrigger className="h-8 w-[170px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {DURATION_OPTIONS.map((o) => (
                                <SelectItem
                                  key={durationKey(o.value, o.days)}
                                  value={durationKey(o.value, o.days)}
                                >
                                  {o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
            <Button variant="ghost" onClick={() => setStep(1)}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Voltar para dados
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onCancel}>
                Cancelar
              </Button>
              <Button
                onClick={() => saveStep2Mut.mutate()}
                disabled={saveStep2Mut.isPending}
                className="bg-gold text-gold-foreground hover:bg-gold/90"
              >
                <Save className="mr-1 h-4 w-4" />
                {saveStep2Mut.isPending ? "Salvando…" : "Salvar oferta"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StepBadge({
  n,
  active,
  done,
  label,
}: {
  n: number;
  active: boolean;
  done: boolean;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold",
          active
            ? "bg-gold text-gold-foreground"
            : done
              ? "bg-emerald-500/20 text-emerald-300"
              : "bg-muted text-muted-foreground",
        )}
      >
        {n}
      </div>
      <span
        className={cn(
          "text-sm font-medium",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
    </div>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function WebhookHint() {
  const [url, setUrl] = React.useState("");
  const [hasToken, setHasToken] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      setUrl(`${window.location.origin}/api/public/perfectpay/webhook`);
    }
    // Check if PerfectPay token is configured
    import("@/services/integrations").then(({ getIntegrationsSettings }) => {
      getIntegrationsSettings().then((s) => {
        setHasToken(s.perfectpay_token.trim().length > 0);
      });
    });
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("URL do webhook copiada");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  // Not configured — block + CTA
  if (hasToken === false) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4">
        <div className="mb-2 flex items-center gap-2">
          <Webhook className="h-4 w-4 text-destructive" />
          <h4 className="text-sm font-semibold text-destructive">
            Perfect Pay ainda não configurada
          </h4>
        </div>
        <p className="mb-3 text-xs text-destructive/80">
          Configure a integração antes de ativar esta oferta. Sem o token público,
          os webhooks não serão validados e os acessos não serão liberados.
        </p>
        <a
          href="/admin/webhooks"
          className="inline-flex items-center gap-1.5 rounded-md bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground transition-opacity hover:opacity-90"
        >
          Configurar Perfect Pay
        </a>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4">
      <div className="mb-2 flex items-center gap-2">
        <Webhook className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-sm font-semibold text-foreground">
          {hasToken ? "Integração Perfect Pay conectada" : "URL do webhook Perfect Pay"}
        </h4>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        {hasToken
          ? "Use a URL abaixo no painel da Perfect Pay para receber eventos desta oferta."
          : "Configure esta URL no painel da Perfect Pay. Os pagamentos confirmados serão processados automaticamente e liberarão os produtos vinculados a esta oferta."}{" "}
        Você também pode acessá-la em <span className="font-medium text-foreground">Webhooks</span> no menu lateral.
      </p>
      <div className="flex items-stretch gap-2">
        <code className="flex-1 truncate rounded-md border border-border bg-background px-3 py-2 font-mono text-xs text-foreground">
          {url || "carregando…"}
        </code>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={copy}
          disabled={!url}
        >
          <Copy className="mr-1.5 h-3.5 w-3.5" />
          Copiar webhook
        </Button>
      </div>
    </div>
  );
}
