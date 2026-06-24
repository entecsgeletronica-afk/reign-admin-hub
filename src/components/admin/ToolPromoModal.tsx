// Modal premium de cross-sell para as ferramentas do menu lateral.
// Padrão visual unificado para AdSniper, Replic, FunnelX e Host VSL.
// - Fundo desfocado (backdrop blur)
// - Card centralizado com cabeçalho, card de destaque, bloco secundário e CTA
// - CTA principal abre URL em nova guia (target=_blank, rel=noopener)
// - "Agora não" apenas fecha o modal

import * as React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  ExternalLink,
  Copy as CopyIcon,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type ToolKey = "adsniper" | "replic" | "funnelx" | "hostvsl";

interface CouponBlock {
  label: string;
  code: string;
}

interface ListBlock {
  label: string;
  items: string[];
}

export interface ToolPromoConfig {
  eyebrow: string;
  title: string;
  subtitle: string;
  highlight: {
    badge: string;
    main: string;
    mainSuffix?: string;
    helper: string;
    accent: "blue" | "violet" | "teal" | "sky";
  };
  coupon?: CouponBlock;
  list?: ListBlock;
  ctaLabel: string;
  ctaUrl: string;
}

const TOOL_CONFIG: Record<ToolKey, ToolPromoConfig> = {
  adsniper: {
    eyebrow: "FERRAMENTAS · ADSNIPER",
    title: "Descubra os criativos e ofertas mais escalados no META",
    subtitle:
      "Conheça a AdSniper com uma condição especial para usuários da plataforma.",
    highlight: {
      badge: "OFERTA EXCLUSIVA",
      main: "50% OFF",
      mainSuffix: "em todos os planos",
      helper: "Use o cupom abaixo no checkout do plano que você escolher.",
      accent: "blue",
    },
    coupon: { label: "CUPOM DE DESCONTO", code: "50OFF" },
    ctaLabel: "VER SITE",
    ctaUrl: "https://www.adsniper.com.br/",
  },
  replic: {
    eyebrow: "FERRAMENTAS · REPLIC",
    title: "Crie e clone sites em poucos minutos",
    subtitle:
      "Modele páginas validadas, edite do seu jeito e publique com muito mais velocidade.",
    highlight: {
      badge: "TESTE GRÁTIS",
      main: "Comece sem cartão de crédito",
      helper:
        "Experimente a Replic gratuitamente e veja como é simples criar páginas profissionais sem começar do zero.",
      accent: "violet",
    },
    list: {
      label: "O QUE VOCÊ PODE FAZER",
      items: [
        "Clonar páginas para modelar estruturas validadas",
        "Editar textos, imagens e seções com facilidade",
        "Criar páginas leves, rápidas e prontas para vender",
      ],
    },
    ctaLabel: "TESTAR GRÁTIS",
    ctaUrl: "https://replic.com.br",
  },
  funnelx: {
    eyebrow: "FERRAMENTAS · FUNNELX",
    title: "Crie quizzes que transformam cliques em leads e vendas",
    subtitle:
      "Monte funis interativos para qualificar visitantes, aumentar engajamento e direcionar cada pessoa para a oferta certa.",
    highlight: {
      badge: "FUNIL INTERATIVO",
      main: "Venda guiando o usuário passo a passo",
      helper:
        "Com a FunnelX, você cria experiências de quiz para capturar leads, segmentar respostas e aumentar a conversão do seu funil.",
      accent: "teal",
    },
    list: {
      label: "IDEAL PARA",
      items: [
        "Criar quizzes de vendas",
        "Segmentar leads por resposta",
        "Direcionar usuários para ofertas personalizadas",
        "Melhorar a experiência antes da página de vendas",
      ],
    },
    ctaLabel: "CONHECER FUNNELX",
    ctaUrl: "https://funnelx.com.br/",
  },
  hostvsl: {
    eyebrow: "FERRAMENTAS · HOST VSL",
    title: "Hospede suas VSLs com recursos feitos para vender mais",
    subtitle:
      "Use um player pensado para páginas de venda, com personalização, métricas e ferramentas para aumentar a conversão.",
    highlight: {
      badge: "PLAYER DE CONVERSÃO",
      main: "Mais controle para sua VSL vender melhor",
      helper:
        "Hospede seus vídeos em uma plataforma criada para quem vende com VSL e precisa de velocidade, controle e dados reais.",
      accent: "sky",
    },
    list: {
      label: "RECURSOS PARA ESCALAR",
      items: [
        "Personalização do player",
        "Métricas de retenção e plays",
        "Recursos para pitch, CTA e conversão",
        "Experiência profissional para páginas de venda",
      ],
    },
    ctaLabel: "CONHECER HOST VSL",
    ctaUrl: "https://www.hostvsl.com.br",
  },
};

export function getToolConfig(key: ToolKey): ToolPromoConfig {
  return TOOL_CONFIG[key];
}

const ACCENT_STYLES: Record<
  ToolPromoConfig["highlight"]["accent"],
  { card: string; badge: string; main: string; ring: string }
> = {
  blue: {
    card: "bg-[oklch(0.22_0.05_255)] border-[oklch(0.32_0.08_255)]",
    badge: "bg-[oklch(0.30_0.10_255)] text-[oklch(0.85_0.12_240)]",
    main: "text-[oklch(0.88_0.14_240)]",
    ring: "ring-[oklch(0.32_0.08_255)]",
  },
  violet: {
    card: "bg-[oklch(0.22_0.05_290)] border-[oklch(0.32_0.09_290)]",
    badge: "bg-[oklch(0.30_0.11_290)] text-[oklch(0.86_0.14_290)]",
    main: "text-[oklch(0.88_0.16_290)]",
    ring: "ring-[oklch(0.32_0.09_290)]",
  },
  teal: {
    card: "bg-[oklch(0.22_0.04_185)] border-[oklch(0.32_0.07_185)]",
    badge: "bg-[oklch(0.30_0.08_185)] text-[oklch(0.86_0.12_185)]",
    main: "text-[oklch(0.88_0.14_185)]",
    ring: "ring-[oklch(0.32_0.07_185)]",
  },
  sky: {
    card: "bg-[oklch(0.22_0.05_225)] border-[oklch(0.32_0.08_225)]",
    badge: "bg-[oklch(0.30_0.10_225)] text-[oklch(0.86_0.13_225)]",
    main: "text-[oklch(0.88_0.15_225)]",
    ring: "ring-[oklch(0.32_0.08_225)]",
  },
};

interface ToolPromoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  toolKey: ToolKey;
}

export function ToolPromoModal({ open, onOpenChange, toolKey }: ToolPromoModalProps) {
  const config = TOOL_CONFIG[toolKey];
  const accent = ACCENT_STYLES[config.highlight.accent];
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);

  const handleCopyCoupon = async () => {
    if (!config.coupon) return;
    try {
      await navigator.clipboard.writeText(config.coupon.code);
      setCopied(true);
      toast.success("Cupom copiado");
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      toast.error("Não foi possível copiar o cupom");
    }
  };

  const handleCta = () => {
    window.open(config.ctaUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-w-[520px] gap-0 overflow-hidden rounded-[22px] border-border/60 bg-card p-0",
          "shadow-[0_24px_60px_-20px_rgba(0,0,0,0.35)]",
        )}
      >
        {/* Cabeçalho */}
        <div className="px-6 pb-3 pt-7 sm:px-7">
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            {config.eyebrow}
          </div>
          <h2 className="mt-2 text-xl font-bold leading-tight text-foreground sm:text-[22px]">
            {config.title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {config.subtitle}
          </p>
        </div>

        {/* Card de destaque */}
        <div className="px-6 pb-2 pt-3 sm:px-7">
          <div
            className={cn(
              "rounded-2xl border p-5",
              accent.card,
            )}
          >
            <div
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em]",
                accent.badge,
              )}
            >
              <Sparkles className="h-3 w-3" />
              {config.highlight.badge}
            </div>
            <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className={cn("text-3xl font-extrabold leading-none sm:text-4xl", accent.main)}>
                {config.highlight.main}
              </span>
              {config.highlight.mainSuffix && (
                <span className="text-sm font-medium text-white/85">
                  {config.highlight.mainSuffix}
                </span>
              )}
            </div>
            <p className="mt-3 text-sm leading-relaxed text-white/75">
              {config.highlight.helper}
            </p>
          </div>
        </div>

        {/* Cupom */}
        {config.coupon && (
          <div className="px-6 pt-3 sm:px-7">
            <div className="rounded-2xl border border-dashed border-border bg-surface/30 p-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {config.coupon.label}
              </div>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="flex h-12 flex-1 items-center justify-center rounded-xl border border-border bg-card font-mono text-xl font-bold tracking-[0.32em] text-foreground">
                  {config.coupon.code}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCopyCoupon}
                  className="h-12 gap-2"
                >
                  {copied ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <CopyIcon className="h-4 w-4" />
                  )}
                  {copied ? "Copiado" : "Copiar cupom"}
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Adicione este cupom no checkout do plano que você gostar.
              </p>
            </div>
          </div>
        )}

        {/* Bloco secundário: lista */}
        {config.list && (
          <div className="px-6 pt-3 sm:px-7">
            <div className="rounded-2xl border border-border/60 bg-surface/30 p-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {config.list.label}
              </div>
              <ul className="mt-2.5 space-y-1.5">
                {config.list.items.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2 text-sm text-foreground/85"
                  >
                    <span
                      className={cn(
                        "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                        accent.main.replace("text-", "bg-"),
                      )}
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Rodapé */}
        <div className="mt-5 flex flex-col-reverse items-stretch gap-2 border-t border-border/60 bg-surface/40 px-6 py-4 sm:flex-row sm:items-center sm:justify-end sm:gap-3 sm:px-7">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-muted-foreground hover:text-foreground"
          >
            Agora não
          </Button>
          <Button
            type="button"
            onClick={handleCta}
            className="gap-2 font-semibold tracking-wide"
          >
            {config.ctaLabel}
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
