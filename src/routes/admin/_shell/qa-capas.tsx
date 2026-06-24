import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Sun,
  Coffee,
  ImageIcon,
  Upload,
  Link2,
  Maximize2,
  Grid3X3,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { listStoryCovers, saveStoryCover, type StoryCover } from "@/services/settings";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/_shell/qa-capas")({
  component: QaCapasPage,
});

type Background = "light" | "cream";
type Testament = "parables" | "new" | "old" | "all";

const TESTAMENTS: { key: Testament; label: string }[] = [
  { key: "parables", label: "Parábolas" },
  { key: "new", label: "Novo Testamento" },
  { key: "old", label: "Antigo Testamento" },
  { key: "all", label: "Todas" },
];

function QaCapasPage() {
  const [bg, setBg] = React.useState<Background>("light");
  const [testament, setTestament] = React.useState<Testament>("parables");
  const [showGuides, setShowGuides] = React.useState(true);
  const [showFrame, setShowFrame] = React.useState(true);

  const [covers, setCovers] = React.useState<StoryCover[]>([]);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [urlInput, setUrlInput] = React.useState("");
  const [targetId, setTargetId] = React.useState<string>("");
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    listStoryCovers().then((c) => {
      setCovers(c);
      if (c[0]) setTargetId(c[0].id);
    });
  }, []);

  const filtered = React.useMemo(
    () => (testament === "all" ? covers : covers.filter((c) => c.testament === testament)),
    [covers, testament],
  );

  function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Arquivo maior que 8 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPreviewUrl(String(reader.result));
    reader.readAsDataURL(file);
  }

  function importFromUrl() {
    if (!urlInput.trim()) return;
    setPreviewUrl(urlInput.trim());
  }

  async function saveAsCover() {
    if (!previewUrl || !targetId) {
      toast.error("Importe uma imagem e selecione a história alvo.");
      return;
    }
    const target = covers.find((c) => c.id === targetId);
    if (!target) return;
    const next = { ...target, cover_url: previewUrl };
    await saveStoryCover(next);
    setCovers((all) => all.map((c) => (c.id === next.id ? next : c)));
    toast.success(`Capa de "${target.title}" atualizada.`);
  }

  return (
    <div className="space-y-6">
      <Link
        to="/admin/dashboard"
        className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar ao painel
      </Link>

      <PageHeader
        eyebrow="QA · Capas"
        title="QA de Capas"
        description="Comparativo visual das capas em 320 e 640 px sobre fundo claro e creme. Guias verticais ajudam a validar centragem do personagem; molduras simulam o card do catálogo."
      />

      {/* Toolbar */}
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-elevated p-1">
            <PillToggle active={bg === "light"} onClick={() => setBg("light")}>
              <Sun className="h-3.5 w-3.5" /> Claro
            </PillToggle>
            <PillToggle active={bg === "cream"} onClick={() => setBg("cream")}>
              <Coffee className="h-3.5 w-3.5" /> Creme
            </PillToggle>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {TESTAMENTS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTestament(t.key)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                  testament === t.key
                    ? "border-gold bg-gold text-gold-foreground"
                    : "border-border bg-surface-elevated text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ToolButton active={showGuides} onClick={() => setShowGuides((v) => !v)}>
            <Grid3X3 className="h-3.5 w-3.5" /> Guias
          </ToolButton>
          <ToolButton active={showFrame} onClick={() => setShowFrame((v) => !v)}>
            <Maximize2 className="h-3.5 w-3.5" /> Moldura do card
          </ToolButton>
        </div>
      </section>

      <div className="text-sm text-muted-foreground">
        Mostrando <strong className="text-foreground">{filtered.length} histórias</strong>.
      </div>

      {/* Importer */}
      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-gold" />
          <div className="text-sm font-semibold text-foreground">Importar capa para teste</div>
          <span className="text-xs text-muted-foreground">
            Faça upload ou cole uma URL — visualize aqui antes de salvar como capa oficial.
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-surface-elevated px-4 py-8 text-sm font-semibold text-foreground transition hover:border-gold/60 hover:text-gold"
            >
              <Upload className="h-5 w-5" />
              Arraste a imagem ou clique para escolher
              <span className="text-xs font-normal text-muted-foreground">
                PNG, JPG ou WebP · até 8 MB · proporção ideal 2:3
              </span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://exemplo.com/capa.jpg"
                  className="h-11 w-full rounded-xl border border-border bg-surface-elevated pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={importFromUrl}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface-elevated px-4 text-sm font-semibold text-foreground transition hover:border-gold/60"
              >
                Importar URL
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-semibold uppercase tracking-[0.25em] text-gold">
              História alvo
            </label>
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="h-11 w-full rounded-xl border border-border bg-surface-elevated px-3 text-sm text-foreground focus:border-gold focus:outline-none"
            >
              <option value="">Selecione a história…</option>
              {covers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
            <div className="flex gap-3">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-border bg-surface-elevated text-[10px] text-muted-foreground">
                {previewUrl ? (
                  <img src={previewUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  "sem imagem"
                )}
              </div>
              <button
                type="button"
                onClick={saveAsCover}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gold text-sm font-semibold text-gold-foreground shadow transition hover:brightness-105"
              >
                <Save className="h-4 w-4" /> Salvar como capa desta história
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              A capa importada substitui visualmente o card abaixo. Ao salvar, ela passa a ser
              servida no app.
            </p>
          </div>
        </div>
      </section>

      {/* Stories grid */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {filtered.map((story) => (
          <StoryQA
            key={story.id}
            story={story}
            bg={bg}
            showGuides={showGuides}
            showFrame={showFrame}
            previewOverride={story.id === targetId ? previewUrl : null}
          />
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full rounded-3xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
            Nenhuma história neste filtro.
          </div>
        )}
      </section>
    </div>
  );
}

function StoryQA({
  story,
  bg,
  showGuides,
  showFrame,
  previewOverride,
}: {
  story: StoryCover;
  bg: Background;
  showGuides: boolean;
  showFrame: boolean;
  previewOverride: string | null;
}) {
  const url = previewOverride ?? story.cover_url;
  const bgClass = bg === "light" ? "bg-[#1f2638]" : "bg-[#2a2419]";
  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
      <div className="flex items-start justify-between gap-3 p-4">
        <div>
          <div className="text-base font-semibold text-foreground">{story.title}</div>
          <div className="text-xs text-muted-foreground">
            {story.subtitle} ·{" "}
            <code className="rounded bg-surface-elevated px-1.5 py-0.5 text-[10px] text-gold">
              {story.slug}
            </code>
          </div>
        </div>
        {story.is_new && (
          <span className="rounded-full bg-gold-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gold">
            Novo
          </span>
        )}
      </div>
      <div className={cn("grid grid-cols-2 gap-4 p-4 pt-0", bgClass)}>
        <CoverFrame
          width={320}
          url={url}
          showGuides={showGuides}
          showFrame={showFrame}
          alt={story.title}
        />
        <CoverFrame
          width={640}
          url={url}
          showGuides={showGuides}
          showFrame={showFrame}
          alt={story.title}
        />
      </div>
    </div>
  );
}

function CoverFrame({
  width,
  url,
  showGuides,
  showFrame,
  alt,
}: {
  width: 320 | 640;
  url: string | null;
  showGuides: boolean;
  showFrame: boolean;
  alt: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
        <span className="text-muted-foreground">{width}px</span>
        <span className="text-muted-foreground">2:3</span>
      </div>
      <div
        className={cn(
          "relative aspect-[2/3] w-full overflow-hidden bg-surface-elevated",
          showFrame ? "rounded-2xl border-2 border-white/40" : "rounded-xl",
        )}
      >
        {url ? (
          <img src={url} alt={alt} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
            Sem capa
          </div>
        )}
        {showGuides && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(244,114,182,0.55) 1px, transparent 1px), linear-gradient(to bottom, rgba(244,114,182,0.55) 1px, transparent 1px)",
              backgroundSize: "33.33% 33.33%",
            }}
          />
        )}
      </div>
    </div>
  );
}

function PillToggle({
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
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
        active
          ? "bg-gold text-gold-foreground shadow"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function ToolButton({
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
        "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
        active
          ? "border-gold bg-gold text-gold-foreground"
          : "border-border bg-surface-elevated text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
