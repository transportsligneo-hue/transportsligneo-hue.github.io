import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { MapPin, Calendar, CheckCircle, XCircle, Loader2, History } from "lucide-react";

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

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-emerald-600" size={24} /></div>;

  return (
    <div className="space-y-5">
      <h1 className="text-xl sm:text-2xl font-semibold text-pro-text">Historique</h1>

      {history.length === 0 ? (
        <div className="bg-white rounded-xl border border-pro-border p-8 text-center shadow-sm">
          <History size={32} className="mx-auto text-pro-muted mb-3" />
          <p className="text-pro-text-soft text-sm">Aucun historique pour le moment.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {history.map((h) => (
            <div key={h.id} className="bg-white rounded-xl border border-pro-border p-4 flex items-center justify-between shadow-sm">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 text-sm">
                  <MapPin size={14} className="text-emerald-600 shrink-0" />
                  <span className="text-pro-text truncate">{h.trajet?.depart}</span>
                  <span className="text-pro-muted shrink-0">→</span>
                  <span className="text-pro-text truncate">{h.trajet?.arrivee}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-pro-muted">
                  {h.trajet?.date_trajet && (
                    <span className="flex items-center gap-1"><Calendar size={10} /> {h.trajet.date_trajet}</span>
                  )}
                  {h.trajet?.marque && <span>{h.trajet.marque} {h.trajet.modele}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                {h.statut === "termine" ? (
                  <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                    <CheckCircle size={12} /> Terminée
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-red-50 text-red-700 border border-red-200 font-medium">
                    <XCircle size={12} /> Refusée
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
