import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState, useCallback } from "react";
import {
  MapPin, Calendar, Car, Loader2, Play, Square, ClipboardCheck,
  FileText, Navigation, Clock, ChevronDown, ChevronUp,
} from "lucide-react";
import { useGpsTracking } from "@/hooks/useGpsTracking";
import { InspectionGuidee } from "@/components/InspectionGuidee";
import { MissionDocuments } from "@/components/MissionDocuments";
import { GpsMapView } from "@/components/GpsMapView";

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
    tarif_convoyeur: number | null;
  } | null;
  inspectionDepart?: boolean;
  inspectionArrivee?: boolean;
}

interface GpsPoint {
  latitude: number;
  longitude: number;
  recorded_at: string;
  accuracy: number | null;
}

function ConvoyeurMissions() {
  const { user } = useAuth();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMissionId, setActiveMissionId] = useState<string | null>(null);
  const [inspection, setInspection] = useState<{ attributionId: string; type: "depart" | "arrivee" } | null>(null);
  const [expandedDocs, setExpandedDocs] = useState<string | null>(null);
  const [gpsPoints, setGpsPoints] = useState<GpsPoint[]>([]);
  const [showMap, setShowMap] = useState(false);
  const [missionStartTime, setMissionStartTime] = useState<string | null>(null);
  const [typeConvoyeur, setTypeConvoyeur] = useState<string>("salarie");

  useGpsTracking({ attributionId: activeMissionId, active: !!activeMissionId });

  const fetchMissions = useCallback(async () => {
    if (!user) return;
    const { data: conv } = await supabase
      .from("convoyeurs")
      .select("id, type_convoyeur")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!conv) { setLoading(false); return; }
    setTypeConvoyeur(conv.type_convoyeur || "salarie");

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
          .select("depart, arrivee, date_trajet, heure_trajet, marque, modele, immatriculation, tarif_convoyeur")
          .eq("id", attr.trajet_id)
          .maybeSingle();

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

        if (attr.statut === "en_cours") {
          setActiveMissionId(attr.id);
          setShowMap(true);
        }
      }
      setMissions(enriched);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchMissions(); }, [fetchMissions]);

  // GPS points for active mission
  useEffect(() => {
    if (!activeMissionId) { setGpsPoints([]); return; }
    const fetchPoints = async () => {
      const { data } = await supabase
        .from("mission_locations")
        .select("latitude, longitude, recorded_at, accuracy")
        .eq("attribution_id", activeMissionId)
        .order("recorded_at", { ascending: true });
      if (data) {
        setGpsPoints(data as GpsPoint[]);
        if (data.length > 0) setMissionStartTime(data[0].recorded_at);
      }
    };
    fetchPoints();

    const channel = supabase
      .channel(`gps-convoyeur-${activeMissionId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "mission_locations",
        filter: `attribution_id=eq.${activeMissionId}`,
      }, (payload) => {
        const newPoint = payload.new as unknown as GpsPoint;
        setGpsPoints(prev => [...prev, newPoint]);
        if (!missionStartTime) setMissionStartTime(newPoint.recorded_at);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeMissionId, missionStartTime]);

  const updateStatus = async (id: string, statut: string) => {
    await supabase.from("attributions").update({ statut }).eq("id", id);
    if (statut === "en_cours") { setActiveMissionId(id); setShowMap(true); }
    if (statut === "termine") { setActiveMissionId(null); setShowMap(false); }
    fetchMissions();
  };

  const startMission = (missionId: string) => {
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

  const getDuration = () => {
    if (!missionStartTime) return null;
    const start = new Date(missionStartTime).getTime();
    const diff = Math.floor((Date.now() - start) / 1000);
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    return h > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${m} min`;
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-emerald-600" size={24} /></div>;

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

  const activeMission = missions.find(m => m.statut === "en_cours");
  const otherMissions = missions.filter(m => m.statut !== "en_cours");
  const lastPoint = gpsPoints.length > 0 ? gpsPoints[gpsPoints.length - 1] : null;

  const statusLabel: Record<string, string> = { propose: "Proposée", accepte: "Acceptée", en_cours: "En cours" };
  const statusStyle: Record<string, string> = {
    propose: "bg-amber-50 text-amber-700 border-amber-200",
    accepte: "bg-blue-50 text-blue-700 border-blue-200",
    en_cours: "bg-emerald-50 text-emerald-700 border-emerald-200",
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl sm:text-2xl font-semibold text-pro-text">Mes missions</h1>

      {/* === ACTIVE MISSION === */}
      {activeMission && (
        <div className="space-y-3">
          {/* Live status bar */}
          <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl">
            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <div className="flex-1">
              <p className="text-emerald-800 text-sm font-medium">Mission en cours</p>
              <p className="text-emerald-600 text-xs">
                GPS actif · {gpsPoints.length} position{gpsPoints.length > 1 ? "s" : ""}
                {getDuration() && ` · ${getDuration()}`}
              </p>
            </div>
            <Navigation size={18} className="text-emerald-600" />
          </div>

          {/* Route info card */}
          <div className="bg-white rounded-xl border border-pro-border p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center gap-1 pt-1">
                <div className="w-3 h-3 rounded-full border-2 border-emerald-500 bg-emerald-100" />
                <div className="w-0.5 h-8 bg-pro-border" />
                <div className="w-3 h-3 rounded-full border-2 border-blue-500 bg-blue-100" />
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <p className="text-pro-muted text-[10px] uppercase tracking-wider font-medium">Départ</p>
                  <p className="text-pro-text text-sm">{activeMission.trajet?.depart}</p>
                </div>
                <div>
                  <p className="text-pro-muted text-[10px] uppercase tracking-wider font-medium">Arrivée</p>
                  <p className="text-pro-text text-sm">{activeMission.trajet?.arrivee}</p>
                </div>
              </div>
            </div>

            {(activeMission.trajet?.marque || activeMission.trajet?.immatriculation) && (
              <div className="mt-3 pt-3 border-t border-pro-border flex items-center gap-2 text-xs text-pro-text-soft">
                <Car size={12} />
                {[activeMission.trajet.marque, activeMission.trajet.modele, activeMission.trajet.immatriculation].filter(Boolean).join(" · ")}
              </div>
            )}

            {typeConvoyeur === "independant" && activeMission.trajet?.tarif_convoyeur != null && (
              <div className="mt-2 pt-2 border-t border-pro-border flex items-center justify-between">
                <span className="text-pro-muted text-xs uppercase tracking-wider">Tarif mission</span>
                <span className="text-emerald-700 font-bold text-base">{activeMission.trajet.tarif_convoyeur} €</span>
              </div>
            )}
          </div>

          {/* Map toggle */}
          <button
            onClick={() => setShowMap(!showMap)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-pro-text border border-pro-border rounded-xl text-sm hover:bg-pro-bg-soft transition-colors"
          >
            <MapPin size={14} />
            {showMap ? "Masquer la carte" : "Voir la carte en direct"}
            {showMap ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showMap && (
            <div className="space-y-2">
              <GpsMapView points={gpsPoints} className="h-[280px] md:h-[400px] rounded-xl overflow-hidden" />
              {lastPoint && (
                <div className="flex items-center justify-between text-[10px] text-pro-muted px-1">
                  <span className="flex items-center gap-1">
                    <Clock size={10} />
                    Dernière position: {new Date(lastPoint.recorded_at).toLocaleTimeString("fr-FR")}
                  </span>
                  {lastPoint.accuracy && <span>Précision: ±{Math.round(lastPoint.accuracy)}m</span>}
                </div>
              )}
            </div>
          )}

          {/* Inspections status */}
          <div className="flex gap-3 text-xs px-1">
            <span className={`flex items-center gap-1 ${activeMission.inspectionDepart ? "text-emerald-600" : "text-pro-muted"}`}>
              <ClipboardCheck size={12} /> Départ {activeMission.inspectionDepart ? "✓" : "—"}
            </span>
            <span className={`flex items-center gap-1 ${activeMission.inspectionArrivee ? "text-emerald-600" : "text-pro-muted"}`}>
              <ClipboardCheck size={12} /> Arrivée {activeMission.inspectionArrivee ? "✓" : "—"}
            </span>
          </div>

          {/* Action button */}
          <button
            onClick={() => finishMission(activeMission.id)}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-emerald-600 text-white rounded-xl text-base font-semibold hover:bg-emerald-700 transition-colors active:scale-[0.98]"
          >
            <Square size={20} /> Terminer la mission
          </button>

          {/* Documents */}
          {user && (
            <div className="bg-white rounded-xl border border-pro-border p-4">
              <button
                onClick={() => setExpandedDocs(expandedDocs === activeMission.id ? null : activeMission.id)}
                className="flex items-center gap-2 text-sm text-pro-text-soft hover:text-pro-text transition-colors w-full"
              >
                <FileText size={14} />
                Documents de mission
                <span className="ml-auto text-xs">{expandedDocs === activeMission.id ? "▲" : "▼"}</span>
              </button>
              {expandedDocs === activeMission.id && (
                <div className="mt-3">
                  <MissionDocuments attributionId={activeMission.id} userId={user.id} />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* === OTHER MISSIONS === */}
      {otherMissions.length > 0 && (
        <div className="space-y-3">
          {activeMission && <h2 className="text-pro-muted text-xs uppercase tracking-wider font-medium mt-4">Autres missions</h2>}
          {otherMissions.map((m) => (
            <div key={m.id} className="bg-white rounded-xl border border-pro-border p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${statusStyle[m.statut] || "bg-pro-bg-soft text-pro-text border-pro-border"}`}>
                  {statusLabel[m.statut] || m.statut}
                </span>
                {m.trajet?.date_trajet && (
                  <span className="text-pro-text-soft text-xs flex items-center gap-1">
                    <Calendar size={12} /> {m.trajet.date_trajet}
                    {m.trajet.heure_trajet && ` à ${m.trajet.heure_trajet}`}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 text-sm">
                <MapPin size={14} className="text-emerald-600 shrink-0" />
                <span className="text-pro-text">{m.trajet?.depart}</span>
                <span className="text-pro-muted">→</span>
                <span className="text-pro-text">{m.trajet?.arrivee}</span>
              </div>

              {(m.trajet?.marque || m.trajet?.immatriculation) && (
                <div className="flex items-center gap-2 text-xs text-pro-text-soft">
                  <Car size={12} />
                  {[m.trajet.marque, m.trajet.modele, m.trajet.immatriculation].filter(Boolean).join(" · ")}
                </div>
              )}

              {typeConvoyeur === "independant" && m.trajet?.tarif_convoyeur != null && (
                <div className="flex items-center justify-between text-sm bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-100">
                  <span className="text-pro-text-soft text-xs font-medium uppercase tracking-wider">Tarif proposé</span>
                  <span className="text-emerald-700 font-bold">{m.trajet.tarif_convoyeur} €</span>
                </div>
              )}

              <div className="flex gap-3 text-xs">
                <span className={`flex items-center gap-1 ${m.inspectionDepart ? "text-emerald-600" : "text-pro-muted"}`}>
                  <ClipboardCheck size={12} /> Départ {m.inspectionDepart ? "✓" : "—"}
                </span>
                <span className={`flex items-center gap-1 ${m.inspectionArrivee ? "text-emerald-600" : "text-pro-muted"}`}>
                  <ClipboardCheck size={12} /> Arrivée {m.inspectionArrivee ? "✓" : "—"}
                </span>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 pt-1">
                {m.statut === "propose" && (
                  <>
                    <button
                      onClick={() => updateStatus(m.id, "accepte")}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors active:scale-[0.98]"
                    >
                      Accepter
                    </button>
                    <button
                      onClick={() => updateStatus(m.id, "refuse")}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white text-red-600 border border-red-200 rounded-lg text-sm font-semibold hover:bg-red-50 transition-colors active:scale-[0.98]"
                    >
                      Refuser
                    </button>
                  </>
                )}
                {m.statut === "accepte" && (
                  <button
                    onClick={() => startMission(m.id)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors active:scale-[0.98]"
                  >
                    <Play size={16} /> Démarrer la mission
                  </button>
                )}
              </div>

              {/* Documents */}
              {(m.statut === "accepte" || m.statut === "en_cours") && user && (
                <div className="pt-2 border-t border-pro-border">
                  <button
                    onClick={() => setExpandedDocs(expandedDocs === m.id ? null : m.id)}
                    className="flex items-center gap-1.5 text-xs text-pro-text-soft hover:text-pro-text transition-colors w-full"
                  >
                    <FileText size={12} />
                    Documents
                    <span className="ml-auto text-[10px]">{expandedDocs === m.id ? "▲" : "▼"}</span>
                  </button>
                  {expandedDocs === m.id && (
                    <div className="mt-3">
                      <MissionDocuments attributionId={m.id} userId={user.id} />
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {missions.length === 0 && (
        <div className="bg-white rounded-xl border border-pro-border p-8 text-center shadow-sm">
          <Truck size={32} className="mx-auto text-pro-muted mb-3" />
          <p className="text-pro-text-soft text-sm">Aucune mission en cours.</p>
          <p className="text-pro-muted text-xs mt-1">Vos nouvelles missions apparaîtront ici.</p>
        </div>
      )}
    </div>
  );
}
