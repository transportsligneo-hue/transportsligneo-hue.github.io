import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { MapPin, Calendar, Car, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/convoyeur/missions")({
  component: ConvoyeurMissions,
});

interface Mission {
  id: string;
  statut: string;
  trajet: {
    depart: string;
    arrivee: string;
    date_trajet: string | null;
    heure_trajet: string | null;
    marque: string | null;
    modele: string | null;
    immatriculation: string | null;
  } | null;
}

function ConvoyeurMissions() {
  const { user } = useAuth();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMissions = async () => {
    if (!user) return;
    const { data: conv } = await supabase
      .from("convoyeurs")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!conv) { setLoading(false); return; }

    const { data } = await supabase
      .from("attributions")
      .select("id, statut, trajet_id")
      .eq("convoyeur_id", conv.id)
      .in("statut", ["propose", "accepte", "en_cours"]);

    if (data) {
      const enriched: Mission[] = [];
      for (const attr of data) {
        const { data: trajet } = await supabase
          .from("trajets")
          .select("depart, arrivee, date_trajet, heure_trajet, marque, modele, immatriculation")
          .eq("id", attr.trajet_id)
          .single();
        enriched.push({ id: attr.id, statut: attr.statut, trajet });
      }
      setMissions(enriched);
    }
    setLoading(false);
  };

  useEffect(() => { fetchMissions(); }, [user]);

  const updateStatus = async (id: string, statut: string) => {
    await supabase.from("attributions").update({ statut }).eq("id", id);
    fetchMissions();
  };

  const statusLabel: Record<string, string> = {
    propose: "Proposée",
    accepte: "Acceptée",
    en_cours: "En cours",
  };

  const statusColor: Record<string, string> = {
    propose: "bg-yellow-500/20 text-yellow-300",
    accepte: "bg-blue-500/20 text-blue-300",
    en_cours: "bg-green-500/20 text-green-300",
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" size={24} /></div>;

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl text-primary tracking-[0.1em] uppercase">Mes missions</h1>

      {missions.length === 0 ? (
        <p className="text-cream/50 text-sm">Aucune mission en cours.</p>
      ) : (
        <div className="space-y-4">
          {missions.map((m) => (
            <div key={m.id} className="card-premium p-5 rounded space-y-3">
              <div className="flex items-center justify-between">
                <span className={`text-xs px-2 py-1 rounded ${statusColor[m.statut] || ""}`}>
                  {statusLabel[m.statut] || m.statut}
                </span>
                {m.trajet?.date_trajet && (
                  <span className="text-cream/50 text-xs flex items-center gap-1">
                    <Calendar size={12} /> {m.trajet.date_trajet}
                    {m.trajet.heure_trajet && ` à ${m.trajet.heure_trajet}`}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 text-sm">
                <MapPin size={14} className="text-primary" />
                <span className="text-cream">{m.trajet?.depart}</span>
                <span className="text-cream/30">→</span>
                <span className="text-cream">{m.trajet?.arrivee}</span>
              </div>

              {(m.trajet?.marque || m.trajet?.immatriculation) && (
                <div className="flex items-center gap-2 text-xs text-cream/50">
                  <Car size={12} />
                  {[m.trajet.marque, m.trajet.modele, m.trajet.immatriculation].filter(Boolean).join(" · ")}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                {m.statut === "propose" && (
                  <>
                    <button onClick={() => updateStatus(m.id, "accepte")} className="px-4 py-1.5 bg-primary/20 text-primary text-xs rounded hover:bg-primary/30 transition-colors">
                      Accepter
                    </button>
                    <button onClick={() => updateStatus(m.id, "refuse")} className="px-4 py-1.5 bg-destructive/20 text-destructive text-xs rounded hover:bg-destructive/30 transition-colors">
                      Refuser
                    </button>
                  </>
                )}
                {m.statut === "accepte" && (
                  <button onClick={() => updateStatus(m.id, "en_cours")} className="px-4 py-1.5 bg-blue-500/20 text-blue-300 text-xs rounded hover:bg-blue-500/30 transition-colors">
                    Démarrer la mission
                  </button>
                )}
                {m.statut === "en_cours" && (
                  <button onClick={() => updateStatus(m.id, "termine")} className="px-4 py-1.5 bg-green-500/20 text-green-300 text-xs rounded hover:bg-green-500/30 transition-colors">
                    Mission terminée
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
