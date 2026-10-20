import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Landmark, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { confirmVirementDevis } from "@/lib/devis-virement.functions";

/** « Virement reçu » : marque le devis payé et envoie confirmation + facture au client. */
export function ConfirmVirementButton({
  devisId, numero, montant, disabled, onDone,
}: { devisId: string; numero: string; montant: number; disabled?: boolean; onDone?: () => void }) {
  const [busy, setBusy] = useState(false);
  const confirmFn = useServerFn(confirmVirementDevis);

  const go = async () => {
    const eur = montant.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (!window.confirm(
      `Confirmer que tu as bien reçu le virement de ${eur} € pour le devis ${numero} ?\n\n` +
      "Le client recevra le mail de confirmation et sa facture.",
    )) return;
    setBusy(true);
    try {
      const res = await confirmFn({ data: { devisId } });
      toast.success("Virement confirmé", { description: `Confirmation et facture envoyées à ${res.email}` });
      onDone?.();
    } catch (e) {
      toast.error("Confirmation impossible", { description: e instanceof Error ? e.message : "Erreur inconnue" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void go()}
      disabled={busy || disabled}
      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-600 bg-white px-3 py-2 text-[11.5px] font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50"
    >
      {busy ? <Loader2 size={12} className="animate-spin" /> : <Landmark size={12} />} Virement reçu
    </button>
  );
}
