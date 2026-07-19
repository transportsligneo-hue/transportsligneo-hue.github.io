import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Loader2, X } from "lucide-react";
import { toast } from "sonner";

interface Props {
  trajetId: string;
  onDone?: () => void;
  variant?: "button" | "ghost";
  label?: string;
}

/**
 * Bouton "Publier au catalogue" · bascule un trajet en mode catalogue.
 * Ouvre un mini-formulaire pour paramétrer contre-offres + expiration.
 */
export function PublishToCatalogueButton({ trajetId, onDone, variant = "button", label = "Publier au catalogue" }: Props) {
  const [open, setOpen] = useState(false);
  const [allowCounter, setAllowCounter] = useState(true);
  const [expiresH, setExpiresH] = useState(168);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("admin_publish_to_catalogue", {
      _trajet_id: trajetId,
      _allow_counter_offer: allowCounter,
      _expires_in_hours: expiresH,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Mission publiée au catalogue");
    setOpen(false);
    onDone?.();
  };

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className={
          variant === "button"
            ? "w-full px-3 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-500 text-white text-sm font-semibold flex items-center justify-center gap-1.5 hover:opacity-90 shadow-sm"
            : "text-xs text-pro-gold hover:underline flex items-center gap-1"
        }
      >
        <Sparkles size={14} /> {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-bold text-lg text-pro-text flex items-center gap-2"><Sparkles size={18} className="text-pro-gold" /> Publier au catalogue</h3>
                <p className="text-xs text-pro-text-soft mt-1">Rendre la mission visible par tous les convoyeurs validés.</p>
              </div>
              <button onClick={() => setOpen(false)} className="p-1 hover:bg-pro-bg-soft rounded"><X size={16} /></button>
            </div>

            <label className="flex items-center gap-2 mb-3 text-sm">
              <input type="checkbox" checked={allowCounter} onChange={(e) => setAllowCounter(e.target.checked)} className="accent-pro-gold" />
              <span>Autoriser les contre-offres</span>
            </label>

            <label className="block text-xs font-semibold text-pro-text-soft mb-1">Durée d'affichage (heures)</label>
            <input type="number" min={1} value={expiresH} onChange={(e) => setExpiresH(Number(e.target.value))}
              className="w-full mb-4 px-3 py-2 rounded-lg border border-pro-border text-sm" />

            <div className="flex gap-2">
              <button onClick={() => setOpen(false)} className="flex-1 px-4 py-2 rounded-lg border border-pro-border text-sm">Annuler</button>
              <button onClick={submit} disabled={busy}
                className="flex-1 px-4 py-2 rounded-lg bg-pro-brand-strip text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-1.5">
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Publier
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
