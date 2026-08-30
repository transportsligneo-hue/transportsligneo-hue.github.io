import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { ArrowLeftRight, Loader2, Info } from "lucide-react";

interface Props {
  trajetId: string;
  /** true si la mission fait déjà partie d'un duo Livraison + Restitution */
  isDuo: boolean;
  depart: string | null;
  arrivee: string | null;
  date: string | null;
  immatriculation: string | null;
  vin: string | null;
  marque: string | null;
  modele: string | null;
  prix: number | null;
  onConverted: () => void;
}

const inputCls =
  "w-full rounded-lg border border-pro-border bg-white px-3 py-2 text-sm text-pro-text focus:outline-none focus:ring-2 focus:ring-pro-accent";
const labelCls = "block text-[11px] font-semibold uppercase tracking-wider text-pro-muted mb-1";

/**
 * Transforme une mission "aller simple" en duo Livraison + Restitution :
 * crée le volet retour (adresses inversées par défaut), répartit le prix
 * et remet le devis d'origine en aller-retour.
 */
export function MissionConvertDuoPanel({
  trajetId,
  isDuo,
  depart,
  arrivee,
  date,
  immatriculation,
  vin,
  marque,
  modele,
  prix,
  onConverted,
}: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    depart: arrivee ?? "",
    arrivee: depart ?? "",
    date: date ?? "",
    // Le retour peut concerner un autre véhicule : ne jamais recopier
    // implicitement l'identité du véhicule aller dans les champs retour.
    immatriculation: "",
    vin: "",
    marque: "",
    modele: "",
    prixRetour: "",
    split: true,
  });

  if (isDuo) return null;

  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const convert = async () => {
    setSaving(true);
    const prixRetour = form.prixRetour.trim() ? Number(form.prixRetour.replace(",", ".")) : null;
    const { error } = await (supabase as any).rpc("admin_convert_mission_to_duo", {
      _trajet_id: trajetId,
      _depart: form.depart.trim() || null,
      _arrivee: form.arrivee.trim() || null,
      _date: form.date || null,
      _heure: null,
      _immatriculation: form.immatriculation.trim() || null,
      _vin: form.vin.trim() || null,
      _marque: form.marque.trim() || null,
      _modele: form.modele.trim() || null,
      _prix_retour: prixRetour !== null && Number.isFinite(prixRetour) ? prixRetour : null,
      _split_prix: form.split,
    });
    setSaving(false);
    if (error) {
      toast.error("Conversion impossible", { description: error.message });
      return;
    }
    toast.success("Mission transformée en Livraison + Restitution", {
      description: "Le volet retour est créé, le devis et la facturation sont mis à jour.",
    });
    setOpen(false);
    onConverted();
  };

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <ArrowLeftRight size={15} className="text-pro-accent" />
          <div>
            <h3 className="text-sm font-semibold text-pro-text uppercase tracking-wider">
              Transformer en aller-retour
            </h3>
            <p className="text-xs text-pro-muted mt-0.5">
              Crée le volet Restitution (-R) rattaché au même dossier et remet le devis en aller-retour.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="shrink-0 rounded-lg border border-pro-border px-3 py-1.5 text-xs font-semibold text-pro-text hover:bg-pro-border/30"
        >
          {open ? "Annuler" : "Convertir"}
        </button>
      </div>

      {open && (
        <div className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Départ du retour</label>
              <input className={inputCls} value={form.depart} onChange={(e) => set("depart", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Arrivée du retour</label>
              <input className={inputCls} value={form.arrivee} onChange={(e) => set("arrivee", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Date du retour</label>
              <input type="date" className={inputCls} value={form.date} onChange={(e) => set("date", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Plaque du véhicule retour</label>
              <input
                className={inputCls}
                value={form.immatriculation}
                onChange={(e) => set("immatriculation", e.target.value.toUpperCase())}
              />
            </div>
            <div>
              <label className={labelCls}>VIN retour</label>
              <input className={inputCls} value={form.vin} onChange={(e) => set("vin", e.target.value.toUpperCase())} />
            </div>
            <div>
              <label className={labelCls}>Marque / Modèle retour</label>
              <div className="flex gap-2">
                <input className={inputCls} value={form.marque} onChange={(e) => set("marque", e.target.value)} placeholder="Marque" />
                <input className={inputCls} value={form.modele} onChange={(e) => set("modele", e.target.value)} placeholder="Modèle" />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-pro-border bg-pro-surface/60 p-3 space-y-2">
            <label className="flex items-center gap-2 text-sm text-pro-text">
              <input
                type="checkbox"
                checked={form.split}
                onChange={(e) => set("split", e.target.checked)}
                className="accent-[color:var(--pro-accent,#2f5fff)]"
              />
              Ajouter la Restitution à 50 % du prix Livraison
              {prix ? ` (${prix} € + ${Math.round(Number(prix) * 50) / 100} € = ${Math.round(Number(prix) * 150) / 100} €)` : ""}
            </label>
            <div>
              <label className={labelCls}>Ou prix du volet Restitution (€)</label>
              <input
                className={inputCls}
                inputMode="decimal"
                placeholder="laisser vide pour 50 % du prix Livraison"
                value={form.prixRetour}
                onChange={(e) => set("prixRetour", e.target.value)}
              />
            </div>

            <p className="flex items-start gap-1.5 text-[11px] text-pro-muted">
              <Info size={12} className="mt-0.5 shrink-0" />
              La facture reste unique pour le dossier : elle porte le montant global du duo.
            </p>
          </div>

          <button
            type="button"
            onClick={convert}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-pro-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <ArrowLeftRight size={14} />}
            Créer le volet Restitution
          </button>
        </div>
      )}
    </Card>
  );
}
