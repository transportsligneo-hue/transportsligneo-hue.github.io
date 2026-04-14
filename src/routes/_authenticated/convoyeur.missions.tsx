import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { MapPin, Calendar, Car, Loader2, Play, Square, ClipboardCheck, FileText } from "lucide-react";
import { useGpsTracking } from "@/hooks/useGpsTracking";
import { InspectionGuidee } from "@/components/InspectionGuidee";
import { MissionDocuments } from "@/components/MissionDocuments";

export const Route = createFileRoute("/_authenticated/convoyeur/missions")({
  component: ConvoyeurMissions,
});

interface Mission {
  id: string;
  statut: string;
  trajet_id: string;
  trajet: {
    depart: string;
    arrivee: string;
    date_trajet: string | null;
    heure_trajet: string | null;
    marque: string | null;
    modele: string | null;
    immatriculation: string | null;
  } | null;
  inspectionDepart?: boolean;
  inspectionArrivee?: boolean;
}

function ConvoyeurMissions() {
  const { user } = useAuth();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMissionId, setActiveMissionId] = useState<string | null>(null);
  const [inspection, setInspection] = useState<{ attributionId: string; type: "depart" | "arrivee" } | null>(null);
  const [expandedDocs, setExpandedDocs] = useState<string | null>(null);

  // GPS tracking: active only during an en_cours mission
  useGpsTracking({ attributionId: activeMissionId, active: !!activeMissionId });

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

        // Check existing inspections
        const { data: inspections } = await supabase
          .from("inspections")
          .select("type, statut")
          .eq("attribution_id", attr.id);

        const inspDepart = inspections?.some(i => i.type === "depart" && i.statut === "complete");
        const inspArrivee = inspections?.some(i => i.type === "arrivee" && i.statut === "complete");

        enriched.push({
          id: attr.id,
          statut: attr.statut,
          trajet_id: attr.trajet_id,
          trajet,
          inspectionDepart: !!inspDepart,
          inspectionArrivee: !!inspArrivee,
        });

        if (attr.statut === "en_cours") setActiveMissionId(attr.id);
      }
      setMissions(enriched);
    }
    setLoading(false);
  };

  useEffect(() => { fetchMissions(); }, [user]);

  const updateStatus = async (id: string, statut: string) => {
    await supabase.from("attributions").update({ statut }).eq("id", id);
    if (statut === "en_cours") setActiveMissionId(id);
    if (statut === "termine") setActiveMissionId(null);
    fetchMissions();
  };

  const startMission = (missionId: string) => {
    // Must do inspection depart first
    const mission = missions.find(m => m.id === missionId);
    if (mission && !mission.inspectionDepart) {
      setInspection({ attributionId: missionId, type: "depart" });
    } else {
      updateStatus(missionId, "en_cours");
    }
  };

  const finishMission = (missionId: string) => {
    const mission = missions.find(m => m.id === missionId);
    if (mission && !mission.inspectionArrivee) {
      setInspection({ attributionId: missionId, type: "arrivee" });
    } else {
      updateStatus(missionId, "termine");
    }
  };

  const handleInspectionComplete = () => {
    if (!inspection) return;
    if (inspection.type === "depart") {
      updateStatus(inspection.attributionId, "en_cours");
    } else {
      updateStatus(inspection.attributionId, "termine");
    }
    setInspection(null);
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

  if (inspection && user) {
    return (
      <InspectionGuidee
        attributionId={inspection.attributionId}
        type={inspection.type}
        userId={user.id}
        onComplete={handleInspectionComplete}
        onCancel={() => setInspection(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl text-primary tracking-[0.1em] uppercase">Mes missions</h1>

      {activeMissionId && (
        <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded text-green-300 text-xs">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          GPS actif — Position transmise en temps réel
        </div>
      )}

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

              {/* Inspection status */}
              <div className="flex gap-3 text-xs">
                <span className={`flex items-center gap-1 ${m.inspectionDepart ? "text-green-400" : "text-cream/30"}`}>
                  <ClipboardCheck size={12} /> Départ {m.inspectionDepart ? "✓" : "—"}
                </span>
                <span className={`flex items-center gap-1 ${m.inspectionArrivee ? "text-green-400" : "text-cream/30"}`}>
                  <ClipboardCheck size={12} /> Arrivée {m.inspectionArrivee ? "✓" : "—"}
                </span>
              </div>

              <div className="flex gap-2 pt-2 flex-wrap">
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
                  <button onClick={() => startMission(m.id)} className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-500/20 text-blue-300 text-xs rounded hover:bg-blue-500/30 transition-colors">
                    <Play size={12} /> Démarrer la mission
                  </button>
                )}
                {m.statut === "en_cours" && (
                  <button onClick={() => finishMission(m.id)} className="flex items-center gap-1.5 px-4 py-1.5 bg-green-500/20 text-green-300 text-xs rounded hover:bg-green-500/30 transition-colors">
                    <Square size={12} /> Terminer la mission
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
