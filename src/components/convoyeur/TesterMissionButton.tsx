import { useEffect, useState } from "react";
import { FlaskConical, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Bouton « Créer une mission test » : visible uniquement pour les comptes testeurs
 * (Google Play + Olivier). La mission est proposée au testeur, qui peut l'accepter
 * puis dérouler tout le parcours (enlèvement, état des lieux, livraison, PV).
 */
export function TesterMissionButton({ onCreated }: { onCreated?: () => void }) {
  const { user } = useAuth();
  const [isTester, setIsTester] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    void (supabase.from("convoyeurs").select("is_tester" as never).eq("user_id", user.id).maybeSingle() as unknown as Promise<{ data: { is_tester?: boolean } | null }>)
      .then(({ data }) => { if (alive) setIsTester(data?.is_tester === true); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [user]);

  if (!isTester) return null;

  const create = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("convoyeur_create_test_mission" as never);
    setBusy(false);
    if (error) { toast.error("Impossible de créer la mission test", { description: error.message }); return; }
    toast.success("Mission test créée : elle vous est proposée.");
    onCreated?.();
  };

  return (
    <button type="button" onClick={() => void create()} disabled={busy}
      className="w-full flex items-center justify-center gap-2 rounded-2xl border border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 active:scale-[.99] transition disabled:opacity-60">
      {busy ? <Loader2 size={16} className="animate-spin" /> : <FlaskConical size={16} />}
      Créer une mission test
    </button>
  );
}
