import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { MapPin, Calendar, CheckCircle, XCircle, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/convoyeur/historique")({
  component: ConvoyeurHistorique,
});

interface HistoryItem {
  id: string;
  statut: string;
  created_at: string;
  trajet: {
    depart: string;
    arrivee: string;
    date_trajet: string | null;
    marque: string | null;
    modele: string | null;
  } | null;
}

function ConvoyeurHistorique() {
  const { user } = useAuth();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: conv } = await supabase
        .from("convoyeurs")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!conv) { setLoading(false); return; }

      const { data } = await supabase
        .from("attributions")
        .select("id, statut, created_at, trajet_id")
        .eq("convoyeur_id", conv.id)
        .in("statut", ["termine", "refuse"])
        .order("created_at", { ascending: false });

      if (data) {
        const items: HistoryItem[] = [];
        for (const attr of data) {
          const { data: trajet } = await supabase
            .from("trajets")
            .select("depart, arrivee, date_trajet, marque, modele")
            .eq("id", attr.trajet_id)
            .single();
          items.push({ id: attr.id, statut: attr.statut, created_at: attr.created_at, trajet });
        }
        setHistory(items);
      }
      setLoading(false);
    })();
  }, [user]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" size={24} /></div>;

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl text-primary tracking-[0.1em] uppercase">Historique</h1>

      {history.length === 0 ? (
        <p className="text-cream/50 text-sm">Aucun historique pour le moment.</p>
      ) : (
        <div className="space-y-3">
          {history.map((h) => (
            <div key={h.id} className="card-premium p-4 rounded flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <MapPin size={14} className="text-primary" />
                  <span className="text-cream">{h.trajet?.depart}</span>
                  <span className="text-cream/30">→</span>
                  <span className="text-cream">{h.trajet?.arrivee}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-cream/40">
                  {h.trajet?.date_trajet && (
                    <span className="flex items-center gap-1"><Calendar size={10} /> {h.trajet.date_trajet}</span>
                  )}
                  {h.trajet?.marque && <span>{h.trajet.marque} {h.trajet.modele}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {h.statut === "termine" ? (
                  <><CheckCircle size={14} className="text-green-400" /><span className="text-green-400 text-xs">Terminée</span></>
                ) : (
                  <><XCircle size={14} className="text-red-400" /><span className="text-red-400 text-xs">Refusée</span></>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
