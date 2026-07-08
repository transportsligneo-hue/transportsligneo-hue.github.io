import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CheckCircle2, XCircle, Clock, MapPin, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

interface Proposal {
  id: string;
  trajet_id: string;
  created_at: string;
  trajet?: {
    depart: string; arrivee: string; date_trajet: string | null;
    prix_convoyeur_fixe: number | null; prix_convoyeur: number | null;
    proposal_expires_at: string | null;
  };
}

/**
 * Affiche les missions proposées au convoyeur en attente de sa réponse (mode direct).
 * À inclure sur le dashboard convoyeur.
 */
export function PendingProposalsBanner() {
  const { user } = useAuth();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [convoyeurId, setConvoyeurId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("convoyeurs").select("id").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setConvoyeurId((data as { id?: string } | null)?.id ?? null));
  }, [user]);

  const fetchData = async () => {
    if (!convoyeurId) return;
    const { data } = await supabase
      .from("attributions")
      .select("id,trajet_id,created_at, trajet:trajets(depart,arrivee,date_trajet,prix_convoyeur_fixe,prix_convoyeur,proposal_expires_at)")
      .eq("convoyeur_id", convoyeurId)
      .eq("statut", "propose")
      .order("created_at", { ascending: false });
    setProposals((data ?? []) as unknown as Proposal[]);
  };

  useEffect(() => { fetchData(); }, [convoyeurId]);

  useEffect(() => {
    if (!convoyeurId) return;
    const ch = supabase
      .channel(`prop-conv-${convoyeurId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "attributions", filter: `convoyeur_id=eq.${convoyeurId}` }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convoyeurId]);

  const respond = async (id: string, accept: boolean) => {
    const reason = accept ? undefined : (prompt("Motif du refus (facultatif) :", "") || undefined);
    setBusy(id);
    const { error } = await supabase.rpc("driver_respond_to_proposal", {
      _attribution_id: id, _accept: accept, _reason: reason,
    });
    setBusy(null);
    if (error) toast.error(error.message);
    else { toast.success(accept ? "Mission acceptée !" : "Mission refusée"); fetchData(); }
  };

  if (proposals.length === 0) return null;

  return (
    <div className="mb-5 rounded-2xl border-2 border-pro-gold bg-gradient-to-br from-amber-50 to-white p-5 shadow-pro-elevated">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-pro-text flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full rounded-full opacity-70 animate-ping bg-amber-500" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
          </span>
          📌 {proposals.length} mission{proposals.length > 1 ? "s" : ""} proposée{proposals.length > 1 ? "s" : ""}
        </h2>
      </div>
      <div className="space-y-2">
        {proposals.map((p) => {
          const price = p.trajet?.prix_convoyeur_fixe ?? p.trajet?.prix_convoyeur ?? 0;
          const expiresAt = p.trajet?.proposal_expires_at ? new Date(p.trajet.proposal_expires_at) : null;
          const hoursLeft = expiresAt ? Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 3600000)) : null;
          return (
            <div key={p.id} className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-white border border-pro-border">
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-2 text-sm font-semibold text-pro-text">
                  <MapPin size={14} className="text-emerald-600" />
                  {p.trajet?.depart} → {p.trajet?.arrivee}
                </div>
                <div className="text-xs text-pro-text-soft mt-0.5 flex items-center gap-2">
                  <span className="font-bold text-pro-text">{price.toFixed(0)} €</span>
                  {hoursLeft !== null && (
                    <span className="flex items-center gap-1"><Clock size={11} /> Répondre sous {hoursLeft}h</span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button disabled={busy === p.id} onClick={() => respond(p.id, true)}
                  className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1">
                  {busy === p.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Accepter
                </button>
                <button disabled={busy === p.id} onClick={() => respond(p.id, false)}
                  className="px-3 py-2 rounded-lg bg-red-50 text-red-700 border border-red-200 text-sm font-semibold hover:bg-red-100 disabled:opacity-50 flex items-center gap-1">
                  <XCircle size={14} /> Refuser
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 text-right">
        <Link to="/convoyeur/missions" className="text-xs text-pro-muted hover:text-pro-text">Voir toutes mes missions →</Link>
      </div>
    </div>
  );
}
