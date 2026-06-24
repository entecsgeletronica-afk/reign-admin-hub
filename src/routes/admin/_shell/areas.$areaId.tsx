import * as React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import {
  ArrowLeft,
  Save,
  Settings,
  Palette,
  Paintbrush,
  Languages as LanguagesIcon,
  LogIn as LogInIcon,
  Package,
  Lock,
  Loader2,
  ExternalLink,
  Upload,
  Trash2,
  Image as ImageIcon,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useVariations,
  VARIATIONS_QUERY_KEY,
} from "@/integrations/variations/variation-context";
import {
  updateVariation,
  updateLoginSettings,
  buildFullDomainPreview,
  subdomainize,
  type Variation,
  type VariationStatus,
  type VariationPrimaryType,
  type LoginSettingsInput,
  type LoginLayoutMode,
  type LoginBackgroundMode,
} from "@/services/variations";
import { supabase } from "@/integrations/supabase/client";
import {
  SUPPORTED_LOCALES,
  LOCALE_LABELS,
  type Locale,
} from "@/integrations/i18n/dictionary";
import { cn } from "@/lib/utils";
import { useViewAsMode, appendViewAsMode } from "@/hooks/use-view-as-mode";

const TAB_VALUES = [
  "geral",
  "branding",
  "cores",
  "idioma",
  "login",
  "produtos",
] as const;
type TabValue = (typeof TAB_VALUES)[number];

const searchSchema = z.object({
  tab: z.enum(TAB_VALUES).optional(),
});

export const Route = createFileRoute("/admin/_shell/areas/$areaId")({
  validateSearch: searchSchema,
  component: AreaEditPage,
});

function AreaEditPage() {
  const { areaId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { variations, isLoading, setActive } = useVariations();
  const [, setViewAsMode] = useViewAsMode();

  const variation = React.useMemo(
    () => variations.find((v) => v.id === areaId) ?? null,
    [variations, areaId],
  );

  const tab: TabValue = search.tab ?? "geral";
  const setTab = (next: TabValue) => {
    navigate({
      to: "/admin/areas/$areaId",
      params: { areaId },
      search: { tab: next },
      replace: true,
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Carregando área…
      </div>
    );
  }

  if (!variation) {
    return (
      <div className="space-y-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center">
        <h2 className="text-lg font-semibold">Área não encontrada</h2>
        <p className="text-sm text-muted-foreground">
          A área solicitada não existe ou foi removida.
        </p>
        <Button asChild variant="outline">
          <Link to="/admin/areas">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para Áreas
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Header
        variation={variation}
        onPreviewAdmin={() => {
          setActive(variation.id);
          setViewAsMode("admin");
          window.open(
            appendViewAsMode(`/?variation=${encodeURIComponent(variation.id)}`, "admin"),
            "_blank",
            "noopener,noreferrer",
          );
        }}
        onPreviewUser={() => {
          setActive(variation.id);
          setViewAsMode("user");
          window.open(
            appendViewAsMode(`/?variation=${encodeURIComponent(variation.id)}`, "user"),
            "_blank",
            "noopener,noreferrer",
          );
        }}
      />

      <Tabs value={tab} onChange={setTab} />

      <div className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
        {tab === "geral" && <GeralTab variation={variation} />}
        {tab === "branding" && <BrandingTab variation={variation} />}
        {tab === "cores" && <CoresTab variation={variation} />}
        {tab === "idioma" && <IdiomaTab variation={variation} />}
        {tab === "login" && <LoginTab variation={variation} />}
        {tab === "produtos" && <ProdutosTab variation={variation} />}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Header                                                                     */
/* -------------------------------------------------------------------------- */

const STATUS_TONE: Record<VariationStatus, string> = {
  active: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  draft: "bg-muted text-muted-foreground",
  paused: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
};
const STATUS_LABEL: Record<VariationStatus, string> = {
  active: "Ativa",
  draft: "Rascunho",
  paused: "Pausada",
};

function Header({
  variation,
  onPreviewAdmin,
  onPreviewUser,
}: {
  variation: Variation;
  onPreviewAdmin: () => void;
  onPreviewUser: () => void;
}) {
  return (
    <header className="flex flex-col gap-4 rounded-3xl border border-border bg-gradient-to-br from-card to-surface-elevated p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="flex items-start gap-3">
        <Button asChild variant="ghost" size="icon" className="h-9 w-9 shrink-0">
          <Link to="/admin/areas">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-gold">
            Editar área de membros
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            <h1 className="truncate text-xl font-bold text-foreground sm:text-2xl">
              {variation.title}
            </h1>
            <Badge
              variant="secondary"
              className={cn("border-0 text-[10px]", STATUS_TONE[variation.status])}
            >
              {STATUS_LABEL[variation.status]}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Configure identidade, login, idioma, produtos e regras de acesso desta área.
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button variant="outline" size="sm" onClick={onPreviewAdmin}>
          <ShieldCheck className="mr-2 h-4 w-4" />
          Ver como admin
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="border-gold/40 text-gold hover:bg-gold/10 hover:text-gold"
          onClick={onPreviewUser}
        >
          <UserRound className="mr-2 h-4 w-4" />
          Ver como aluno
        </Button>
      </div>
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/*  Tabs                                                                       */
/* -------------------------------------------------------------------------- */

const TAB_ITEMS: { value: TabValue; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "geral", label: "Geral", icon: Settings },
  { value: "branding", label: "Branding", icon: Palette },
  { value: "cores", label: "Cores", icon: Paintbrush },
  { value: "idioma", label: "Idioma", icon: LanguagesIcon },
  { value: "login", label: "Login", icon: LogInIcon },
  { value: "produtos", label: "Produtos", icon: Package },
];

function Tabs({ value, onChange }: { value: TabValue; onChange: (v: TabValue) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5 rounded-2xl border border-border bg-surface-elevated p-1.5">
      {TAB_ITEMS.map((t) => {
        const active = value === t.value;
        const Icon = t.icon;
        return (
          <button
            key={t.value}
            type="button"
            onClick={() => onChange(t.value)}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-all",
              active
                ? "bg-gold text-gold-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function useVariationMutation(variation: Variation) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: LoginSettingsInput) => {
      return updateLoginSettings(variation.id, input);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: VARIATIONS_QUERY_KEY });
      toast.success("Alterações salvas");
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    },
  });
}

function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-4 grid gap-0.5">
      <h2 className="text-base font-semibold text-foreground">{children}</h2>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-rows-[auto_auto_1fr] gap-1.5", className)}>
      <Label className="text-xs font-medium text-foreground">{label}</Label>
      <div>{children}</div>
      {hint ? (
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      ) : (
        <span aria-hidden />
      )}
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  const safe = value || "#000000";
  return (
    <Field label={label} hint={hint}>
      <div className="flex items-center gap-2 rounded-lg border border-border bg-background p-1.5">
        <label className="relative inline-block h-8 w-8 shrink-0 cursor-pointer overflow-hidden rounded-md ring-1 ring-border">
          <span className="block h-full w-full" style={{ background: safe }} />
          <input
            type="color"
            value={safe}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          className="h-8 border-0 bg-transparent px-1 font-mono text-xs focus-visible:ring-0"
        />
      </div>
    </Field>
  );
}

async function uploadAreaAsset(
  file: File,
  variationId: string,
  prefix: "logo" | "favicon" | "login-image",
): Promise<string> {
  const ext = file.name.split(".").pop() ?? "png";
  const path = `area/${variationId}/${prefix}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("branding").upload(path, file, {
    cacheControl: "3600",
    upsert: true,
    contentType: file.type,
  });
  if (error) throw error;
  return supabase.storage.from("branding").getPublicUrl(path).data.publicUrl;
}

function ImageUploadField({
  label,
  hint,
  value,
  onChange,
  variationId,
  prefix,
  accept = "image/png,image/svg+xml,image/jpeg,image/webp",
}: {
  label: string;
  hint?: string;
  value: string | null;
  onChange: (v: string | null) => void;
  variationId: string;
  prefix: "logo" | "favicon" | "login-image";
  accept?: string;
}) {
  const inputId = React.useId();
  const [uploading, setUploading] = React.useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Arquivo maior que 5 MB");
      return;
    }
    setUploading(true);
    try {
      const url = await uploadAreaAsset(file, variationId, prefix);
      onChange(url);
      toast.success("Imagem enviada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro no upload");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Field label={label} hint={hint}>
      <div className="flex items-center gap-2">
        {value ? (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-elevated">
            <img src={value} alt="" className="h-full w-full object-contain" />
          </div>
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-dashed border-border bg-surface-elevated text-muted-foreground">
            <ImageIcon className="h-4 w-4" />
          </div>
        )}
        <label
          htmlFor={inputId}
          className={cn(
            "inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-border bg-surface-elevated px-3 py-2 text-xs font-medium transition-colors hover:border-gold/50 hover:text-gold",
            uploading && "pointer-events-none opacity-60",
          )}
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          {value ? "Trocar imagem" : "Enviar imagem"}
        </label>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
            title="Remover"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
        <input
          id={inputId}
          type="file"
          accept={accept}
          className="hidden"
          disabled={uploading}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>
      <Input
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        placeholder="ou cole uma URL https://…"
        className="mt-1.5 h-8 font-mono text-[11px]"
      />
    </Field>
  );
}

/* -------------------------------------------------------------------------- */
/*  Tab: Geral                                                                 */
/* -------------------------------------------------------------------------- */

const PRIMARY_TYPES: { value: VariationPrimaryType; label: string }[] = [
  { value: "drawing", label: "Desenhos" },
  { value: "course", label: "Cursos" },
  { value: "download", label: "Arquivos / Downloads" },
  { value: "mixed", label: "Misto" },
];

const STATUSES: { value: VariationStatus; label: string }[] = [
  { value: "draft", label: "Rascunho" },
  { value: "active", label: "Ativa" },
  { value: "paused", label: "Pausada" },
];

function GeralTab({ variation }: { variation: Variation }) {
  const qc = useQueryClient();
  const [title, setTitle] = React.useState(variation.title);
  const [description, setDescription] = React.useState(variation.description ?? "");
  const [shortLabel, setShortLabel] = React.useState(variation.short_label ?? "");
  const [subdomain, setSubdomain] = React.useState(variation.subdomain_key ?? "");
  const [rootDomain, setRootDomain] = React.useState(variation.root_domain ?? "");
  const [primaryType, setPrimaryType] = React.useState(variation.primary_type);
  const [status, setStatus] = React.useState(variation.status);
  const [isPrimary, setIsPrimary] = React.useState(variation.is_primary);

  const mutation = useMutation({
    mutationFn: async () => {
      return updateVariation(variation.id, {
        title,
        slug: variation.slug,
        description: description || null,
        short_label: shortLabel || null,
        subdomain_key: subdomain || null,
        root_domain: rootDomain || null,
        primary_type: primaryType,
        status,
        is_primary: isPrimary,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: VARIATIONS_QUERY_KEY });
      toast.success("Geral atualizado");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro ao salvar"),
  });

  const fullPreview = buildFullDomainPreview(subdomain, rootDomain);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
      className="space-y-5"
    >
      <SectionTitle hint="Informações básicas que identificam essa área no painel e na URL.">
        Geral
      </SectionTitle>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome da área">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Rótulo curto" hint="Versão compacta para badges e chips.">
          <Input
            value={shortLabel}
            onChange={(e) => setShortLabel(e.target.value)}
            placeholder="Ex.: Kids"
          />
        </Field>
      </div>

      <Field label="Descrição">
        <Textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descreva para quem é essa área e o que ela entrega"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tipo da área">
          <Select
            value={primaryType}
            onValueChange={(v) => setPrimaryType(v as VariationPrimaryType)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIMARY_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Status">
          <Select value={status} onValueChange={(v) => setStatus(v as VariationStatus)}>
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
        </Field>
      </div>

      {/* Área principal */}
      <label
        className={cn(
          "flex cursor-pointer items-start justify-between gap-4 rounded-2xl border-2 p-4 transition-all",
          isPrimary
            ? "border-gold bg-gold/5"
            : "border-border bg-surface-elevated hover:border-border/80",
        )}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">
              Área principal
            </span>
            {variation.is_primary && (
              <Badge variant="secondary" className="border-0 bg-gold/15 text-[10px] text-gold">
                Atual
              </Badge>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            A área principal é usada como padrão quando o sistema redireciona sem contexto.
            Apenas uma área pode ser principal por conta.
          </p>
        </div>
        <input
          type="checkbox"
          className="mt-1 h-5 w-5 cursor-pointer accent-gold"
          checked={isPrimary}
          onChange={(e) => setIsPrimary(e.target.checked)}
        />
      </label>

      <div className="rounded-2xl border border-border bg-surface-elevated p-4">
        <SectionTitle hint="Cada área terá seu próprio subdomínio quando o domínio raiz estiver conectado.">
          Endereço da área
        </SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Subdomínio" hint="Apenas letras e números.">
            <Input
              value={subdomain}
              onChange={(e) => setSubdomain(subdomainize(e.target.value))}
              placeholder="reinodascoreskids"
              className="font-mono"
            />
          </Field>
          <Field
            label="Domínio raiz (global)"
            hint="Por enquanto, todas as áreas de membros usam o mesmo domínio raiz. Em breve será possível configurar um domínio diferente por área."
          >
            <Input
              value={rootDomain}
              readOnly
              disabled
              placeholder="seudominio.com"
              className="cursor-not-allowed font-mono opacity-70"
            />
          </Field>
        </div>
        <div className="mt-3 rounded-lg border border-dashed border-gold/30 bg-background/50 px-3 py-2.5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-gold/70">
            URL final
          </div>
          <div className="mt-0.5 truncate font-mono text-xs text-foreground">
            https://{fullPreview}
          </div>
        </div>
      </div>

      <SaveBar
        loading={mutation.isPending}
        onSave={() => mutation.mutate()}
        label="Salvar geral"
      />
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/*  Tab: Branding                                                              */
/* -------------------------------------------------------------------------- */

function BrandingTab({ variation }: { variation: Variation }) {
  const mutation = useVariationMutation(variation);

  const [appName, setAppName] = React.useState(variation.app_name ?? variation.title);
  const [logoAlt, setLogoAlt] = React.useState(
    variation.logo_alt ?? variation.short_label ?? variation.title,
  );
  const [logoUrl, setLogoUrl] = React.useState<string | null>(variation.logo_url);
  const [faviconUrl, setFaviconUrl] = React.useState<string | null>(variation.favicon_url);
  const [supportEmail, setSupportEmail] = React.useState(variation.support_email ?? "");

  const onSave = async () => {
    await mutation.mutateAsync({
      logo_url: logoUrl,
      favicon_url: faviconUrl,
      app_name: appName || null,
      logo_alt: logoAlt || null,
      support_email: supportEmail || null,
    });
  };

  const loading = mutation.isPending;

  return (
    <div className="space-y-5">
      <SectionTitle hint="Identidade visual exclusiva desta área. Não afeta outras áreas.">
        Branding
      </SectionTitle>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <ImageUploadField
            label="Logo principal"
            hint="PNG transparente quadrado, mín. 256×256. Para retina, prefira 512×512."
            value={logoUrl}
            onChange={setLogoUrl}
            variationId={variation.id}
            prefix="logo"
          />

          <div className="grid items-start gap-4 sm:grid-cols-2">
            <Field label="Nome do app" hint="Aparece no header, login e e-mails desta área.">
              <Input
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                placeholder="Digite um nome"
              />
            </Field>
            <Field
              label="Texto alternativo da logo"
              hint="Lido por leitores de tela quando a logo aparecer."
            >
              <Input
                value={logoAlt}
                onChange={(e) => setLogoAlt(e.target.value)}
                placeholder="Digite um nome"
              />
            </Field>
          </div>

          <Field label="E-mail de suporte" hint="Será exibido apenas nesta área.">
            <Input
              type="email"
              value={supportEmail}
              onChange={(e) => setSupportEmail(e.target.value)}
              placeholder="suporte@suaarea.com"
            />
          </Field>

          <ImageUploadField
            label="Favicon (opcional)"
            hint="Ícone exibido na aba do navegador desta área."
            value={faviconUrl}
            onChange={setFaviconUrl}
            variationId={variation.id}
            prefix="favicon"
            accept="image/png,image/svg+xml,image/x-icon,image/webp"
          />
        </div>

        {/* Preview */}
        <aside className="space-y-3">
          <div className="rounded-2xl border border-border bg-surface-elevated p-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold">
              Pré-visualização
            </div>
            <div className="mt-1 text-sm font-semibold text-foreground">
              Como vai aparecer
            </div>
            <div className="mt-4 flex h-40 flex-col items-center justify-center gap-2 rounded-xl border border-border bg-background">
              {logoUrl ? (
                <img src={logoUrl} alt={logoAlt} className="h-16 w-16 object-contain" />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-surface-elevated text-muted-foreground">
                  <ImageIcon className="h-6 w-6" />
                </div>
              )}
              <div className="text-sm font-semibold text-foreground">{appName}</div>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-surface-elevated p-3">
            <div className="flex items-center gap-3">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={logoAlt}
                  className="h-9 w-9 rounded-full bg-background object-contain"
                />
              ) : (
                <div className="h-9 w-9 rounded-full bg-background" />
              )}
              <div>
                <div className="text-sm font-semibold text-foreground">{appName}</div>
                <div className="text-[11px] text-muted-foreground">Cabeçalho do app</div>
              </div>
            </div>
          </div>
          {supportEmail && (
            <div className="rounded-2xl border border-border bg-surface-elevated p-3">
              <div className="text-[10px] uppercase text-muted-foreground">Suporte</div>
              <div className="mt-0.5 truncate font-mono text-xs text-foreground">
                {supportEmail}
              </div>
            </div>
          )}
        </aside>
      </div>

      <SaveBar loading={loading} onSave={onSave} label="Salvar branding" />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Tab: Cores                                                                 */
/* -------------------------------------------------------------------------- */

function CoresTab({ variation }: { variation: Variation }) {
  const mutation = useVariationMutation(variation);

  const [primary, setPrimary] = React.useState(variation.primary_color ?? "#D4AF37");
  const [accent, setAccent] = React.useState(variation.accent_color ?? "#D4AF37");
  const [background, setBackground] = React.useState(
    variation.background_color ?? "#0F172A",
  );
  const [surface, setSurface] = React.useState(variation.surface_color ?? "#1E293B");
  const [card, setCard] = React.useState(variation.card_color ?? "#1E293B");
  const [text, setText] = React.useState(variation.text_color ?? "#F8FAFC");
  const [mutedText, setMutedText] = React.useState(
    variation.muted_text_color ?? "#94A3B8",
  );
  const [sidebar, setSidebar] = React.useState(variation.sidebar_color ?? "#0F172A");
  const [button, setButton] = React.useState(variation.button_color ?? "#D4AF37");
  const [buttonText, setButtonText] = React.useState(
    variation.button_text_color ?? "#0F172A",
  );
  const [themeMode, setThemeMode] = React.useState(variation.theme_mode);

  const onSave = () => {
    mutation.mutate({
      primary_color: primary,
      accent_color: accent,
      background_color: background,
      surface_color: surface,
      card_color: card,
      text_color: text,
      muted_text_color: mutedText,
      sidebar_color: sidebar,
      button_color: button,
      button_text_color: buttonText,
      theme_mode: themeMode,
    });
  };

  return (
    <div className="space-y-5">
      <SectionTitle hint="Paleta exclusiva desta área. Atualiza em tempo real no preview.">
        Cores
      </SectionTitle>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tema padrão" className="sm:col-span-2">
            <Select value={themeMode} onValueChange={(v) => setThemeMode(v as typeof themeMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Claro</SelectItem>
                <SelectItem value="dark">Escuro</SelectItem>
                <SelectItem value="auto">Automático (segue o sistema)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <ColorField label="Cor primária" value={primary} onChange={setPrimary} hint="CTAs e destaques" />
          <ColorField label="Cor de destaque" value={accent} onChange={setAccent} hint="Badges e ícones" />
          <ColorField label="Cor dos botões" value={button} onChange={setButton} />
          <ColorField label="Texto do botão" value={buttonText} onChange={setButtonText} />
          <ColorField label="Fundo geral" value={background} onChange={setBackground} />
          <ColorField label="Cards / superfície" value={card} onChange={setCard} />
          <ColorField label="Sidebar" value={sidebar} onChange={setSidebar} />
          <ColorField label="Texto principal" value={text} onChange={setText} />
          <ColorField label="Texto secundário" value={mutedText} onChange={setMutedText} hint="Descrições e textos auxiliares" />
          <ColorField label="Superfície elevada" value={surface} onChange={setSurface} />
        </div>

        {/* Preview */}
        <div
          className="overflow-hidden rounded-2xl border border-border"
          style={{ background }}
        >
          <div className="grid h-full grid-cols-[140px_1fr]">
            <div className="flex flex-col gap-2 p-3" style={{ background: sidebar }}>
              <div
                className="text-[10px] font-bold uppercase tracking-wider"
                style={{ color: primary }}
              >
                Admin
              </div>
              <div className="text-sm font-bold" style={{ color: text }}>
                {variation.title}
              </div>
              <div className="mt-2 flex flex-col gap-1">
                <div
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold"
                  style={{ background: primary, color: buttonText }}
                >
                  Dashboard
                </div>
                <div className="rounded-lg px-3 py-1.5 text-xs" style={{ color: text, opacity: 0.7 }}>
                  Catálogo
                </div>
              </div>
            </div>
            <div className="space-y-3 p-4">
              <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: primary }}>
                Pré-visualização
              </div>
              <div className="text-base font-bold" style={{ color: text }}>
                Início
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="rounded-xl p-3" style={{ background: card }}>
                    <div className="text-[10px] uppercase" style={{ color: text, opacity: 0.6 }}>
                      Card {i}
                    </div>
                    <div className="text-base font-bold" style={{ color: text }}>
                      Conteúdo
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="rounded-xl px-4 py-2 text-xs font-semibold"
                style={{ background: button, color: buttonText }}
              >
                Ação primária
              </button>
              <span
                className="ml-2 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
                style={{ background: accent, color: buttonText }}
              >
                Badge
              </span>
            </div>
          </div>
        </div>
      </div>

      <SaveBar loading={mutation.isPending} onSave={onSave} label="Salvar cores" />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Tab: Idioma                                                                */
/* -------------------------------------------------------------------------- */

function IdiomaTab({ variation }: { variation: Variation }) {
  const mutation = useVariationMutation(variation);
  const [defaultLocale, setDefaultLocale] = React.useState<Locale>(
    (SUPPORTED_LOCALES as readonly string[]).includes(variation.default_locale)
      ? (variation.default_locale as Locale)
      : "pt-BR",
  );
  const [enabled, setEnabled] = React.useState<Locale[]>(() => {
    const en = (variation.enabled_languages ?? []).filter((l): l is Locale =>
      (SUPPORTED_LOCALES as readonly string[]).includes(l),
    );
    return en.length > 0 ? en : [...SUPPORTED_LOCALES];
  });
  const [dateFormat, setDateFormat] = React.useState(variation.date_format);
  const [microcopy, setMicrocopy] = React.useState(variation.microcopy_json ?? {});

  const setMc = (k: keyof typeof microcopy, v: string) =>
    setMicrocopy((m) => ({ ...m, [k]: v || undefined }));

  const toggle = (lang: Locale) => {
    if (lang === defaultLocale) {
      toast.info("Não é possível desativar o idioma padrão");
      return;
    }
    setEnabled((prev) => {
      const next = prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang];
      return next.length === 0 ? prev : next;
    });
  };

  const onSave = () => {
    const finalEnabled = enabled.includes(defaultLocale) ? enabled : [...enabled, defaultLocale];
    mutation.mutate({
      default_locale: defaultLocale,
      enabled_languages: finalEnabled,
      date_format: dateFormat,
      microcopy_json: microcopy,
    });
  };

  return (
    <div className="space-y-5">
      <SectionTitle hint="Idiomas, formato de data e microcopies exclusivos desta área de membros.">
        Idioma
      </SectionTitle>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Idioma principal da área">
          <Select
            value={defaultLocale}
            onValueChange={(v) => {
              const next = v as Locale;
              setDefaultLocale(next);
              setEnabled((prev) => (prev.includes(next) ? prev : [...prev, next]));
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_LOCALES.map((l) => (
                <SelectItem key={l} value={l}>
                  {LOCALE_LABELS[l]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Formato de data">
          <Select value={dateFormat} onValueChange={(v) => setDateFormat(v as typeof dateFormat)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DD/MM/YYYY">DD/MM/AAAA</SelectItem>
              <SelectItem value="MM/DD/YYYY">MM/DD/AAAA</SelectItem>
              <SelectItem value="YYYY-MM-DD">AAAA-MM-DD</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div>
        <Label className="text-xs font-medium text-foreground">Idiomas habilitados</Label>
        <p className="text-[11px] text-muted-foreground">
          Os usuários desta área poderão escolher entre os idiomas marcados.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {SUPPORTED_LOCALES.map((lang) => {
            const active = enabled.includes(lang);
            const isDefault = lang === defaultLocale;
            return (
              <button
                key={lang}
                type="button"
                onClick={() => toggle(lang)}
                aria-pressed={active}
                className={cn(
                  "flex h-12 items-center justify-between rounded-xl border-2 px-3 text-sm font-medium transition-all",
                  active
                    ? "border-gold bg-gold/10 text-foreground"
                    : "border-border bg-muted/30 text-muted-foreground hover:border-border/80",
                )}
              >
                <span className="flex items-center gap-2">
                  {LOCALE_LABELS[lang]}
                  {isDefault && (
                    <span className="rounded-full bg-gold/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-gold">
                      Padrão
                    </span>
                  )}
                </span>
                {active && <span className="text-gold">●</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface-elevated p-4">
        <SectionTitle hint="Personalize os textos principais que aparecem para o aluno desta área.">
          Textos do sistema
        </SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Texto de boas-vindas">
            <Input
              value={microcopy.welcome ?? ""}
              onChange={(e) => setMc("welcome", e.target.value)}
              placeholder="Bem-vindo ao seu cantinho"
            />
          </Field>
          <Field label="Texto do botão Continuar">
            <Input
              value={microcopy.continue ?? ""}
              onChange={(e) => setMc("continue", e.target.value)}
              placeholder="Continuar"
            />
          </Field>
          <Field label="Texto de produto bloqueado">
            <Input
              value={microcopy.locked ?? ""}
              onChange={(e) => setMc("locked", e.target.value)}
              placeholder="Disponível em outro plano"
            />
          </Field>
          <Field label="Texto de conclusão">
            <Input
              value={microcopy.completion ?? ""}
              onChange={(e) => setMc("completion", e.target.value)}
              placeholder="Você concluiu!"
            />
          </Field>
          <Field label="Texto de parabéns">
            <Input
              value={microcopy.congrats ?? ""}
              onChange={(e) => setMc("congrats", e.target.value)}
              placeholder="Parabéns!"
            />
          </Field>
          <Field label="Texto do botão Entrar">
            <Input
              value={microcopy.signin_button ?? ""}
              onChange={(e) => setMc("signin_button", e.target.value)}
              placeholder="Entrar"
            />
          </Field>
        </div>
        <Field label="Texto de suporte" className="mt-3">
          <Input
            value={microcopy.support ?? ""}
            onChange={(e) => setMc("support", e.target.value)}
            placeholder="Precisa de ajuda? Fale com a gente."
          />
        </Field>
      </div>

      <SaveBar loading={mutation.isPending} onSave={onSave} label="Salvar idioma" />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Tab: Login                                                                 */
/* -------------------------------------------------------------------------- */

const LAYOUTS: { value: LoginLayoutMode; label: string }[] = [
  { value: "split-right", label: "Imagem à direita" },
  { value: "split-left", label: "Imagem à esquerda" },
  { value: "top", label: "Imagem no topo" },
  { value: "centered", label: "Centralizado" },
];
const BACKGROUNDS: { value: LoginBackgroundMode; label: string }[] = [
  { value: "solid", label: "Cor sólida" },
  { value: "gradient", label: "Gradiente" },
  { value: "image", label: "Imagem de fundo" },
];

function LoginTab({ variation }: { variation: Variation }) {
  const mutation = useVariationMutation(variation);
  const [form, setForm] = React.useState<LoginSettingsInput>({
    login_title: variation.login_title ?? `Bem-vindo ao ${variation.title}`,
    login_subtitle: variation.login_subtitle ?? "Entre para acessar seu conteúdo",
    login_email_placeholder: variation.login_email_placeholder ?? "Seu email",
    login_password_placeholder: variation.login_password_placeholder ?? "Sua senha",
    login_submit_label: variation.login_submit_label ?? "Entrar",
    login_helper_text: variation.login_helper_text ?? "Esqueci minha senha",
    login_footer_text: variation.login_footer_text ?? "",
    login_image_url: variation.login_image_url ?? "",
    login_layout_mode: variation.login_layout_mode,
    login_background_mode: variation.login_background_mode,
  });

  const set = <K extends keyof LoginSettingsInput>(k: K, v: LoginSettingsInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-5">
      <SectionTitle hint="Personalize a tela de login que os alunos desta área verão.">
        Login
      </SectionTitle>



      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Título da tela de login">
          <Input
            value={form.login_title ?? ""}
            onChange={(e) => set("login_title", e.target.value)}
            placeholder="Bem-vindo ao Reino das Cores"
          />
        </Field>
        <Field label="Subtítulo">
          <Input
            value={form.login_subtitle ?? ""}
            onChange={(e) => set("login_subtitle", e.target.value)}
          />
        </Field>
        <Field label="Placeholder do email">
          <Input
            value={form.login_email_placeholder ?? ""}
            onChange={(e) => set("login_email_placeholder", e.target.value)}
          />
        </Field>
        <Field label="Placeholder da senha">
          <Input
            value={form.login_password_placeholder ?? ""}
            onChange={(e) => set("login_password_placeholder", e.target.value)}
          />
        </Field>
        <Field label="Texto do botão">
          <Input
            value={form.login_submit_label ?? ""}
            onChange={(e) => set("login_submit_label", e.target.value)}
          />
        </Field>
        <Field label="Texto de ajuda">
          <Input
            value={form.login_helper_text ?? ""}
            onChange={(e) => set("login_helper_text", e.target.value)}
          />
        </Field>
      </div>

      <Field label="Texto do rodapé (opcional)">
        <Textarea
          rows={2}
          value={form.login_footer_text ?? ""}
          onChange={(e) => set("login_footer_text", e.target.value)}
          placeholder="Ex.: Suporte: contato@suaarea.com"
        />
      </Field>

      <ImageUploadField
        label="Imagem da tela de login"
        hint="Ilustração ao lado do formulário. Use formato 4:3 ou 16:9 em alta resolução."
        value={form.login_image_url ?? null}
        onChange={(v) => set("login_image_url", v)}
        variationId={variation.id}
        prefix="login-image"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Layout">
          <Select
            value={form.login_layout_mode}
            onValueChange={(v) => set("login_layout_mode", v as LoginLayoutMode)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LAYOUTS.map((l) => (
                <SelectItem key={l.value} value={l.value}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Modo de fundo">
          <Select
            value={form.login_background_mode}
            onValueChange={(v) => set("login_background_mode", v as LoginBackgroundMode)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BACKGROUNDS.map((b) => (
                <SelectItem key={b.value} value={b.value}>
                  {b.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <SaveBar
        loading={mutation.isPending}
        onSave={() => mutation.mutate(form)}
        label="Salvar login"
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Tab: Produtos (read-only com link)                                         */
/* -------------------------------------------------------------------------- */

function ProdutosTab({ variation }: { variation: Variation }) {
  return (
    <div className="space-y-5">
      <SectionTitle hint="Os produtos desta área são gerenciados a partir do catálogo e vinculados via ofertas.">
        Produtos
      </SectionTitle>

      <div className="rounded-2xl border border-dashed border-border bg-surface-elevated p-6 text-center">
        <Package className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">
          Gerenciar produtos vinculados
        </h3>
        <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
          Os produtos exibidos para os alunos desta área são definidos no catálogo geral
          e liberados pelas ofertas. Vá ao catálogo para criar/editar produtos ou às
          ofertas para definir quais produtos liberam o acesso.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/catalogo">
              <Package className="mr-2 h-4 w-4" />
              Ir para o catálogo
              <ExternalLink className="ml-2 h-3 w-3" />
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/admin/ofertas">
              Ir para ofertas
              <ExternalLink className="ml-2 h-3 w-3" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Tab: Acesso (read-only com link)                                           */
/* -------------------------------------------------------------------------- */

const ACCESS_TYPES: { value: "public" | "restricted_purchase" | "restricted_offer" | "restricted_manual"; label: string; hint: string }[] = [
  { value: "public", label: "Público", hint: "Qualquer aluno logado acessa" },
  { value: "restricted_purchase", label: "Restrito por compra", hint: "Liberado por entitlement de produto" },
  { value: "restricted_offer", label: "Restrito por oferta", hint: "Liberado pelas ofertas vinculadas" },
  { value: "restricted_manual", label: "Restrito manual", hint: "Liberado individualmente pelo admin" },
];

const NO_ACCESS_BEHAVIORS: { value: "show_locked" | "hide" | "show_sales_page"; label: string; hint: string }[] = [
  { value: "show_locked", label: "Mostrar com cadeado", hint: "Card visível, conteúdo bloqueado" },
  { value: "hide", label: "Ocultar completamente", hint: "Aluno sem acesso não vê" },
  { value: "show_sales_page", label: "Mostrar página de venda", hint: "Redireciona para a URL de venda" },
];

function AcessoTab({ variation }: { variation: Variation }) {
  const mutation = useVariationMutation(variation);
  const [accessType, setAccessType] = React.useState(variation.access_type);
  const [noAccessBehavior, setNoAccessBehavior] = React.useState(variation.no_access_behavior);
  const [salesPageUrl, setSalesPageUrl] = React.useState(variation.sales_page_url ?? "");

  const onSave = () => {
    mutation.mutate({
      access_type: accessType,
      no_access_behavior: noAccessBehavior,
      sales_page_url: salesPageUrl || null,
    });
  };

  const showSalesUrl = noAccessBehavior === "show_sales_page";

  return (
    <div className="space-y-5">
      <SectionTitle hint="Defina como esta área é liberada e o que acontece quando o aluno não tem acesso.">
        Acesso
      </SectionTitle>

      <Field label="Tipo de acesso">
        <div className="grid gap-2 sm:grid-cols-2">
          {ACCESS_TYPES.map((opt) => {
            const active = accessType === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setAccessType(opt.value)}
                className={cn(
                  "flex flex-col items-start gap-0.5 rounded-xl border-2 p-3 text-left transition-all",
                  active
                    ? "border-gold bg-gold/5"
                    : "border-border bg-surface-elevated hover:border-border/80",
                )}
              >
                <span className="text-sm font-semibold text-foreground">{opt.label}</span>
                <span className="text-[11px] text-muted-foreground">{opt.hint}</span>
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Comportamento sem acesso" hint="O que mostrar quando o aluno não tem acesso a esta área.">
        <div className="grid gap-2 sm:grid-cols-3">
          {NO_ACCESS_BEHAVIORS.map((opt) => {
            const active = noAccessBehavior === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setNoAccessBehavior(opt.value)}
                className={cn(
                  "flex flex-col items-start gap-0.5 rounded-xl border-2 p-3 text-left transition-all",
                  active
                    ? "border-gold bg-gold/5"
                    : "border-border bg-surface-elevated hover:border-border/80",
                )}
              >
                <span className="text-sm font-semibold text-foreground">{opt.label}</span>
                <span className="text-[11px] text-muted-foreground">{opt.hint}</span>
              </button>
            );
          })}
        </div>
      </Field>

      {showSalesUrl && (
        <Field label="URL da página de venda" hint="Para onde redirecionar alunos sem acesso.">
          <Input
            type="url"
            value={salesPageUrl}
            onChange={(e) => setSalesPageUrl(e.target.value)}
            placeholder="https://suaarea.com/oferta"
            className="font-mono text-xs"
          />
        </Field>
      )}

      <div className="rounded-2xl border border-dashed border-border bg-surface-elevated p-4">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold">
          Ofertas vinculadas
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          As ofertas determinam quais produtos cada comprador recebe. Configure ofertas,
          gateways de pagamento e duração do acesso na tela de ofertas.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button asChild size="sm" variant="outline">
            <Link to="/admin/ofertas">
              Gerenciar ofertas
              <ExternalLink className="ml-2 h-3 w-3" />
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/admin/webhooks">
              Configurar webhook
              <ExternalLink className="ml-2 h-3 w-3" />
            </Link>
          </Button>
        </div>
      </div>

      <SaveBar loading={mutation.isPending} onSave={onSave} label="Salvar acesso" />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Save Bar                                                                   */
/* -------------------------------------------------------------------------- */

function SaveBar({
  loading,
  onSave,
  label,
}: {
  loading: boolean;
  onSave: () => void;
  label: string;
}) {
  return (
    <div className="sticky bottom-2 z-10 flex items-center justify-end gap-2 rounded-xl border border-border bg-surface/95 p-3 shadow-lg backdrop-blur">
      <Button asChild variant="ghost" size="sm">
        <Link to="/admin/areas">Cancelar</Link>
      </Button>
      <Button onClick={onSave} disabled={loading} size="sm">
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        {label}
      </Button>
    </div>
  );
}
