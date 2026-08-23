import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { refuseEntity, type RefusType } from "@/lib/refus.functions";

const TITRES: Record<RefusType, string> = {
  demande: "Refuser la demande",
  devis: "Refuser le devis",
  mission: "Refuser la mission",
};

const MOTIFS_RAPIDES = [
  "Aucun convoyeur disponible sur ces dates",
  "Trajet hors zone d'intervention",
  "Informations véhicule incomplètes",
  "Tarif non validé par le client",
  "Demande en doublon",
];

export function RefusDialog({
  type,
  id,
  label,
  open,
  onClose,
  onDone,
}: {
  type: RefusType;
  id: string;
  label?: string;
  open: boolean;
  onClose: () => void;
  onDone?: () => void;
}) {
  const [motif, setMotif] = useState("");
  const [notify, setNotify] = useState(true);
  const [saving, setSaving] = useState(false);
  const refuse = useServerFn(refuseEntity);

  if (!open) return null;

  const submit = async () => {
    if (motif.trim().length < 3) {
      toast.error("Merci de préciser le motif du refus");
      return;
    }
    setSaving(true);
    try {
      const res = await refuse({ data: { type, id, motif: motif.trim(), notify } });
      toast.success(`${TITRES[type]} — enregistré`, {
        description: res.emailed
          ? `Email de refus envoyé à ${res.email}`
          : notify
            ? "Refus enregistré (aucun email valide pour ce client)"
            : "Refus enregistré sans notification",
      });
      setMotif("");
      onDone?.();
      onClose();
    } catch (e) {
      toast.error("Refus impossible", {
        description: e instanceof Error ? e.message : "Réessayez dans quelques secondes.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
            <XCircle size={18} />
          </span>
          <div>
            <h3 className="text-base font-semibold text-slate-900">{TITRES[type]}</h3>
            {label && <p className="text-xs text-slate-500">{label}</p>}
          </div>
        </div>

        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Motif du refus (visible par le client)
        </label>
        <textarea
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
          rows={4}
          placeholder="Ex. Aucun convoyeur disponible sur cette période."
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#2F5FFF]"
        />

        <div className="mt-2 flex flex-wrap gap-1.5">
          {MOTIFS_RAPIDES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMotif(m)}
              className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] text-slate-600 hover:border-[#2F5FFF] hover:text-[#2F5FFF]"
            >
              {m}
            </button>
          ))}
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
          Envoyer l'email de refus au client (template Ligneo)
        </label>

        <div className="mt-5 flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          <Button size="sm" variant="destructive" onClick={() => void submit()} disabled={saving}>
            {saving ? "Envoi…" : "Confirmer le refus"}
          </Button>
        </div>
      </div>
    </div>
  );
}
