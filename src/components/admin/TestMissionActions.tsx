import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FlaskConical, Loader2, Trash2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { confirmToast } from "@/lib/confirm-toast";

/**
 * Bouton "Créer une mission test" · appelle la RPC admin_create_test_mission.
 * Réservé aux administrateurs (contrôle côté RPC). La mission créée est marquée
 * is_test_data=true, invisible côté client/convoyeur "normal", supprimable en un clic.
 *
 * Option "Attribuer à…" : si un convoyeur validé est choisi, l'attribution est
 * créée immédiatement en mode 'directe' → statut convoyeur 'en_attente'. Le
 * convoyeur peut alors accepter/refuser la mission depuis son dashboard, ce qui
 * permet de tester l'intégralité du parcours (scan, EDL, etc.).
 */
interface ConvoyeurOption {
  id: string;
  label: string;
}

export function CreateTestMissionButton({ onCreated }: { onCreated?: (trajetId: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [convoyeurs, setConvoyeurs] = useState<ConvoyeurOption[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  const loadConvoyeurs = async () => {
    setLoadingList(true);
    const { data } = await supabase
      .from("convoyeurs")
      .select("id, nom, prenom, email, statut")
      .eq("statut", "valide")
      .order("nom", { ascending: true })
      .limit(100);
    setConvoyeurs(
      (data ?? []).map((c) => ({
        id: c.id,
        label: `${c.prenom ?? ""} ${c.nom ?? ""}`.trim() || c.email || "Convoyeur",
      })),
    );
    setLoadingList(false);
  };

  useEffect(() => { if (pickerOpen && convoyeurs.length === 0) void loadConvoyeurs(); }, [pickerOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = async (targetConvoyeurId?: string) => {
    setBusy(true);
    setPickerOpen(false);
    const { data, error } = await supabase.rpc("admin_create_test_mission", {
      _target_convoyeur_id: targetConvoyeurId ?? undefined,
    });
    setBusy(false);
    if (error) {
      toast.error("Impossible de créer la mission test", { description: error.message });
      return;
    }
    toast.success(
      targetConvoyeurId
        ? "Mission test attribuée · le convoyeur peut l'accepter"
        : "Mission test publiée au catalogue",
    );
    onCreated?.(data as string);
  };

  return (
    <div className="relative inline-flex items-center gap-1">
      <button
        onClick={() => handleCreate()}
        disabled={busy}
        title="Publie une mission fictive au catalogue (TEST · invisible côté client)"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-l-lg border border-amber-300 bg-amber-50 text-amber-800 text-xs font-semibold hover:bg-amber-100 transition-colors disabled:opacity-50"
      >
        {busy ? <Loader2 size={13} className="animate-spin" /> : <FlaskConical size={13} />}
        Créer mission test
      </button>
      <button
        onClick={() => setPickerOpen((v) => !v)}
        disabled={busy}
        title="Attribuer directement à un convoyeur pour tester le parcours complet"
        className="px-1.5 py-1.5 rounded-r-lg border border-l-0 border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 disabled:opacity-50"
        aria-label="Attribuer à un convoyeur"
      >
        <ChevronDown size={13} />
      </button>

      {pickerOpen && (
        <div className="absolute z-50 top-full right-0 mt-1 w-72 rounded-lg border border-amber-200 bg-white shadow-xl overflow-hidden">
          <div className="px-3 py-2 text-[11px] font-semibold text-amber-900 border-b border-amber-100 bg-amber-50/60">
            Attribuer la mission test à…
          </div>
          {loadingList ? (
            <div className="p-4 flex items-center justify-center text-slate-500">
              <Loader2 size={14} className="animate-spin" />
            </div>
          ) : convoyeurs.length === 0 ? (
            <p className="p-4 text-xs text-slate-500">Aucun convoyeur validé.</p>
          ) : (
            <ul className="max-h-64 overflow-y-auto">
              {convoyeurs.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => handleCreate(c.id)}
                    className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-amber-50"
                  >
                    {c.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/** Badge visuel "TEST" à afficher sur toute ligne de mission is_test_data=true */
export function TestBadge() {
  return (
    <span
      title="Mission de test · invisible côté client"
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
