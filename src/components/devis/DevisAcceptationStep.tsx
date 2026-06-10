import { useState } from "react";
import { Loader2, FileCheck2, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { acceptDevis } from "@/lib/devis-acceptation.functions";

interface Props {
  devisId: string;
  numero: string;
  depart: string;
  arrivee: string;
  prixTtc: number;
  vehicule?: string | null;
  dateSouhaitee?: string | null;
  onAccepted: () => void;
  onCancel: () => void;
}

const CGV_TEXT = `Article 1 — Objet
Les présentes Conditions Générales de Vente régissent les prestations de convoyage automobile fournies par Transports Ligneo.

Article 2 — Acceptation du devis
Le devis devient ferme et définitif après acceptation expresse par le client (case à cocher). Le montant accepté est ferme et ne peut être modifié sans nouvelle acceptation.

Article 3 — Prix
Les prix indiqués sont en euros TTC, péages et carburant inclus, sauf mention contraire.

Article 4 — Paiement
Le paiement est dû à l'acceptation du devis, sauf accord écrit contraire.

Article 5 — Annulation
Toute annulation à moins de 48h du convoyage entraîne la facturation de 50% du montant.

Article 6 — Responsabilité
Transports Ligneo souscrit une assurance professionnelle couvrant le véhicule pendant le trajet.

Article 7 — Données personnelles
Les données sont traitées conformément à notre politique de confidentialité.

Article 8 — Litiges
Tout litige relève des tribunaux compétents de Tours.`;

export function DevisAcceptationStep({
  devisId,
  numero,
  depart,
  arrivee,
  prixTtc,
  vehicule,
  dateSouhaitee,
  onAccepted,
  onCancel,
}: Props) {
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showCgv, setShowCgv] = useState(false);
  const accept = useServerFn(acceptDevis);

  const handleAccept = async () => {
    if (!checked) return;
    setLoading(true);
    try {
      await accept({ data: { devisId } });
      toast.success("Devis accepté", { description: "Vous pouvez maintenant procéder au paiement." });
      onAccepted();
    } catch (e) {
      toast.error("Acceptation impossible", { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-4 rounded border border-primary/30 bg-primary/5">
        <ShieldCheck className="text-primary shrink-0 mt-0.5" size={20} />
        <div className="text-sm text-cream">
          <p className="font-semibold text-cream">Acceptation du devis requise</p>
          <p className="text-cream/80 mt-1 text-xs leading-relaxed">
            Avant de poursuivre, vérifiez le récapitulatif ci-dessous et acceptez les Conditions
            Générales de Vente. Une preuve d'acceptation horodatée sera conservée.
          </p>
        </div>
      </div>

      <div className="card-premium-light rounded p-4 space-y-3 text-navy">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-navy/60">Devis</p>
          <p className="font-heading text-base text-navy">{numero}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-navy/60">Trajet</p>
            <p className="text-navy">{depart} → {arrivee}</p>
          </div>
          {dateSouhaitee && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-navy/60">Date souhaitée</p>
              <p className="text-navy">{new Date(dateSouhaitee).toLocaleDateString("fr-FR")}</p>
            </div>
          )}
          {vehicule && (
            <div className="sm:col-span-2">
              <p className="text-[10px] uppercase tracking-wider text-navy/60">Véhicule</p>
              <p className="text-navy">{vehicule}</p>
            </div>
          )}
        </div>
        <div className="border-t border-navy/15 pt-3 flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-navy/60">Montant total TTC</span>
          <span className="font-heading text-2xl text-navy font-semibold">{prixTtc.toFixed(2)} €</span>
        </div>
      </div>

      <label className="flex items-start gap-3 p-3 rounded border border-cream/15 bg-navy-dark/40 cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-primary cursor-pointer shrink-0"
        />
        <span className="text-xs text-cream leading-relaxed">
          Je reconnais avoir pris connaissance du devis et des{" "}
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); setShowCgv(true); }}
            className="underline text-primary hover:text-gold-light"
          >
            Conditions Générales de Vente
          </button>{" "}
          et j'accepte la prestation aux conditions indiquées.
        </span>
      </label>

      <div className="flex flex-col-reverse sm:flex-row gap-2 justify-end">
        <button
          onClick={onCancel}
          className="px-4 py-2.5 text-xs uppercase tracking-wider text-cream/70 hover:text-cream rounded border border-cream/20"
        >
          Annuler
        </button>
        <button
          onClick={handleAccept}
          disabled={!checked || loading}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary text-navy font-heading text-xs tracking-[0.15em] uppercase rounded hover:bg-gold-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <FileCheck2 size={14} />}
          Accepter et continuer
        </button>
      </div>

      {showCgv && (
        <div className="fixed inset-0 z-[60] bg-navy/95 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-navy-dark border border-primary/30 rounded-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-cream/10">
              <h3 className="font-heading text-lg text-primary tracking-wider">Conditions Générales de Vente</h3>
              <button onClick={() => setShowCgv(false)} className="text-cream/60 hover:text-cream">
                <X size={20} />
              </button>
            </div>
            <div className="overflow-y-auto p-5 text-sm text-cream/90 whitespace-pre-line leading-relaxed">
              {CGV_TEXT}
            </div>
            <div className="p-4 border-t border-cream/10 flex justify-end">
              <button
                onClick={() => setShowCgv(false)}
                className="px-4 py-2 bg-primary text-navy text-xs uppercase tracking-wider rounded hover:bg-gold-light"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
