// Reusable premium "Conteúdo bloqueado" dialog. Triggered when a learner
// taps a product they don't own yet. Offers a "Ver oferta" CTA when the
// product (or the active variation) has a sales URL configured; otherwise
// just shows a graceful explanation.

import * as React from "react";
import { Lock, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface LockedProductInfo {
  title: string;
  /** Direct sales URL on the product (preferred). */
  externalUrl?: string | null;
  /** Fallback sales URL coming from the variation/area config. */
  fallbackSalesUrl?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: LockedProductInfo | null;
}

export function LockedContentDialog({ open, onOpenChange, product }: Props) {
  const salesUrl = product?.externalUrl?.trim() || product?.fallbackSalesUrl?.trim() || null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gold/15 text-gold ring-1 ring-gold/30">
          <Lock className="h-6 w-6" />
        </div>
        <DialogHeader className="text-center">
          <DialogTitle className="text-center text-xl">Conteúdo bloqueado</DialogTitle>
          <DialogDescription className="text-center text-sm leading-relaxed">
            {product?.title ? (
              <>
                <strong className="text-foreground">{product.title}</strong> faz parte de
                uma oferta especial. Faça a compra para liberar o acesso automaticamente
                na sua área de membros.
              </>
            ) : (
              <>
                Este conteúdo faz parte de uma oferta especial. Faça a compra para
                liberar o acesso automaticamente na sua área de membros.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:flex-col-reverse sm:gap-2 sm:space-x-0">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="w-full"
          >
            Voltar
          </Button>
          {salesUrl && (
            <Button
              asChild
              className="w-full bg-gold text-gold-foreground hover:bg-gold/90"
            >
              <a href={salesUrl} target="_blank" rel="noopener noreferrer">
                Ver oferta
                <ExternalLink className="ml-1.5 h-4 w-4" />
              </a>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
