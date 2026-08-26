import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { confirmToast } from "@/lib/confirm-toast";

type PurgeKind = "trajet" | "devis" | "demande";

const RPC: Record<PurgeKind, "admin_purge_trajet" | "admin_purge_devis" | "admin_purge_demande"> = {
  trajet: "admin_purge_trajet",
  devis: "admin_purge_devis",
  demande: "admin_purge_demande",
};

const ARG: Record<PurgeKind, string> = {
  trajet: "_trajet_id",
  devis: "_devis_id",
  demande: "_demande_id",
};

const NOUN: Record<PurgeKind, string> = {
  trajet: "cette mission",
  devis: "ce devis",
  demande: "cette demande",
};

/**
 * Suppression DÉFINITIVE (admin uniquement, contrôle côté RPC).
 * Efface l'élément et toutes ses données liées (attributions, EDL, photos,
 * signatures, PV, rémunérations, factures rattachées).
 */
export function AdminPurgeButton({
  kind,
  id,
  label,
  compact = false,
  onDeleted,
  className = "",
}: {
  kind: PurgeKind;
  id: string;
  label?: string;
  compact?: boolean;
  onDeleted?: () => void;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);

  const handle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const what = label ? `${NOUN[kind]} (${label})` : NOUN[kind];
    if (!(await confirmToast(`Supprimer définitivement ${what} et toutes ses données liées ?`))) return;
    if (!(await confirmToast("Cette action est irréversible. Confirmer la suppression ?"))) return;
    setBusy(true);
    const { error } = await supabase.rpc(RPC[kind], { [ARG[kind]]: id } as never);
    setBusy(false);
    if (error) {
      toast.error("Suppression impossible", { description: error.message });
      return;
    }
    toast.success("Supprimé définitivement");
    onDeleted?.();
  };

  if (compact) {
    return (
      <button
        onClick={handle}
        disabled={busy}
        title="Supprimer définitivement"
        aria-label="Supprimer définitivement"
        className={`inline-flex items-center justify-center h-7 w-7 rounded-md border border-red-300 bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50 ${className}`}
      >
        {busy ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
      </button>
    );
  }

  return (
    <button
      onClick={handle}
      disabled={busy}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-red-300 bg-red-50 text-red-700 text-xs font-semibold hover:bg-red-100 transition-colors disabled:opacity-50 ${className}`}
    >
      {busy ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
      Supprimer définitivement
    </button>
  );
}
