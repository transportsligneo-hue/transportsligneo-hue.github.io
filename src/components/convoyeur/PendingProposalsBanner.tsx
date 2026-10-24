import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { Ic, Plate } from "@/components/driver2/icons";

interface Trajet {
  depart: string | null; arrivee: string | null;
  date_trajet: string | null; heure_trajet: string | null;
  marque: string | null; modele: string | null; immatriculation: string | null;
  prix_convoyeur_fixe: number | null; prix_convoyeur: number | null; tarif_convoyeur: number | null;
  proposal_expires_at: string | null;
}
interface Proposal { id: string; trajet_id: string; created_at: string; trajet: Trajet | null }

const whenLabel = (t: Trajet | null) => {
  if (!t?.date_trajet) return "";
  const d = new Date(t.date_trajet);
  const day = d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
  return `${day}${t.heure_trajet ? ` · ${t.heure_trajet.slice(0, 5).replace(":", "h")}` : ""}`;
};

const deadlineLabel = (iso: string | null) => {
  if (!iso) return "";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "Délai dépassé";
  const h = Math.floor(ms / 3600000);
  if (h >= 48) return `Répondre sous ${Math.floor(h / 24)} j`;
  if (h >= 1) return `Répondre sous ${h} h`;
  return `Répondre sous ${Math.max(1, Math.floor(ms / 60000))} min`;
};

/**
 * Missions proposées au convoyeur, en attente de sa réponse (mode direct).
 * Une carte par mission : trajet, date, véhicule, rémunération, Accepter / Refuser.
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
      .select("id,trajet_id,created_at")
      .eq("convoyeur_id", convoyeurId)
      .eq("statut", "propose")
      .order("created_at", { ascending: false });
    const rows = (data ?? []) as unknown as Array<{ id: string; trajet_id: string; created_at: string }>;
    // Les détails passent par la vue sécurisée (le convoyeur n'a pas accès direct à « trajets »).
    const enriched = await Promise.all(rows.map(async (r) => {
      const { data: t } = await supabase
        .from("trajets_assigned_safe" as never)
        .select("depart, arrivee, date_trajet, heure_trajet, marque, modele, immatriculation, prix_convoyeur_fixe, prix_convoyeur, tarif_convoyeur, proposal_expires_at")
        .eq("id", r.trajet_id)
        .maybeSingle();
      return { ...r, trajet: (t as unknown as Trajet | null) ?? null } as Proposal;
    }));
    setProposals(enriched);
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
    <div className="pp2">
      <div className="pp2-h">
        <i className="pp2-pulse" />
        <b>{proposals.length} mission{proposals.length > 1 ? "s" : ""} proposée{proposals.length > 1 ? "s" : ""}</b>
      </div>
      {proposals.map((p) => {
        const t = p.trajet;
        const price = t?.prix_convoyeur_fixe ?? t?.tarif_convoyeur ?? t?.prix_convoyeur ?? null;
        const when = whenLabel(t);
        const left = deadlineLabel(t?.proposal_expires_at ?? null);
        const car = [t?.marque, t?.modele].filter(Boolean).join(" ");
        return (
          <div key={p.id} className="pp2-c">
            <div className="pp2-top">
              <span className="pp2-eb">Nouvelle mission</span>
              {left && <span className="pp2-left"><Ic n="clock" s={12} /> {left}</span>}
            </div>
            <div className="pp2-mid">
              <div className="nmr">
                <div className="nmr-s"><i className="nmr-d" /><div className="nmr-t"><small>Enlèvement</small><b>{t?.depart || "À préciser"}</b></div></div>
                <div className="nmr-s"><i className="nmr-d" /><div className="nmr-t"><small>Livraison</small><b>{t?.arrivee || "À préciser"}</b></div></div>
              </div>
              {price != null && (
                <div className="pp2-price"><small>Rémunération</small><b>{Math.round(price)} €</b></div>
              )}
            </div>
            <div className="pp2-tags">
              {when && <span className="chipx"><Ic n="clock" s={12} /> {when}</span>}
              {car && <span className="chipx"><Ic n="car" s={12} /> {car}</span>}
              <Plate p={t?.immatriculation} />
            </div>
            <div className="pp2-act">
              <button type="button" disabled={busy === p.id} onClick={() => respond(p.id, false)} className="pp2-no">Refuser</button>
              <button type="button" disabled={busy === p.id} onClick={() => respond(p.id, true)} className="pp2-ok">
                {busy === p.id ? "Envoi…" : "Accepter"}
              </button>
            </div>
          </div>
        );
      })}
      <Link to="/convoyeur/missions" className="pp2-all">Voir toutes mes missions <Ic n="arr" s={13} /></Link>
    </div>
  );
}
