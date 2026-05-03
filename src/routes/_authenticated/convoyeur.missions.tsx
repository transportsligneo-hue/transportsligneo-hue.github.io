import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState, useCallback, useMemo } from "react";
import {
  MapPin, Loader2, FileText, Navigation, Clock,
  ChevronDown, ChevronUp, Truck, ArrowLeft, Search, Filter, Phone,
  Check, X,
} from "lucide-react";
import { useGpsTracking } from "@/hooks/useGpsTracking";
import { EtatDesLieuxFlow } from "@/components/inspection/EtatDesLieuxFlow";
import { MissionDocuments } from "@/components/MissionDocuments";
import { GpsMapView } from "@/components/GpsMapView";
import { MissionCard, type MissionCardData } from "@/components/convoyeur/MissionCard";
import { MissionWorkflow } from "@/components/convoyeur/MissionWorkflow";
import { PremiumMissionHero, type TimelineStep } from "@/components/convoyeur/PremiumMissionHero";

export const Route = createFileRoute("/_authenticated/convoyeur/missions")({
  component: ConvoyeurMissions,
});

interface Mission extends MissionCardData {
  trajet_id: string;
  numero_mission?: string | null;
}

interface GpsPoint {
  latitude: number;
  longitude: number;
  recorded_at: string;
  accuracy: number | null;
}

type FilterKey = "all" | "today" | "upcoming" | "in_progress" | "done";
type InspectionSession = { attributionId: string; type: "depart" | "arrivee" };

const EDL_SESSION_KEY = "edl:inspection";

function readStoredInspection(): InspectionSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(EDL_SESSION_KEY) ?? localStorage.getItem(EDL_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function ConvoyeurMissions() {
  const { user } = useAuth();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMissionId, setActiveMissionId] = useState<string | null>(null);
  const [openMissionId, setOpenMissionId] = useState<string | null>(null);
  // Persisted in sessionStorage so the camera-suspend/restart on mobile
  // cannot drop us back to the mission page mid-inspection.
  const [inspection, setInspection] = useState<InspectionSession | null>(() => readStoredInspection());
  const openInspection = useCallback((next: InspectionSession) => {
    if (typeof window !== "undefined") {
      const raw = JSON.stringify(next);
      sessionStorage.setItem(EDL_SESSION_KEY, raw);
      localStorage.setItem(EDL_SESSION_KEY, raw);
    }
    setOpenMissionId(next.attributionId);
    setInspection(next);
  }, []);
  const [expandedDocs, setExpandedDocs] = useState(false);
  const [gpsPoints, setGpsPoints] = useState<GpsPoint[]>([]);
  const [showMap, setShowMap] = useState(false);
  const [missionStartTime, setMissionStartTime] = useState<string | null>(null);
  const [typeConvoyeur, setTypeConvoyeur] = useState<string>("salarie");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");

  // Sync inspection state to sessionStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (inspection) {
      const raw = JSON.stringify(inspection);
      sessionStorage.setItem(EDL_SESSION_KEY, raw);
      localStorage.setItem(EDL_SESSION_KEY, raw);
      // Also restore the open mission so the back navigation works
      if (!openMissionId) setOpenMissionId(inspection.attributionId);
    } else {
      sessionStorage.removeItem(EDL_SESSION_KEY);
      localStorage.removeItem(EDL_SESSION_KEY);
    }
  }, [inspection, openMissionId]);

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
      .select("id, statut, trajet_id, etape_courante, numero_mission" as never)
      .eq("convoyeur_id", conv.id)
      .in("statut", ["propose", "accepte", "en_cours", "en_attente_validation", "validee", "refusee", "termine"]);

    if (data) {
      const enriched: Mission[] = [];
      for (const attr of data as unknown as Array<{ id: string; statut: string; trajet_id: string; etape_courante: string | null; numero_mission: string | null }>) {
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
          numero_mission: attr.numero_mission,
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
    if (filter === "done") list = list.filter(m => ["termine", "en_attente_validation", "validee", "refusee"].includes(m.statut));
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

  // Overlay plein écran via Portal (dans EtatDesLieuxFlow) — rendu en parallèle du DOM normal,
  // ne dépend plus du re-render du parent. Survit aux fetchMissions / GPS realtime.
  const inspectionOverlay = inspection && user ? (
    <EtatDesLieuxFlow
      attributionId={inspection.attributionId}
      type={inspection.type}
      userId={user.id}
      onComplete={handleInspectionComplete}
      onClose={() => setInspection(null)}
    />
  ) : null;

  // === FICHE MISSION DÉTAILLÉE ===
  if (openMission) {
    const t = openMission.trajet;
    const isActive = openMission.id === activeMissionId;
    const lastPoint = gpsPoints.length > 0 ? gpsPoints[gpsPoints.length - 1] : null;

    // === Mappage 7 étapes affichage (image fournie) ===
    // 1 Enlèvement · 2 Inspection · 3 Transport · 4 Livraison · 5 Inspection arrivée · 6 Validation · 7 Terminée
    const etape = openMission.etape_courante;
    const inspDepartOk = !!openMission.inspectionDepart;
    const inspArriveeOk = !!openMission.inspectionArrivee;
    const isTermine = ["termine", "validee"].includes(openMission.statut);
    const isPendingValidation = openMission.statut === "en_attente_validation";

    let currentIdx = 1;
    if (etape === "acceptee" || openMission.statut === "accepte") currentIdx = 1;
    else if (etape === "en_route" || etape === "sur_place") currentIdx = 1;
    else if (etape === "vehicule_recupere") currentIdx = 2;
    else if (etape === "edl_depart_fait" || (inspDepartOk && !inspArriveeOk)) currentIdx = 3;
    else if (etape === "en_livraison") currentIdx = 3;
    else if (etape === "arrive_destination") currentIdx = 4;
    else if (etape === "edl_arrivee_fait" || inspArriveeOk) currentIdx = 5;
    else if (isPendingValidation) currentIdx = 6;
    else if (isTermine) currentIdx = 7;

    const stepLabels = [
      { label: "Enlèvement" },
      { label: "Inspection" },
      { label: "Transport" },
      { label: "Livraison" },
      { label: "Inspection\narrivée" },
      { label: "Validation" },
      { label: "Terminée" },
    ];
    const timelineSteps: TimelineStep[] = stepLabels.map((s, i) => {
      const idx = i + 1;
      const state: TimelineStep["state"] = idx < currentIdx ? "done" : idx === currentIdx ? "current" : "todo";
      return {
        index: idx,
        label: s.label,
        state,
        sub: state === "done" ? "OK" : state === "current" ? "En cours" : "À venir",
      };
    });

    const currentStepLabel = stepLabels[Math.min(currentIdx, stepLabels.length) - 1].label.replace("\n", " ");
    const statutLabel = isTermine ? "Mission terminée"
      : isPendingValidation ? "En attente de validation"
      : isActive ? "Mission en cours"
      : openMission.statut === "propose" ? "Mission proposée"
      : "Mission planifiée";

    // Split ville/adresse depuis le champ texte (best-effort)
    const splitAddr = (full?: string | null) => {
      if (!full) return { ville: "—", adresse: "" };
      const parts = full.split(",").map(p => p.trim()).filter(Boolean);
      if (parts.length >= 2) return { ville: parts[parts.length - 1], adresse: parts.slice(0, -1).join(", ") };
      return { ville: full, adresse: "" };
    };
    const dep = splitAddr(t?.depart);
    const arr = splitAddr(t?.arrivee);

    return (
      <>
      {inspectionOverlay}
      <div className="space-y-4 pb-32">
        {/* Sticky back bar */}
        <div className="sticky top-0 z-30 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-2 bg-white/95 backdrop-blur-sm border-b border-pro-border/60">
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => setOpenMissionId(null)}
              className="flex items-center gap-1.5 text-pro-text hover:text-[var(--gold)] text-sm font-medium py-1.5 px-2 -ml-2 rounded-md hover:bg-pro-bg-soft active:scale-95 transition"
            >
              <ArrowLeft size={18} /> Missions
            </button>
            {isActive && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#0b1026] bg-[var(--gold)]/20 border border-[var(--gold)]/40 px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold)] animate-pulse" />
                EN COURS
                {getDuration() && <span>· {getDuration()}</span>}
              </span>
            )}
          </div>
        </div>

        {/* HERO PREMIUM */}
        <PremiumMissionHero
          data={{
            numeroMission: openMission.numero_mission ?? null,
            statutLabel,
            isLive: isActive,
            depart: { ville: dep.ville, adresse: dep.adresse, date: t?.date_trajet ?? undefined, heure: t?.heure_trajet ?? undefined },
            arrivee: { ville: arr.ville, adresse: arr.adresse, date: t?.date_trajet ?? undefined, heure: t?.heure_trajet ?? undefined },
            vehicule: {
              marque: t?.marque ?? undefined,
              modele: t?.modele ?? undefined,
              immatriculation: t?.immatriculation ?? undefined,
            },
            contactDepartTel: t?.client_telephone ?? null,
            contactArriveeTel: t?.client_telephone ?? null,
            gpsTarget: t?.depart ?? null,
          }}
          steps={timelineSteps}
          currentStepIndex={Math.min(currentIdx, 7)}
          totalSteps={7}
          currentStepLabel={currentStepLabel}
          onOpenInspection={() => openInspection({ attributionId: openMission.id, type: inspDepartOk ? "arrivee" : "depart" })}
          onOpenDocuments={() => setExpandedDocs(true)}
          onOpenIncident={() => alert("Aide / Incident — fonctionnalité à venir (couche 2)")}
        />

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

        {/* Validations obligatoires : selfie + double signatures */}
        {openMission.statut !== "propose" && user && (
          <MissionGatesPanel
            attributionId={openMission.id}
            userId={user.id}
            driverName={`${user.user_metadata?.prenom ?? ""} ${user.user_metadata?.nom ?? ""}`.trim() || (user.email ?? "Convoyeur")}
            clientName={openMission.trajet?.client_nom ?? undefined}
            showEndSignatures={!!openMission.inspectionArrivee || ["arrive_destination","edl_arrivee_fait","en_attente_validation","validee","termine"].includes(openMission.etape_courante ?? openMission.statut)}
            onChange={fetchMissions}
          />
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
            onStartInspection={(type) => openInspection({ attributionId: openMission.id, type })}
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

        {/* Sticky bottom action bar — toujours accessible au pouce sur mobile */}
        {openMission.statut !== "propose" && !["termine", "en_attente_validation", "validee", "refusee"].includes(openMission.statut) && (
          <div
            className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-pro-border shadow-[0_-4px_12px_rgba(0,0,0,0.06)]"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 8px)" }}
          >
            <div className="flex items-stretch gap-2 px-3 pt-3">
              <a
                href={t?.depart ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(t.depart)}` : "#"}
                target="_blank" rel="noopener noreferrer"
                className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 bg-blue-600 text-white rounded-xl font-semibold active:scale-95 transition"
              >
                <Navigation size={18} />
                <span className="text-[11px] uppercase tracking-wide">GPS</span>
              </a>
              <a
                href={t?.client_telephone ? `tel:${t.client_telephone}` : "#"}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 rounded-xl font-semibold transition ${
                  t?.client_telephone
                    ? "bg-emerald-600 text-white active:scale-95"
                    : "bg-pro-bg-soft text-pro-muted pointer-events-none"
                }`}
              >
                <Phone size={18} />
                <span className="text-[11px] uppercase tracking-wide">Appeler</span>
              </a>
              {isActive && (
                <button
                  onClick={() => setShowMap(v => !v)}
                  className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 bg-white border border-pro-border text-pro-text rounded-xl font-semibold active:scale-95 transition"
                >
                  <MapPin size={18} />
                  <span className="text-[11px] uppercase tracking-wide">{showMap ? "Masquer" : "Carte"}</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      </>
    );
  }

  // === LISTE ===
  const counts = {
    today: missions.filter(m => m.trajet?.date_trajet === new Date().toISOString().split("T")[0]).length,
    in_progress: missions.filter(m => m.statut === "en_cours").length,
    upcoming: missions.filter(m => m.trajet?.date_trajet && m.trajet.date_trajet > new Date().toISOString().split("T")[0]).length,
    done: missions.filter(m => ["termine", "en_attente_validation", "validee", "refusee"].includes(m.statut)).length,
  };

  const filters: { key: FilterKey; label: string; count?: number }[] = [
    { key: "all", label: "Toutes" },
    { key: "today", label: "Aujourd'hui", count: counts.today },
    { key: "in_progress", label: "En cours", count: counts.in_progress },
    { key: "upcoming", label: "À venir", count: counts.upcoming },
    { key: "done", label: "Terminées", count: counts.done },
  ];

  return (
    <>
    {inspectionOverlay}
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
    </>
  );
}
