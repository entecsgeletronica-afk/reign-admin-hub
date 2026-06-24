import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Upload, Link2, Image as ImageIcon, Save, Palette } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import {
  getBranding,
  saveBranding,
  type BrandingSettings,
} from "@/services/settings";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/_shell/branding")({
  component: BrandingPage,
});

type Tab = "upload" | "url";

async function uploadToBranding(file: File, prefix: "logo" | "favicon"): Promise<string> {
  const ext = file.name.split(".").pop() ?? "png";
  const path = `${prefix}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("branding").upload(path, file, {
    cacheControl: "3600",
    upsert: true,
    contentType: file.type,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("branding").getPublicUrl(path);
  return data.publicUrl;
}

function BrandingPage() {
  const [tab, setTab] = React.useState<Tab>("upload");
  const [data, setData] = React.useState<BrandingSettings | null>(null);
  const [logoUrlInput, setLogoUrlInput] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const faviconRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    getBranding()
      .then((b) => {
        setData(b);
        setLogoUrlInput(b.logo_url ?? "");
      })
      .catch((e: Error) => toast.error(e.message));
  }, []);

  if (!data) return null;

  function update<K extends keyof BrandingSettings>(key: K, value: BrandingSettings[K]) {
    setData((d) => (d ? { ...d, [key]: value } : d));
  }

  function onPickFile(target: "logo" | "favicon") {
    const input = target === "logo" ? fileRef.current : faviconRef.current;
    input?.click();
  }

  async function onFile(target: "logo" | "favicon", file: File | undefined) {
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Arquivo maior que 4 MB.");
      return;
    }
    try {
      const url = await uploadToBranding(file, target);
      update(target === "logo" ? "logo_url" : "favicon_url", url);
      if (target === "logo") setLogoUrlInput(url);
      toast.success("Imagem enviada.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function onSave() {
    if (!data) return;
    setSaving(true);
    try {
      const next: BrandingSettings = {
        ...data,
        logo_url: tab === "url" ? logoUrlInput.trim() || null : data.logo_url,
      };
      await saveBranding(next);
      const fresh = await getBranding();
      setData(fresh);
      toast.success("Branding salvo e aplicado.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Branding"
        title="Identidade da plataforma"
        description="Logo, cores, favicon e informações de contato exibidas no header, no painel admin e nos e-mails."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
        {/* Form */}
        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
          {/* Tabs */}
          <div className="grid grid-cols-2 gap-2 rounded-full border border-border bg-surface-elevated p-1">
            <TabButton active={tab === "upload"} onClick={() => setTab("upload")}>
              <Upload className="h-4 w-4" /> Upload
            </TabButton>
            <TabButton active={tab === "url"} onClick={() => setTab("url")}>
              <Link2 className="h-4 w-4" /> URL externa
            </TabButton>
          </div>

          <div className="mt-6 space-y-2">
            <label className="text-sm font-semibold text-foreground">Logo principal</label>
            {tab === "upload" ? (
              <button
                type="button"
                onClick={() => onPickFile("logo")}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-surface-elevated px-4 py-8 text-sm font-semibold text-foreground transition hover:border-gold/60 hover:text-gold"
              >
                <Upload className="h-4 w-4" />
                Selecionar imagem (PNG, SVG, JPG ou WEBP)
              </button>
            ) : (
              <input
                type="url"
                value={logoUrlInput}
                onChange={(e) => setLogoUrlInput(e.target.value)}
                placeholder="https://..."
                className="h-11 w-full rounded-xl border border-border bg-surface-elevated px-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-none"
              />
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/svg+xml,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => onFile("logo", e.target.files?.[0])}
            />
            <p className="text-xs text-muted-foreground">
              Recomendamos PNG transparente quadrado (mín. 256×256). Para nitidez retina, prefira 512×512.
            </p>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nome do app">
              <input
                type="text"
                value={data.app_name}
                onChange={(e) => update("app_name", e.target.value)}
                className="h-11 w-full rounded-xl border border-border bg-surface-elevated px-4 text-sm text-foreground focus:border-gold focus:outline-none"
              />
            </Field>
            <Field label="Texto alternativo da logo">
              <input
                type="text"
                value={data.logo_alt}
                onChange={(e) => update("logo_alt", e.target.value)}
                className="h-11 w-full rounded-xl border border-border bg-surface-elevated px-4 text-sm text-foreground focus:border-gold focus:outline-none"
              />
            </Field>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <ColorField
              label="Cor primária"
              value={data.primary_color}
              onChange={(v) => update("primary_color", v)}
            />
            <ColorField
              label="Cor secundária"
              value={data.secondary_color}
              onChange={(v) => update("secondary_color", v)}
            />
            <ColorField
              label="Cor de destaque"
              value={data.accent_color}
              onChange={(v) => update("accent_color", v)}
            />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="E-mail de suporte">
              <input
                type="email"
                value={data.support_email ?? ""}
                onChange={(e) => update("support_email", e.target.value || null)}
                placeholder="suporte@seudominio.com"
                className="h-11 w-full rounded-xl border border-border bg-surface-elevated px-4 text-sm text-foreground focus:border-gold focus:outline-none"
              />
            </Field>
          </div>

          <div className="mt-6 space-y-2">
            <label className="text-sm font-semibold text-foreground">Favicon (opcional)</label>
            <div className="flex gap-2">
              <input
                type="url"
                value={data.favicon_url ?? ""}
                onChange={(e) => update("favicon_url", e.target.value || null)}
                placeholder="https://... ou faça upload"
                className="h-11 flex-1 rounded-xl border border-border bg-surface-elevated px-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-none"
              />
              <button
                type="button"
                onClick={() => onPickFile("favicon")}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface-elevated px-4 text-sm font-semibold text-foreground transition hover:border-gold/60"
              >
                <Upload className="h-4 w-4" /> Upload
              </button>
              <input
                ref={faviconRef}
                type="file"
                accept="image/png,image/svg+xml,image/x-icon,image/webp"
                className="hidden"
                onChange={(e) => onFile("favicon", e.target.files?.[0])}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gold text-sm font-semibold text-gold-foreground shadow transition hover:brightness-105 disabled:opacity-60"
          >
            <Save className="h-4 w-4" /> {saving ? "Salvando..." : "Salvar e aplicar"}
          </button>
        </section>

        {/* Preview */}
        <aside className="space-y-4">
          <div className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-gold">
              Pré-visualização
            </div>
            <div className="mt-1 text-base font-semibold text-foreground">Como vai aparecer</div>

            <div className="mt-5 flex h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-surface-elevated">
              {data.logo_url ? (
                <img
                  src={data.logo_url}
                  alt={data.logo_alt}
                  className="h-20 w-20 object-contain"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-card text-muted-foreground">
                  <ImageIcon className="h-7 w-7" />
                </div>
              )}
              <div className="text-base font-semibold text-foreground">{data.app_name}</div>
            </div>

            {(data.primary_color || data.secondary_color || data.accent_color) && (
              <div className="mt-4 flex items-center gap-2">
                <Palette className="h-4 w-4 text-muted-foreground" />
                <div className="flex gap-2">
                  {[data.primary_color, data.secondary_color, data.accent_color]
                    .filter((c): c is string => !!c)
                    .map((color) => (
                      <div
                        key={color}
                        className="h-6 w-6 rounded-full border border-border"
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-3">
              {data.logo_url ? (
                <img
                  src={data.logo_url}
                  alt={data.logo_alt}
                  className="h-9 w-9 rounded-full bg-surface-elevated object-contain"
                />
              ) : (
                <div className="h-9 w-9 rounded-full bg-surface-elevated" />
              )}
              <div>
                <div className="text-sm font-semibold text-foreground">{data.app_name}</div>
                <div className="text-xs text-muted-foreground">Cabeçalho do app</div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
        active
          ? "bg-gold text-gold-foreground shadow"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-foreground">{label}</label>
      {children}
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-foreground">{label}</label>
      <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-elevated px-3 py-2">
        <input
          type="color"
          value={value ?? "#cccccc"}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent"
        />
        <input
          type="text"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          placeholder="#000000"
          className="h-8 flex-1 bg-transparent text-sm font-mono text-foreground focus:outline-none"
        />
      </div>
    </div>
  );
}
