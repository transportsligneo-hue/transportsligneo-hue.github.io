import { toast } from "sonner";

/**
 * Confirmation dialog basée sur sonner.
 * Remplacement 1:1 de window.confirm() : `if (!(await confirmToast("...")))`.
 */
export function confirmToast(
  message: string,
  options?: {
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: "default" | "danger";
  },
): Promise<boolean> {
  const {
    description,
    confirmLabel = "Confirmer",
    cancelLabel = "Annuler",
    variant = "default",
  } = options ?? {};

  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const id = toast(message, {
      description,
      duration: 15000,
      className: variant === "danger" ? "border-destructive/40" : undefined,
      action: {
        label: confirmLabel,
        onClick: () => {
          toast.dismiss(id);
          finish(true);
        },
      },
      cancel: {
        label: cancelLabel,
        onClick: () => {
          toast.dismiss(id);
          finish(false);
        },
      },
      onDismiss: () => finish(false),
      onAutoClose: () => finish(false),
    });
  });
}
