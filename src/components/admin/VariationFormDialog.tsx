import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  createVariation,
  updateVariation,
  slugify,
  subdomainize,
  buildFullDomainPreview,
  type Variation,
  type VariationInput,
  type VariationStatus,
} from "@/services/variations";
import { VARIATIONS_QUERY_KEY } from "@/integrations/variations/variation-context";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variation: Variation | null;
};

const STATUSES: { value: VariationStatus; label: string }[] = [
  { value: "active", label: "Ativa" },
  { value: "draft", label: "Rascunho" },
  { value: "paused", label: "Pausada" },
];

/**
 * Pequeno cabeçalho de bloco visual usado dentro do modal.
 * Mantém a hierarquia: rótulo curto em caps + subtítulo descritivo opcional.
 */
function BlockHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="grid gap-0.5">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      {subtitle ? (
        <p className="text-xs text-muted-foreground/80">{subtitle}</p>
      ) : null}
    </div>
  );
}

export function VariationFormDialog({ open, onOpenChange, variation }: Props) {
  const queryClient = useQueryClient();
  const isEditing = !!variation;

  const [form, setForm] = React.useState<VariationInput>({
    title: "",
    slug: "",
    description: "",
    short_label: "",
    primary_type: "mixed",
    accent_color: "#D4AF37",
    primary_color: "",
    secondary_color: "",
    default_locale: "pt-BR",
    status: "draft",
    order_index: 0,
    subdomain_key: "",
    root_domain: "",
    domain_mode: "subdomain",
  });
  const [subdomainTouched, setSubdomainTouched] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setSubdomainTouched(!!variation?.subdomain_key);
      setForm({
        title: variation?.title ?? "",
        slug: variation?.slug ?? "",
        description: variation?.description ?? "",
        short_label: variation?.short_label ?? "",
        primary_type: variation?.primary_type ?? "mixed",
        accent_color: variation?.accent_color ?? "#D4AF37",
        primary_color: variation?.primary_color ?? "",
        secondary_color: variation?.secondary_color ?? "",
        default_locale: variation?.default_locale ?? "pt-BR",
        status: variation?.status ?? "draft",
        order_index: variation?.order_index ?? 0,
        subdomain_key: variation?.subdomain_key ?? "",
        root_domain: variation?.root_domain ?? "",
        domain_mode: variation?.domain_mode ?? "subdomain",
      });
    }
  }, [open, variation]);

  const mutation = useMutation({
    mutationFn: async (input: VariationInput) => {
      if (variation) return updateVariation(variation.id, input);
      return createVariation(input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: VARIATIONS_QUERY_KEY });
      toast.success(isEditing ? "Área atualizada" : "Área criada");
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Erro ao salvar área";
      toast.error(message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error("Informe um título");
      return;
    }
    // O slug deixa de ser editável visualmente: derivamos sempre do título
    // ao criar. Em edição, mantemos o slug existente para não quebrar URLs.
    const slug = (variation?.slug ?? slugify(form.title)).trim();
    if (!slug) {
      toast.error("Não foi possível gerar um identificador a partir do título");
      return;
    }
    const subdomain = subdomainize(form.subdomain_key || form.title);
    if (!subdomain) {
      toast.error("Informe um identificador de subdomínio válido");
      return;
    }
    mutation.mutate({ ...form, slug, subdomain_key: subdomain });
  };

  const handleTitleChange = (value: string) => {
    setForm((f) => ({
      ...f,
      title: value,
      // Slug interno gerado em silêncio (só usado em edição se o usuário ainda
      // não tem um slug salvo). Em criação ele será derivado no submit.
      slug: variation?.slug ?? slugify(value),
      subdomain_key: subdomainTouched ? f.subdomain_key : subdomainize(value),
    }));
  };

  const fullPreview = buildFullDomainPreview(
    form.subdomain_key ?? "",
    form.root_domain ?? "",
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar área de membros" : "Nova área de membros"}
          </DialogTitle>
          <DialogDescription>
            Cada área tem seu próprio catálogo, branding, login e regras de
            acesso.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-7">
          {/* BLOCO 1 — Identidade da área */}
          <section className="grid gap-4">
            <BlockHeader
              title="Identidade da área"
              subtitle="Como essa área vai se apresentar para os usuários."
            />
            <div className="grid gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="title">Título *</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="Ex.: Reino das Cores Kids"
                  autoFocus
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="short_label">Rótulo curto</Label>
                <Input
                  id="short_label"
                  value={form.short_label ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, short_label: e.target.value }))
                  }
                  placeholder="Ex.: Kids"
                />
                <p className="text-[10px] text-muted-foreground">
                  Versão compacta usada em badges, chips e cards menores.
                </p>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  rows={3}
                  value={form.description ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  placeholder="Descreva para quem é essa área e o que ela entrega"
                />
              </div>
            </div>
          </section>

          {/* BLOCO 2 — Endereço da área */}
          <section className="grid gap-4 rounded-xl border border-border bg-muted/30 p-4">
            <BlockHeader
              title="Endereço da área"
              subtitle="Cada área pode ter seu próprio subdomínio e será preparada para uso em domínio real no deploy final."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="subdomain_key" className="text-xs">
                  Identificador do subdomínio *
                </Label>
                <Input
                  id="subdomain_key"
                  value={form.subdomain_key ?? ""}
                  onChange={(e) => {
                    setSubdomainTouched(true);
                    setForm((f) => ({
                      ...f,
                      subdomain_key: subdomainize(e.target.value),
                    }));
                  }}
                  placeholder="Ex.: desafio24dias"
                  className="font-mono text-sm"
                />
                <p className="text-[10px] text-muted-foreground">
                  Use apenas letras e números. Esse identificador será usado
                  para montar a URL da área.
                </p>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="root_domain" className="text-xs">
                  Domínio raiz (opcional agora)
                </Label>
                <Input
                  id="root_domain"
                  value={form.root_domain ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, root_domain: e.target.value.trim() }))
                  }
                  placeholder="Ex.: seudominio.com"
                  className="font-mono text-sm"
                />
                <p className="text-[10px] text-muted-foreground">
                  Esse domínio poderá ser conectado depois no deploy final pela
                  Vercel.
                </p>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">URL final (preview)</Label>
              <div className="flex items-center gap-2 rounded-md border border-dashed border-primary/30 bg-background/60 px-3 py-2.5 font-mono text-xs text-foreground">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-primary/70">
                  Preview
                </span>
                <span className="truncate">https://{fullPreview}</span>
              </div>
            </div>
          </section>

          {/* BLOCO 3 — Configurações da área */}
          <section className="grid gap-4">
            <BlockHeader
              title="Configurações da área"
              subtitle="Comportamento básico e idioma padrão dessa área."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, status: v as VariationStatus }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="default_locale">Idioma padrão</Label>
                <Select
                  value={form.default_locale ?? "pt-BR"}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, default_locale: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
                    <SelectItem value="en-US">Inglês (EUA)</SelectItem>
                    <SelectItem value="es-ES">Espanhol</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {/* BLOCO 4 — Identidade visual rápida */}
          <section className="grid gap-4">
            <BlockHeader
              title="Identidade visual rápida"
              subtitle="Branding completo é configurado depois nas telas de Branding e Login."
            />
            <div className="grid gap-1.5 sm:max-w-sm">
              <Label htmlFor="accent_color">Cor de destaque</Label>
              <div className="flex gap-2">
                <Input
                  id="accent_color"
                  type="color"
                  className="h-10 w-14 cursor-pointer p-1"
                  value={form.accent_color || "#D4AF37"}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, accent_color: e.target.value }))
                  }
                />
                <Input
                  value={form.accent_color ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, accent_color: e.target.value }))
                  }
                  placeholder="#D4AF37"
                  className="font-mono text-sm"
                />
              </div>
            </div>
          </section>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isEditing ? "Salvar alterações" : "Criar área"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
