import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState, useCallback, useMemo } from "react";
import {
  MapPin, Loader2, FileText, Navigation, Clock,
  ChevronDown, ChevronUp, Truck, ArrowLeft, Search, Filter, Phone,
  Car, Calendar, Check, X,
} from "lucide-react";
import { useGpsTracking } from "@/hooks/useGpsTracking";
import { InspectionGuidee } from "@/components/InspectionGuidee";
import { InspectionVisuelle } from "@/components/inspection/InspectionVisuelle";
import { InspectionSequentielle } from "@/components/inspection/InspectionSequentielle";
import { MissionDocuments } from "@/components/MissionDocuments";
import { GpsMapView } from "@/components/GpsMapView";
import { MissionCard, type MissionCardData } from "@/components/convoyeur/MissionCard";
import { MissionWorkflow } from "@/components/convoyeur/MissionWorkflow";

export const Route = createFileRoute("/_authenticated/convoyeur/missions")({
  component: ConvoyeurMissions,
});

interface Mission extends MissionCardData {
  trajet_id: string;
}

interface GpsPoint {
  latitude: number;
  longitude: number;
  recorded_at: string;
  accuracy: number | null;
}

type FilterKey = "all" | "today" | "upcoming" | "in_progress" | "done";

function ConvoyeurMissions() {
  const { user } = useAuth();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMissionId, setActiveMissionId] = useState<string | null>(null);
  const [openMissionId, setOpenMissionId] = useState<string | null>(null);
  const [inspection, setInspection] = useState<{ attributionId: string; type: "depart" | "arrivee"; mode: "sequentiel" | "visuel" | "photos" } | null>(null);
  const [expandedDocs, setExpandedDocs] = useState(false);
  const [gpsPoints, setGpsPoints] = useState<GpsPoint[]>([]);
  const [showMap, setShowMap] = useState(false);
  const [missionStartTime, setMissionStartTime] = useState<string | null>(null);
  const [typeConvoyeur, setTypeConvoyeur] = useState<string>("salarie");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");

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
      .select("id, statut, trajet_id, etape_courante" as never)
      .eq("convoyeur_id", conv.id)
      .in("statut", ["propose", "accepte", "en_cours", "termine"]);

    if (data) {
      const enriched: Mission[] = [];
      for (const attr of data as unknown as Array<{ id: string; statut: string; trajet_id: string; etape_courante: string | null }>) {
        const { data: trajet } = await supabase
          .from("trajets")
          .select("depart, arrivee, date_trajet, heure_trajet, marque, modele, immatriculation, tarif_convoyeur, client_telephone")
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
          etape_courante: attr.etape_courante,
          trajet_id: attr.trajet_id,
          trajet,
          inspectionDepart: !!inspDepart,
          inspectionArrivee: !!inspArrivee,
        });

        if (attr.statut === "en_cours" && !activeMissionId) {
          setActiveMissionId(attr.id);
        }
      }
      setMissions(enriched);
    }
    setLoading(false);
  }, [user, activeMissionId]);

  useEffect(() => { fetchMissions(); }, [fetchMissions]);

  // GPS realtime
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

  const handleInspectionComplete = () => {
    if (!inspection) return;
    // Le workflow détecte la complétion via inspectionDepart/Arrivee + auto-avance
    fetchMissions();
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

  // Filtres
  const filtered = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    let list = missions;
    if (filter === "today") list = list.filter(m => m.trajet?.date_trajet === today);
    if (filter === "upcoming") list = list.filter(m => m.trajet?.date_trajet && m.trajet.date_trajet > today);
    if (filter === "in_progress") list = list.filter(m => m.statut === "en_cours");
    if (filter === "done") list = list.filter(m => m.statut === "termine");
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(m =>
        m.trajet?.depart?.toLowerCase().includes(q) ||
        m.trajet?.arrivee?.toLowerCase().includes(q) ||
        m.trajet?.immatriculation?.toLowerCase().includes(q) ||
        m.trajet?.marque?.toLowerCase().includes(q),
      );
    }
    return list;
  }, [missions, filter, search]);

  const openMission = openMissionId ? missions.find(m => m.id === openMissionId) : null;

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-emerald-600" size={24} /></div>;

  if (inspection && user) {
    if (inspection.mode === "visuel") {
      return (
        <InspectionVisuelle
          attributionId={inspection.attributionId}
          type={inspection.type}
          userId={user.id}
          onComplete={handleInspectionComplete}
          onCancel={() => setInspection(null)}
        />
      );
    }
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

  // === FICHE MISSION DÉTAILLÉE ===
  if (openMission) {
    const t = openMission.trajet;
    const isActive = openMission.id === activeMissionId;
    const lastPoint = gpsPoints.length > 0 ? gpsPoints[gpsPoints.length - 1] : null;

    return (
      <div className="space-y-4 pb-20">
        {/* Back bar */}
        <button
          onClick={() => setOpenMissionId(null)}
          className="flex items-center gap-1.5 text-pro-text-soft hover:text-pro-text text-sm py-1"
        >
          <ArrowLeft size={16} /> Retour aux missions
        </button>

        {/* Trajet card */}
        <div className="bg-white rounded-2xl border border-pro-border p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center gap-1 pt-1.5">
              <div className="w-3 h-3 rounded-full border-2 border-emerald-500 bg-emerald-100" />
              <div className="w-0.5 h-10 bg-pro-border" />
              <div className="w-3 h-3 rounded-full border-2 border-blue-500 bg-blue-100" />
            </div>
            <div className="flex-1 min-w-0 space-y-3">
              <div>
                <p className="text-pro-muted text-[10px] uppercase tracking-wider font-medium">Départ</p>
                <p className="text-pro-text text-sm">{t?.depart}</p>
              </div>
              <div>
                <p className="text-pro-muted text-[10px] uppercase tracking-wider font-medium">Arrivée</p>
                <p className="text-pro-text text-sm">{t?.arrivee}</p>
              </div>
            </div>
          </div>

          {(t?.marque || t?.immatriculation) && (
            <div className="mt-3 pt-3 border-t border-pro-border flex items-center gap-2 text-xs text-pro-text-soft">
              <Car size={12} />
              {[t.marque, t.modele, t.immatriculation].filter(Boolean).join(" · ")}
            </div>
          )}

          {t?.date_trajet && (
            <div className="mt-1 flex items-center gap-2 text-xs text-pro-text-soft">
              <Calendar size={12} />
              {new Date(t.date_trajet).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
              {t.heure_trajet && ` à ${t.heure_trajet}`}
            </div>
          )}

          {typeConvoyeur === "independant" && t?.tarif_convoyeur != null && (
            <div className="mt-3 pt-3 border-t border-pro-border flex items-center justify-between">
              <span className="text-pro-muted text-xs uppercase tracking-wider">Tarif mission</span>
              <span className="text-emerald-700 font-bold text-base">{t.tarif_convoyeur} €</span>
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-2">
          <a
            href={t?.depart ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(t.depart)}` : "#"}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 active:scale-[0.98] transition"
          >
            <Navigation size={16} /> Ouvrir GPS
          </a>
          <a
            href={t?.client_telephone ? `tel:${t.client_telephone}` : "#"}
            className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition ${
              t?.client_telephone
                ? "bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.98]"
                : "bg-pro-bg-soft text-pro-muted pointer-events-none"
            }`}
          >
            <Phone size={16} /> Appeler client
          </a>
        </div>

        {/* Live GPS */}
        {isActive && (
          <>
            <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl">
              <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <div className="flex-1">
                <p className="text-emerald-800 text-sm font-medium">Mission en cours</p>
                <p className="text-emerald-600 text-xs">
                  GPS actif · {gpsPoints.length} position{gpsPoints.length > 1 ? "s" : ""}
                  {getDuration() && ` · ${getDuration()}`}
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowMap(!showMap)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-pro-text border border-pro-border rounded-xl text-sm hover:bg-pro-bg-soft transition"
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
          </>
        )}

        {/* Acceptation rapide si proposée */}
        {openMission.statut === "propose" && (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => updateStatus(openMission.id, "accepte")}
              className="flex items-center justify-center gap-2 py-4 bg-emerald-600 text-white rounded-xl text-base font-semibold hover:bg-emerald-700 active:scale-[0.98]"
            >
              <Check size={18} /> Accepter
            </button>
            <button
              onClick={() => updateStatus(openMission.id, "refuse")}
              className="flex items-center justify-center gap-2 py-4 bg-white text-red-600 border border-red-200 rounded-xl text-base font-semibold hover:bg-red-50 active:scale-[0.98]"
            >
              <X size={18} /> Refuser
            </button>
          </div>
        )}

        {/* Workflow étape par étape */}
        {openMission.statut !== "propose" && openMission.statut !== "termine" && user && (
          <MissionWorkflow
            attributionId={openMission.id}
            userId={user.id}
            currentEtape={openMission.etape_courante ?? null}
            statut={openMission.statut}
            inspectionDepartDone={!!openMission.inspectionDepart}
            inspectionArriveeDone={!!openMission.inspectionArrivee}
            onStartInspection={(type) => setInspection({ attributionId: openMission.id, type, mode: "visuel" })}
            onMacroStatusChange={(s) => updateStatus(openMission.id, s)}
            onUpdated={fetchMissions}
          />
        )}

        {/* Documents */}
        {user && (
          <div className="bg-white rounded-2xl border border-pro-border p-4">
            <button
              onClick={() => setExpandedDocs(v => !v)}
              className="flex items-center gap-2 text-sm text-pro-text-soft hover:text-pro-text w-full"
            >
              <FileText size={14} />
              Documents de mission
              <span className="ml-auto text-xs">{expandedDocs ? "▲" : "▼"}</span>
            </button>
            {expandedDocs && (
              <div className="mt-3">
                <MissionDocuments attributionId={openMission.id} userId={user.id} />
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // === LISTE ===
  const counts = {
    today: missions.filter(m => m.trajet?.date_trajet === new Date().toISOString().split("T")[0]).length,
    in_progress: missions.filter(m => m.statut === "en_cours").length,
    upcoming: missions.filter(m => m.trajet?.date_trajet && m.trajet.date_trajet > new Date().toISOString().split("T")[0]).length,
    done: missions.filter(m => m.statut === "termine").length,
  };

  const filters: { key: FilterKey; label: string; count?: number }[] = [
    { key: "all", label: "Toutes" },
    { key: "today", label: "Aujourd'hui", count: counts.today },
    { key: "in_progress", label: "En cours", count: counts.in_progress },
    { key: "upcoming", label: "À venir", count: counts.upcoming },
    { key: "done", label: "Terminées", count: counts.done },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-pro-text">Mes missions</h1>
        <p className="text-pro-text-soft text-xs mt-0.5">Tapez une mission pour voir le détail et le parcours étape par étape</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-pro-muted" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher (ville, immat, marque…)"
          className="w-full pl-9 pr-3 py-2.5 bg-white border border-pro-border rounded-xl text-sm placeholder:text-pro-muted focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1 snap-x">
        <Filter size={14} className="text-pro-muted shrink-0 self-center" />
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`shrink-0 snap-start px-3 py-1.5 rounded-full text-xs font-medium transition border ${
              filter === f.key
                ? "bg-emerald-600 text-white border-emerald-600"
                : "bg-white text-pro-text-soft border-pro-border hover:bg-pro-bg-soft"
            }`}
          >
            {f.label}
            {f.count !== undefined && f.count > 0 && (
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${
                filter === f.key ? "bg-white/20" : "bg-pro-bg-soft"
              }`}>{f.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-pro-border p-8 text-center shadow-sm">
          <Truck size={32} className="mx-auto text-pro-muted mb-3" />
          <p className="text-pro-text-soft text-sm">Aucune mission {search || filter !== "all" ? "pour ces critères" : "pour le moment"}.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(m => (
            <MissionCard
              key={m.id}
              mission={m}
              showTarif={typeConvoyeur === "independant"}
              isActive={m.id === activeMissionId}
              onOpen={() => setOpenMissionId(m.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
