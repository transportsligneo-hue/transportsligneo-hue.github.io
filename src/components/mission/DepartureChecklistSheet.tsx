/**
 * Checklist obligatoire avant de prendre la route (enlèvement, puis livraison).
 *
 * Bloquante : le bouton reste inactif tant que tous les points ne sont pas cochés.
 * Au départ vers l'enlèvement, la validation est horodatée et enregistrée
 * (table mission_departure_checklists) pour l'admin. Avant la livraison, c'est un
 * simple rappel (rien de nouveau à enregistrer).
 */
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ShieldCheck, Loader2, Check, X, Shirt, IdCard, TriangleAlert, BatteryCharging } from "lucide-react";

interface Props {
  attributionId: string;
  userId: string;
  /** "depart" : enregistre la checklist ; "livraison" : simple rappel avant de repartir. */
  kind?: "depart" | "livraison";
  onValidated: () => void | Promise<void>;
  onClose: () => void;
}

const ITEMS = [
  { key: "gilet_jaune", icon: TriangleAlert, label: "Gilet jaune à disposition dans le véhicule",
    hint: "Obligatoire et accessible depuis l'habitacle." },
  { key: "tenue_conforme", icon: Shirt, label: "Tenue correcte",
    hint: "Propre et professionnelle, conforme à la charte de présentation." },
  { key: "permis_en_possession", icon: IdCard, label: "Permis de conduire valide sur moi",
    hint: "Permis original, en cours de validité." },
  { key: "chargeur_telephone", icon: BatteryCharging, label: "Câble pour recharger mon téléphone",
    hint: "Pour garder le GPS et l'appli actifs pendant tout le trajet." },
] as const;

type ItemKey = (typeof ITEMS)[number]["key"];

export function DepartureChecklistSheet({ attributionId, userId, kind = "depart", onValidated, onClose }: Props) {
  const [checked, setChecked] = useState<Record<ItemKey, boolean>>({
    gilet_jaune: false, tenue_conforme: false, permis_en_possession: false, chargeur_telephone: false,
  });
  const [busy, setBusy] = useState(false);
  const allChecked = ITEMS.every((i) => checked[i.key]);
  const left = ITEMS.filter((i) => !checked[i.key]).length;

  const validate = async () => {
    if (!allChecked || busy) return;
    setBusy(true);
    if (kind === "depart") {
      const { error } = await supabase
        .from("mission_departure_checklists" as never)
        .upsert(
          {
            attribution_id: attributionId,
            gilet_jaune: true,
            tenue_conforme: true,
            permis_en_possession: true,
            validated_at: new Date().toISOString(),
            created_by: userId,
          } as never,
          { onConflict: "attribution_id" } as never,
        );
      if (error) {
        setBusy(false);
        toast.error("Enregistrement impossible", { description: error.message });
        return;
      }
      toast.success("Checklist de sécurité validée");
    }
    setBusy(false);
    await onValidated();
  };

  return (
    <div className="drv2">
      <div className="cks">
        <header className="cks-h">
          <button type="button" onClick={onClose} aria-label="Fermer" className="cks-x"><X size={18} /></button>
          <div>
            <small>{kind === "depart" ? "Avant de partir" : "Avant de reprendre la route"}</small>
            <b>Checklist de sécurité</b>
          </div>
          <span className="cks-n">{ITEMS.length - left}/{ITEMS.length}</span>
        </header>

        <div className="cks-b">
          <p className="cks-intro">
            <ShieldCheck size={18} />
            Cochez chaque point avant de prendre la route{kind === "depart" ? " vers le lieu d'enlèvement. Votre validation est horodatée dans le dossier de mission." : " vers le lieu de livraison."}
          </p>
          {ITEMS.map((item) => {
            const Icon = item.icon;
            const on = checked[item.key];
            return (
              <button key={item.key} type="button" className={`cks-i${on ? " on" : ""}`}
                onClick={() => setChecked((p) => ({ ...p, [item.key]: !p[item.key] }))}>
                <span className="cks-box">{on && <Check size={15} strokeWidth={3.4} />}</span>
                <span className="cks-t">
                  <b><Icon size={15} /> {item.label}</b>
                  <small>{item.hint}</small>
                </span>
              </button>
            );
          })}
        </div>

        <footer className="cks-f">
          <button type="button" onClick={() => void validate()} disabled={!allChecked || busy} className="pg-cta">
            {busy ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
            {allChecked ? (kind === "depart" ? "Valider et démarrer le trajet" : "Valider et partir") : `Il reste ${left} point${left > 1 ? "s" : ""} à cocher`}
          </button>
        </footer>
      </div>
    </div>
  );
}
