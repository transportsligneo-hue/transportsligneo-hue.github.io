import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FlaskConical, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { confirmToast } from "@/lib/confirm-toast";

/**
 * Bouton "Créer une mission test" — appelle la RPC admin_create_test_mission.
 * Réservé aux administrateurs (contrôle côté RPC). La mission créée est marquée
 * is_test_data=true, invisible côté client/convoyeur et supprimable en un clic.
 */
export function CreateTestMissionButton({ onCreated }: { onCreated?: (trajetId: string) => void }) {
  const [busy, setBusy] = useState(false);

  const handleCreate = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("admin_create_test_mission");
    setBusy(false);
    if (error) {
      toast.error("Impossible de créer la mission test", { description: error.message });
      return;
    }
    toast.success("Mission test créée");
    onCreated?.(data as string);
  };

  return (
    <button
      onClick={handleCreate}
      disabled={busy}
      title="Génère une mission fictive marquée TEST — invisible côté client et convoyeur"
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-xs font-semibold hover:bg-amber-100 transition-colors disabled:opacity-50"
    >
      {busy ? <Loader2 size={13} className="animate-spin" /> : <FlaskConical size={13} />}
      Créer mission test
    </button>
  );
}

/** Badge visuel "TEST" à afficher sur toute ligne de mission is_test_data=true */
export function TestBadge() {
  return (
    <span
      title="Mission de test — invisible côté client et convoyeur"
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold border border-amber-400 bg-amber-100 text-amber-900 tracking-wider"
    >
      <FlaskConical size={9} /> TEST
    </span>
  );
}

/** Bouton de suppression en un clic, garde-fou côté RPC (is_test_data=true requis) */
export function DeleteTestMissionButton({
  trajetId,
  onDeleted,
  compact = false,
}: {
  trajetId: string;
  onDeleted?: () => void;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);

  const handleDelete = async () => {
    if (!(await confirmToast("Supprimer définitivement cette mission test et toutes ses données liées ?"))) return;
    setBusy(true);
    const { error } = await supabase.rpc("admin_delete_test_mission", { _trajet_id: trajetId });
    setBusy(false);
    if (error) {
      toast.error("Suppression impossible", { description: error.message });
      return;
    }
    toast.success("Mission test supprimée");
    onDeleted?.();
  };

  if (compact) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); void handleDelete(); }}
        disabled={busy}
        title="Supprimer la mission test"
        className="inline-flex items-center justify-center h-7 w-7 rounded-md border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
      >
        {busy ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
      </button>
    );
  }

  return (
    <button
      onClick={(e) => { e.stopPropagation(); void handleDelete(); }}
      disabled={busy}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-red-200 bg-red-50 text-red-700 text-xs font-medium hover:bg-red-100 transition-colors disabled:opacity-50"
    >
      {busy ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
      Supprimer test
    </button>
  );
}
