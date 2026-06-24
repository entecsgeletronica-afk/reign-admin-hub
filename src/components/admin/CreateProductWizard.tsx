import * as React from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Brush, Check, FileText, Layers, Video } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  createProduct,
  type CatalogProductRow,
  type CatalogSectionRow,
  type ProductType,
} from "@/services/catalog-db";

type Step = 1 | 2 | 3;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sections: CatalogSectionRow[];
  variationId: string | null;
  nextOrder: number;
  /**
   * Chamado depois que o produto foi criado e o wizard fechou.
   * - Para `course` o wizard já navega para a tela de aulas.
   * - Para `drawing` o caller recebe o produto e tipicamente abre o editor
   *   completo (ProductDialog) para configurar páginas e capa.
   */
  onCreated: (product: CatalogProductRow) => void;
};

const TYPE_OPTIONS: Array<{
  value: ProductType;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}> = [
  {
    value: "course",
    title: "Curso em vídeo",
    subtitle: "Módulos e aulas",
    description:
      "Ideal para conteúdos com várias aulas em vídeo, materiais complementares e progresso por aluno.",
    icon: Video,
    accent: "from-primary/20 to-primary/5",
  },
  {
    value: "drawing",
    title: "Desenhos para colorir",
    subtitle: "Páginas interativas",
    description:
      "Para histórias em páginas de colorir — capa, lineart e amostras coloridas. Aparece na home como atividade.",
    icon: Brush,
    accent: "from-amber-500/20 to-amber-500/5",
  },
  {
    value: "ebook",
    title: "E-book / PDF",
    subtitle: "Material de leitura",
    description:
      "Publique e-books, apostilas, devocionais ou guias em PDF. Leitura acontece dentro da área de membros — sem nova aba.",
    icon: FileText,
    accent: "from-gold/20 to-gold/5",
  },
];

export function CreateProductWizard({
  open,
  onOpenChange,
  sections,
  variationId,
  nextOrder,
  onCreated,
}: Props) {
  const navigate = useNavigate();
  const [step, setStep] = React.useState<Step>(1);
  const [sectionId, setSectionId] = React.useState<string>("");
  const [title, setTitle] = React.useState("");
  const [productType, setProductType] = React.useState<ProductType | null>(null);

  // Reseta o estado sempre que o wizard abre — evita que o admin
  // veja o passo anterior ao criar outro produto em sequência.
  React.useEffect(() => {
    if (open) {
      setStep(1);
      setSectionId("");
      setTitle("");
      setProductType(null);
    }
  }, [open]);

  const createMut = useMutation({
    mutationFn: async () => {
      if (!sectionId || !title.trim() || !productType) {
        throw new Error("Preencha todos os campos");
      }
      return createProduct({
        title: title.trim(),
        section_id: sectionId,
        variation_id: variationId,
        product_type: productType,
        order_index: nextOrder,
        is_published: false,
      });
    },
    onSuccess: (product) => {
      toast.success("Produto criado! Configure agora os detalhes.");
      onOpenChange(false);
      onCreated(product);
      // Cursos vão direto para o editor de módulos/aulas.
      if (product.product_type === "course") {
        navigate({
          to: "/admin/produtos/$productId/aulas",
          params: { productId: product.id },
        });
      }
      // E-books vão direto para o editor de PDFs/módulos.
      else if (product.product_type === "ebook") {
        navigate({
          to: "/admin/produtos/$productId/ebook",
          params: { productId: product.id },
        });
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canAdvanceStep1 = !!sectionId;
  const canAdvanceStep2 = title.trim().length >= 2;
  const canFinish = !!productType;

  const goNext = () => {
    if (step === 1 && canAdvanceStep1) setStep(2);
    else if (step === 2 && canAdvanceStep2) setStep(3);
  };
  const goBack = () => {
    if (step === 3) setStep(2);
    else if (step === 2) setStep(1);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 p-0">
        <DialogHeader className="space-y-2 border-b border-border/60 px-6 py-5">
          <DialogTitle className="text-xl">Cadastrar novo produto</DialogTitle>
          <DialogDescription>
            Em apenas 3 passos seu produto estará pronto para receber conteúdo.
          </DialogDescription>
          <StepIndicator step={step} />
        </DialogHeader>

        <div className="px-6 py-6">
          {step === 1 && (
            <SectionStep
              sections={sections}
              value={sectionId}
              onChange={setSectionId}
            />
          )}
          {step === 2 && <NameStep value={title} onChange={setTitle} />}
          {step === 3 && (
            <TypeStep value={productType} onChange={setProductType} />
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border/60 bg-surface/40 px-6 py-4">
          <Button
            variant="ghost"
            onClick={step === 1 ? () => onOpenChange(false) : goBack}
            disabled={createMut.isPending}
            className="gap-2"
          >
            {step === 1 ? (
              "Cancelar"
            ) : (
              <>
                <ArrowLeft className="h-4 w-4" /> Voltar
              </>
            )}
          </Button>

          <div className="text-xs text-muted-foreground">
            Passo {step} de 3
          </div>

          {step < 3 ? (
            <Button
              onClick={goNext}
              disabled={
                (step === 1 && !canAdvanceStep1) ||
                (step === 2 && !canAdvanceStep2)
              }
              className="gap-2"
            >
              Continuar <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={() => createMut.mutate()}
              disabled={!canFinish || createMut.isPending}
              className="gap-2"
            >
              {createMut.isPending ? "Criando..." : "Criar e continuar"}
              <Check className="h-4 w-4" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Sub-components ---------------- */

function StepIndicator({ step }: { step: Step }) {
  const items = [
    { n: 1, label: "Seção" },
    { n: 2, label: "Nome" },
    { n: 3, label: "Tipo" },
  ];
  return (
    <div className="flex items-center gap-2 pt-2">
      {items.map((it, idx) => {
        const active = step === it.n;
        const done = step > it.n;
        return (
          <React.Fragment key={it.n}>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold transition",
                  done && "bg-primary text-primary-foreground",
                  active && "bg-primary/20 text-primary ring-2 ring-primary/40",
                  !active && !done && "bg-muted text-muted-foreground",
                )}
              >
                {done ? <Check className="h-3 w-3" /> : it.n}
              </span>
              <span
                className={cn(
                  "text-xs font-medium",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {it.label}
              </span>
            </div>
            {idx < items.length - 1 && (
              <div
                className={cn(
                  "h-px flex-1 transition",
                  step > it.n ? "bg-primary/60" : "bg-border",
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function SectionStep({
  sections,
  value,
  onChange,
}: {
  sections: CatalogSectionRow[];
  value: string;
  onChange: (v: string) => void;
}) {
  if (sections.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface px-4 py-8 text-center text-sm text-muted-foreground">
        Você ainda não tem seções nesta área de membros. Vá até a aba{" "}
        <strong>Seções</strong> e crie uma antes de cadastrar produtos.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">Em qual seção?</h3>
        <p className="text-sm text-muted-foreground">
          As seções organizam seus produtos na home da área de membros.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {sections.map((s) => {
          const active = value === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onChange(s.id)}
              className={cn(
                "group flex items-start gap-3 rounded-xl border bg-surface px-4 py-3 text-left transition",
                active
                  ? "border-primary ring-2 ring-primary/40"
                  : "border-border hover:border-primary/40",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                  active ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground",
                )}
              >
                <Layers className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-foreground">
                  {s.title}
                </div>
                {s.subtitle && (
                  <div className="truncate text-xs text-muted-foreground">
                    {s.subtitle}
                  </div>
                )}
              </div>
              {active && (
                <Check className="h-4 w-4 shrink-0 text-primary" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NameStep({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">Como vai se chamar?</h3>
        <p className="text-sm text-muted-foreground">
          Esse nome aparece para os alunos na home e na capa do produto. Você pode
          ajustar depois.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="wizard-product-title">Nome do produto</Label>
        <Input
          id="wizard-product-title"
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Ex.: Arca de Noé, Mentoria Premium..."
          maxLength={120}
        />
        <p className="text-xs text-muted-foreground">
          Mínimo 2 caracteres. {value.trim().length}/120
        </p>
      </div>
    </div>
  );
}

function TypeStep({
  value,
  onChange,
}: {
  value: ProductType | null;
  onChange: (v: ProductType) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">Qual o tipo deste produto?</h3>
        <p className="text-sm text-muted-foreground">
          Escolha o formato — isso define qual editor abriremos a seguir.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {TYPE_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={cn(
                "group relative overflow-hidden rounded-2xl border p-5 text-left transition",
                active
                  ? "border-primary ring-2 ring-primary/40"
                  : "border-border hover:border-primary/40",
              )}
            >
              <div
                className={cn(
                  "absolute inset-0 bg-gradient-to-br opacity-60 transition group-hover:opacity-100",
                  opt.accent,
                )}
                aria-hidden
              />
              <div className="relative space-y-3">
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-xl",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "bg-background/80 text-foreground",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  {active && (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">
                      Selecionado
                    </span>
                  )}
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">
                    {opt.title}
                  </div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    {opt.subtitle}
                  </div>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {opt.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
