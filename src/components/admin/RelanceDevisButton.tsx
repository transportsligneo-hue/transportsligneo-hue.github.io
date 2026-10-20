import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { relanceDevis } from "@/lib/devis-relance.functions";

/** Relance le client par mail (signature ou paiement) avec son lien personnel. */
export function RelanceDevisButton({ devisId, numero, disabled }: { devisId: string; numero: string; disabled?: boolean }) {
  const [busy, setBusy] = useState(false);
  const relance = useServerFn(relanceDevis);

  const go = async () => {
    if (!window.confirm(`Envoyer une relance au client pour le devis ${numero} ?`)) return;
    setBusy(true);
    try {
      const res = await relance({ data: { devisId } });
      toast.success(
        res.etape === "payer" ? "Relance de paiement envoyée" : "Relance de signature envoyée",
        { description: res.email },
      );
    } catch (e) {
      toast.error("Relance impossible", { description: e instanceof Error ? e.message : "Erreur inconnue" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void go()}
      disabled={busy || disabled}
      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-blue-600 bg-white px-3 py-2 text-[11.5px] font-semibold text-blue-700 transition hover:bg-blue-50 disabled:opacity-50"
    >
      {busy ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Relancer le client
    </button>
  );
}
