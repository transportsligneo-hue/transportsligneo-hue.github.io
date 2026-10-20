import { useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  open: boolean;
  numero: string;
  problems: string[];
  busy?: boolean;
  onCancel: () => void;
  /** Appelé uniquement une fois la case cochée. */
  onConfirm: () => void;
}

/** Avertissement avant de convertir en mission un devis non signé et/ou non payé. */
export function ConvertDevisDialog({ open, numero, problems, busy, onCancel, onConfirm }: Props) {
  const [ok, setOk] = useState(false);
  useEffect(() => { if (open) setOk(false); }, [open]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !busy) onCancel(); }}>
      <DialogContent className="max-w-md bg-white text-slate-900">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-600" /> Attention — devis {numero}
          </DialogTitle>
          <DialogDescription>Ce devis n’est pas encore en règle :</DialogDescription>
        </DialogHeader>
        <ul className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 space-y-1 list-disc pl-6">
          {problems.map((p) => <li key={p}>{p}</li>)}
        </ul>
        <label className="flex items-start gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} className="mt-1 h-4 w-4" />
          <span>Je sais, je convertis quand même en mission.</span>
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onCancel} disabled={busy} className="px-4 py-2 rounded-lg border border-slate-300 text-sm">
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!ok || busy}
            className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-semibold disabled:opacity-40 inline-flex items-center gap-2"
          >
            {busy && <Loader2 size={14} className="animate-spin" />} Convertir quand même
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
