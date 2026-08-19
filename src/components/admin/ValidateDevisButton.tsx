import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { adminValidateDevis, type AdminValidationCanal } from "@/lib/devis-admin-validation.functions";

const CANAUX: { value: AdminValidationCanal; label: string }[] = [
  { value: "email", label: "Accord par e-mail" },
  { value: "telephone", label: "Accord par téléphone" },
  { value: "sur_place", label: "Accord sur place" },
  { value: "bon_commande", label: "Bon de commande reçu" },
];

interface Props {
  devisId: string;
  numero: string;
  /** Déjà accepté / verrouillé : le bouton devient inactif */
  locked?: boolean;
  className?: string;
  onValidated?: () => void;
}

/**
 * Permet à l'admin de valider lui-même un devis pour le compte du client
 * (accord reçu par mail, téléphone…) avec trace légale.
 */
export function ValidateDevisButton({ devisId, numero, locked, className, onValidated }: Props) {
  const [open, setOpen] = useState(false);
  const [canal, setCanal] = useState<AdminValidationCanal>("email");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const validate = useServerFn(adminValidateDevis);

  const submit = async () => {
    setBusy(true);
    try {
      const res = await validate({ data: { devisId, canal, note } });
      if ((res as { alreadyAccepted?: boolean }).alreadyAccepted) {
        toast.info("Ce devis était déjà accepté");
      } else {
        toast.success(`Devis ${numero} validé`, { description: CANAUX.find((c) => c.value === canal)?.label });
      }
      setOpen(false);
      setNote("");
      onValidated?.();
    } catch (e) {
      toast.error("Validation impossible", { description: e instanceof Error ? e.message : "Erreur inconnue" });
    } finally {
      setBusy(false);
    }
  };

  if (locked) {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11.5px] font-semibold text-emerald-600 ${className ?? ""}`}>
        <BadgeCheck size={12} /> Devis accepté
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center justify-center gap-1.5 rounded-lg bg-pro-accent px-3 py-2 text-[11.5px] font-semibold text-white transition hover:opacity-90 ${className ?? ""}`}
      >
        <BadgeCheck size={12} /> Valider pour le client
      </button>

      {open && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4" onClick={() => !busy && setOpen(false)}>
          <div
            className="w-full max-w-md rounded-2xl border border-pro-border bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-[15px] font-bold text-pro-text">Valider le devis {numero}</h3>
            <p className="mt-1 text-[12px] text-pro-muted">
              À utiliser quand le client a donné son accord hors plateforme. La validation est horodatée et conservée comme preuve.
            </p>

            <label className="mt-4 mb-1.5 block text-[11.5px] font-semibold uppercase tracking-wide text-pro-muted">
              Origine de l'accord
            </label>
            <div className="flex flex-wrap gap-2">
              {CANAUX.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCanal(c.value)}
                  className={`rounded-lg border px-3 py-2 text-[12px] font-semibold transition ${
                    canal === c.value
                      ? "border-pro-accent bg-pro-accent/10 text-pro-accent"
                      : "border-pro-border bg-white text-pro-text hover:border-pro-accent/50"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            <label className="mt-4 mb-1.5 block text-[11.5px] font-semibold uppercase tracking-wide text-pro-muted">
              Référence / note (facultatif)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Ex : accord de M. Dupont par mail du 19/08 à 14h12"
              className="w-full rounded-lg border border-pro-border bg-white px-3 py-2 text-sm text-pro-text focus:border-pro-accent focus:outline-none focus:ring-2 focus:ring-pro-accent/20"
            />

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setOpen(false)}
                className="flex-1 rounded-lg border border-pro-border px-3 py-2.5 text-[12.5px] font-semibold text-pro-text"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={submit}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-pro-accent px-3 py-2.5 text-[12.5px] font-semibold text-white disabled:opacity-60"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <BadgeCheck size={14} />}
                Valider l'accord
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
