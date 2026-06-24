import { useEffect, useState, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ConfirmDeleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  /** Frase descritiva opcional acima do campo de confirmação. */
  description?: ReactNode;
  /** Texto exato que o usuário precisa digitar (ex.: nome do item). */
  confirmText: string;
  /** Texto exibido no botão de ação (default "Excluir"). */
  actionLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
};

/**
 * Modal padrão de confirmação destrutiva.
 *
 * Para evitar exclusões acidentais, o botão de ação só é habilitado quando o
 * usuário digita exatamente o texto `confirmText` (geralmente o nome do item)
 * no campo de confirmação. O input é resetado sempre que o modal abre.
 */
export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title = "Excluir item?",
  description,
  confirmText,
  actionLabel = "Excluir",
  cancelLabel = "Cancelar",
  loading = false,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  const [typed, setTyped] = useState("");

  // Reseta o campo sempre que o modal abre/fecha — evita estado “preso”
  // entre exclusões consecutivas de itens diferentes.
  useEffect(() => {
    if (!open) setTyped("");
  }, [open]);

  const matches = typed.trim() === confirmText.trim() && confirmText.length > 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? (
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">{description}</div>
            </AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>

        <div className="space-y-2">
          <Label htmlFor="confirm-delete-input" className="text-xs text-muted-foreground">
            Para confirmar, digite{" "}
            <span className="font-mono font-semibold text-foreground">{confirmText}</span> abaixo.
          </Label>
          <Input
            id="confirm-delete-input"
            autoComplete="off"
            autoFocus
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={confirmText}
            disabled={loading}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            disabled={!matches || loading}
            onClick={(e) => {
              e.preventDefault();
              if (matches && !loading) onConfirm();
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? "Excluindo..." : actionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
