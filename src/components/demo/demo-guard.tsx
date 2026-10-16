import type { ReactNode } from "react";
import { CreditCard, Lock } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

const DEMO_EMAIL = "demo-flotte@transportsligneo.fr";
const BLOCK_MSG = "Mode démonstration : la validation est désactivée. Aucune signature ni aucun paiement n'est enregistré.";

export function useIsDemoAccount() {
  const { user } = useAuth();
  return user?.email?.toLowerCase() === DEMO_EMAIL;
}

const VALIDATE_RE = /(sign|valid|confirm|accept|payer|paiement|envoyer|recevoir le code|commander)/i;

/** Laisse voir et remplir le vrai écran, mais intercepte tout bouton de validation. */
export function DemoActionGuard({ children }: { children: ReactNode }) {
  return (
    <div
      onClickCapture={(e) => {
        const btn = (e.target as HTMLElement).closest("button, [type=submit]") as HTMLElement | null;
        if (!btn) return;
        const isSubmit = btn.getAttribute("type") === "submit";
        if (isSubmit || VALIDATE_RE.test(btn.textContent ?? "")) {
          e.preventDefault();
          e.stopPropagation();
          toast.info(BLOCK_MSG);
        }
      }}
      onSubmitCapture={(e) => { e.preventDefault(); e.stopPropagation(); toast.info(BLOCK_MSG); }}
    >
      {children}
    </div>
  );
}

/** Aperçu du formulaire de paiement par carte, sans création de paiement réel. */
export function DemoCheckoutPreview({ amount }: { amount: number }) {
  return (
    <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); toast.info(BLOCK_MSG); }}>
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
        <Lock size={14} aria-hidden /> Paiement de démonstration — aucune carte n'est débitée.
      </div>
      <label className="text-sm font-medium">E-mail<input className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2" defaultValue={DEMO_EMAIL} /></label>
      <label className="text-sm font-medium">Numéro de carte<input className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 font-mono" placeholder="4242 4242 4242 4242" inputMode="numeric" /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm font-medium">Expiration<input className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2" placeholder="MM / AA" /></label>
        <label className="text-sm font-medium">CVC<input className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2" placeholder="123" /></label>
      </div>
      <label className="text-sm font-medium">Titulaire<input className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2" defaultValue="Démo Flotte SARL" /></label>
      <Button type="submit" className="mt-2"><CreditCard size={16} /> Payer {amount.toFixed(2)} €</Button>
    </form>
  );
}
