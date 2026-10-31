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
  const [equip, setEquip] = useState<string[]>([]);
  const [carburant, setCarburant] = useState<"" | "rembourse" | "plein">("");
  const [miseEnMain, setMiseEnMain] = useState(false);
  const [auction, setAuction] = useState(false);
  const [plafond, setPlafond] = useState("");
  const [auctionH, setAuctionH] = useState(48);
  const [rankVisible, setRankVisible] = useState(true);

  const submit = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("admin_publish_to_catalogue", {
      _trajet_id: trajetId,
      _allow_counter_offer: allowCounter,
      _expires_in_hours: expiresH,
    });
    if (error) { setBusy(false); toast.error(error.message); return; }
    // Options du catalogue (équipements, carburant, enchère) : colonnes ajoutées par la migration driver v2
    const db = supabase as unknown as { from: (t: string) => any };
    const { error: e2 } = await db.from("trajets").update({
      equipements_requis: equip,
      carburant_mode: carburant || null,
      mise_en_main: miseEnMain,
      enchere_active: auction,
      enchere_plafond: auction && plafond ? Number(plafond) : null,
      enchere_fin: auction ? new Date(Date.now() + auctionH * 3600_000).toISOString() : null,
      enchere_classement_visible: rankVisible,
    }).eq("id", trajetId);
    setBusy(false);
    if (e2) { toast.error(e2.message); return; }
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

            <p className="text-xs font-semibold text-pro-text-soft mb-1">Équipement exigé</p>
            <div className="flex flex-wrap gap-3 mb-3 text-sm">
              {([["plateau", "Plateau"], ["wg", "W Garage"], ["elec", "Câble recharge"]] as const).map(([k, l]) => (
                <label key={k} className="flex items-center gap-1.5">
                  <input type="checkbox" checked={equip.includes(k)} onChange={() => setEquip((q) => q.includes(k) ? q.filter((x) => x !== k) : [...q, k])} />{l}
                </label>
              ))}
            </div>
            <label className="block text-xs font-semibold text-pro-text-soft mb-1">Carburant</label>
            <select value={carburant} onChange={(e) => setCarburant(e.target.value as "" | "rembourse" | "plein")}
              className="w-full mb-3 px-3 py-2 rounded-lg border border-pro-border text-sm">
              <option value="">Aucun (carburant compris, rien d'affiché)</option>
              <option value="rembourse">Carburant remboursé</option>
              <option value="plein">Plein fourni</option>
            </select>
            <label className="flex items-center gap-2 mb-3 text-sm">
              <input type="checkbox" checked={miseEnMain} onChange={(e) => setMiseEnMain(e.target.checked)} />
              <span>Mise en main au client</span>
            </label>
            <label className="flex items-center gap-2 mb-2 text-sm font-semibold">
              <input type="checkbox" checked={auction} onChange={(e) => setAuction(e.target.checked)} />
              <span>Mission en enchère</span>
            </label>
            {auction && (
              <div className="mb-4 space-y-2 pl-6">
                <input type="number" min={0} placeholder="Plafond (€), vide = prix +25 %" value={plafond} onChange={(e) => setPlafond(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-pro-border text-sm" />
                <input type="number" min={1} value={auctionH} onChange={(e) => setAuctionH(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-pro-border text-sm" />
                <p className="text-[11px] text-pro-text-soft">Durée de l'enchère en heures</p>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={rankVisible} onChange={(e) => setRankVisible(e.target.checked)} />
                  <span>Afficher le classement aux convoyeurs</span>
                </label>
              </div>
            )}

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
