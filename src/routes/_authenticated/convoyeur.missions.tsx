import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { writeWithOutbox } from "@/lib/offline-outbox";
import { useEffect, useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
  MapPin, Loader2, FileText, Clock,
  ChevronDown, ChevronUp, Truck, ArrowLeft, Search, Filter,
  Check, X,
} from "lucide-react";
import { useGpsTracking } from "@/hooks/useGpsTracking";
import { EdlPremiumFlow } from "@/components/inspection/EdlPremiumFlow";
import { EdlErrorBoundary } from "@/components/inspection/EdlErrorBoundary";
import { MissionDocuments } from "@/components/MissionDocuments";
import { MissionPVDigitauxBlock } from "@/components/mission/MissionPVDigitauxBlock";
import { LiveMissionMap } from "@/components/map/LiveMissionMap";
import { MissionCard, type MissionCardData } from "@/components/convoyeur/MissionCard";
import { MissionCockpit } from "@/components/convoyeur/MissionCockpit";
import { RechargeMissionCockpit } from "@/components/convoyeur/RechargeMissionCockpit";
import { isRechargeSeule } from "@/components/admin/RechargeBadge";
import { PremiumMissionHero, type TimelineStep } from "@/components/convoyeur/PremiumMissionHero";
import { MissionV3InfoPane, type V3TimelineStep } from "@/components/convoyeur/MissionV3InfoPane";
import { MissionV3DocsPane } from "@/components/convoyeur/MissionV3DocsPane";
import { VehiculeDocsView } from "@/components/convoyeur/VehiculeDocsView";
import { displayNumero } from "@/lib/mission-number";
import { hasPendingDriverSelfie, setPendingDriverSelfie } from "@/components/mission/DriverSelfieCapture";

export const Route = createFileRoute("/_authenticated/convoyeur/missions")({
  validateSearch: (search: Record<string, unknown>): { open?: string; f?: string } => ({
    open: typeof search.open === "string" && search.open ? search.open : undefined,
    f: typeof search.f === "string" && search.f ? search.f : undefined,
  }),
  component: ConvoyeurMissions,
});

interface Mission extends MissionCardData {
  trajet_id: string;
  numero_mission?: string | null;
  options_completion?: Record<string, { done: boolean; at?: string; photo_url?: string | null }> | null;
}


interface GpsPoint {
  latitude: number;
  longitude: number;
  recorded_at: string;
  accuracy: number | null;
}

type FilterKey = "all" | "today" | "upcoming" | "in_progress" | "done" | "proposed" | "accepted";
const DONE_STATUTS = new Set(["termine", "en_attente_validation", "validee", "refusee"]);
type InspectionSession = { attributionId: string; type: "depart" | "arrivee" };

const EDL_SESSION_KEY = "edl:inspection";

function normalizeMissionEtape(etape: string | null | undefined) {
  if (!etape) return null;
  if (etape === "en_validation_admin" || etape === "envoi_validation_admin") return "en_attente_validation";
  if (etape === "terminee") return "termine";
  return etape;
}

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
  const [openMissionId, setOpenMissionIdState] = useState<string | null>(null);
  const navigate = useNavigate();
  const setOpenMissionId = useCallback((id: string | null) => {
    setOpenMissionIdState(id);
    if (typeof window === "undefined") return;
    if (id) {
      sessionStorage.setItem("driver:openMissionId", id);
      localStorage.setItem("driver:openMissionId", id);
    } else {
      sessionStorage.removeItem("driver:openMissionId");
      localStorage.removeItem("driver:openMissionId");
      // Retire ?open= de l'URL pour que la fiche ne se ré-ouvre pas.
      navigate({ to: "/convoyeur/missions", search: (prev: Record<string, unknown>) => ({ ...prev, open: undefined }), replace: true });
    }
  }, [navigate]);
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
  const [typeConvoyeur, setTypeConvoyeur] = useState<string>("independant");
  const routeSearch = Route.useSearch();
  const [filter, setFilter] = useState<FilterKey>(() => {
    const allowed: FilterKey[] = ["all", "today", "upcoming", "in_progress", "done", "proposed", "accepted"];
    return (allowed as string[]).includes(routeSearch.f ?? "") ? (routeSearch.f as FilterKey) : "all";
  });
  const [search, setSearch] = useState("");
  const [resumeSelfieMissionId, setResumeSelfieMissionId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<"action" | "info" | "docs">("action");

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const storedOpenMissionId =
        routeSearch.open || sessionStorage.getItem("driver:openMissionId") || localStorage.getItem("driver:openMissionId");
      const storedInspection = readStoredInspection();

      if (storedOpenMissionId) setOpenMissionIdState(storedOpenMissionId);
      if (storedInspection) setInspection(storedInspection);
    } catch {
      // Ignore storage restoration issues on privacy-restricted devices.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ouvre la mission demandée par l'URL (ex. depuis l'Historique), même si
  // elle est terminée : la navigation client doit toujours ouvrir la fiche.
  useEffect(() => {
    if (routeSearch.open) setOpenMissionIdState(routeSearch.open);
    if (routeSearch.f) {
      const allowed: FilterKey[] = ["all", "today", "upcoming", "in_progress", "done", "proposed", "accepted"];
      if ((allowed as string[]).includes(routeSearch.f)) setFilter(routeSearch.f as FilterKey);
    }
  }, [routeSearch.open, routeSearch.f]);

  // Nettoie l'openMissionId restauré si la mission n'est plus active
  // (évite d'atterrir sur une mission terminée quand on revient depuis
  // le dashboard) — sauf si l'URL demande explicitement cette mission.
  useEffect(() => {
    if (!openMissionId || missions.length === 0) return;
    const m = missions.find(x => x.id === openMissionId);
    if (!m) return;
    if (routeSearch.open === openMissionId) return;
    if (DONE_STATUTS.has(m.statut)) {
      setOpenMissionId(null);
    }
  }, [openMissionId, missions, setOpenMissionId, routeSearch.open]);

  // Masque totalement la navigation basse tant qu'un détail de mission est ouvert
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.toggle("mission-detail-open", !!openMissionId);
    return () => document.body.classList.remove("mission-detail-open");
  }, [openMissionId]);



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
    const { data: conv, error: convError } = await supabase
      .from("convoyeurs")
      .select("id, type_convoyeur")
      .eq("user_id", user.id)
      .maybeSingle();

    if (convError) {
      setLoading(false);
      throw convError;
    }

    if (!conv) { setLoading(false); return; }
    setTypeConvoyeur(conv.type_convoyeur || "independant");
    setActiveMissionId((prev) => (prev && prev !== "" ? prev : null));

    const { data, error } = await supabase
      .from("attributions")
      .select("id, statut, trajet_id, etape_courante, numero_mission, options_completion" as never)
      .eq("convoyeur_id", conv.id)
      .in("statut", ["propose", "accepte", "en_cours", "en_attente_validation", "validee", "refuse", "refusee", "termine"]);

    if (error) {
      setLoading(false);
      throw error;
    }

    if (data) {
      const rows = data as unknown as Array<{ id: string; statut: string; trajet_id: string; etape_courante: string | null; numero_mission: string | null; options_completion: Record<string, { done: boolean; at?: string; photo_url?: string | null }> | null }>;
      const enriched = await Promise.all(rows.map(async (attr) => {
        const [trajetRes, { data: inspections }] = await Promise.all([
          supabase
            .from("trajets_assigned_safe" as never)
            .select("depart, arrivee, date_trajet, heure_trajet, marque, modele, immatriculation, vehicule_immatriculation, vehicule_vin, tarif_convoyeur, contact_depart_tel, contact_arrivee_tel, vin, carte_grise_recto_url, carte_grise_verso_url, vehicule_energie, vehicule_type, vehicule_couleur, vehicule_km, vehicule_notes, options_meta, type_mission, arrivee_contact_nom, arrivee_contact_telephone, arrivee_contact_telephone2, arrivee_contact_instructions")
            .eq("id", attr.trajet_id)
            .maybeSingle(),
          supabase
            .from("inspections")
            .select("type, statut")
            .eq("attribution_id", attr.id),
        ]);
        const trajet = trajetRes.data as MissionCardData["trajet"];

        const inspDepart = inspections?.some(i => i.type === "depart" && i.statut === "complete");
        const inspArrivee = inspections?.some(i => i.type === "arrivee" && i.statut === "complete");

        return {
          id: attr.id,
          statut: attr.statut,
          etape_courante: normalizeMissionEtape(attr.etape_courante),
          trajet_id: attr.trajet_id,
          numero_mission: attr.numero_mission,
          options_completion: attr.options_completion ?? {},
          trajet,
          inspectionDepart: !!inspDepart,
          inspectionArrivee: !!inspArrivee,
        };
      }));

      // Lots multi-plaques : missions distinctes reliées pour l'attribution groupée.
      let withLots = enriched;
      try {
        const trajetIds = enriched.map((m) => m.trajet_id).filter(Boolean);
        if (trajetIds.length) {
          const { data: lots } = await supabase.rpc("get_my_mission_lots" as never, { _trajet_ids: trajetIds } as never);
          const lotByTrajet = new Map<string, { ref: string | null; plaques: string[]; total: number }>();
          ((lots ?? []) as unknown as Array<{ trajet_id: string; lot_reference: string | null; plaques: string[] | null; total: number }>)
            .forEach((l) => lotByTrajet.set(l.trajet_id, { ref: l.lot_reference, plaques: l.plaques ?? [], total: l.total }));
          if (lotByTrajet.size) {
            withLots = enriched.map((m) => ({ ...m, lot: lotByTrajet.get(m.trajet_id) ?? null }));
          }
        }
      } catch {
        /* lot non bloquant */
      }

      const nextActiveMission = withLots.find((mission) => mission.statut === "en_cours")?.id ?? null;
      setActiveMissionId(nextActiveMission);
      setMissions(withLots);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchMissions().catch((error) => {
      toast.error("Chargement des missions impossible", {
        description: error instanceof Error ? error.message : "Réessayez dans quelques secondes.",
      });
    });
  }, [fetchMissions]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setupRealtime = async () => {
      const { data: conv } = await supabase
        .from("convoyeurs")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!conv?.id || cancelled) return;

      channel = supabase
        .channel(`convoyeur-missions-${conv.id}`)
        .on("postgres_changes", {
          event: "*",
          schema: "public",
          table: "attributions",
          filter: `convoyeur_id=eq.${conv.id}`,
        }, () => {
          void fetchMissions();
        })
        .on("postgres_changes", {
          event: "*",
          schema: "public",
          table: "inspections",
        }, () => {
          void fetchMissions();
        })
        .subscribe();
    };

    void setupRealtime();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [fetchMissions, user]);

  useEffect(() => {
    if (!missions.length) return;

    const candidates = missions.filter((mission) => hasPendingDriverSelfie(mission.id));
    if (candidates.length === 0) {
      setResumeSelfieMissionId(null);
      return;
    }

    let cancelled = false;
    (async () => {
      // Vérifie en base si un selfie existe déjà — si oui, on nettoie
      // le flag local et on ne re-bloque plus la mission.
      const ids = candidates.map((m) => m.id);
      const { data } = await supabase
        .from("mission_selfies" as never)
        .select("attribution_id")
        .in("attribution_id" as never, ids as never);
      if (cancelled) return;

      const alreadyDone = new Set<string>(((data ?? []) as Array<{ attribution_id: string }>).map((r) => r.attribution_id));
      const stillPending = candidates.find((m) => !alreadyDone.has(m.id));

      // Nettoie les flags périmés
      candidates.forEach((m) => {
        if (alreadyDone.has(m.id)) setPendingDriverSelfie(m.id, false);
      });

      if (!stillPending) {
        setResumeSelfieMissionId(null);
        return;
      }

      setResumeSelfieMissionId(stillPending.id);
      if (openMissionId !== stillPending.id) {
        setOpenMissionId(stillPending.id);
      }
    })();

    return () => { cancelled = true; };
  }, [missions, openMissionId, setOpenMissionId]);

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
    const { queued } = await writeWithOutbox(
      { kind: "update", table: "attributions", values: { statut }, match: { id } },
      `Statut ${statut}`,
    );
    if (queued) {
      toast.info("Hors ligne — la mise à jour partira dès le retour du réseau.");
    }
    if (statut === "en_cours") { setActiveMissionId(id); setShowMap(true); }
    if (statut === "termine" || statut === "en_attente_validation") {
      setActiveMissionId(null); setShowMap(false);
      try {
        const { notifyClientMissionCompleted } = await import("@/lib/push/notify.functions");
        await notifyClientMissionCompleted({ data: { attributionId: id } });
      } catch (e) {
        console.warn("[convoyeur.missions] notifyClientMissionCompleted failed", e);
      }
      // Notification admin complète (in-app + push + email récapitulatif)
      try {
        const { notifyAdminMissionTerminee } = await import("@/lib/mission-completion-notify");
        await notifyAdminMissionTerminee(id);
      } catch (e) {
        console.warn("[convoyeur.missions] notifyAdminMissionTerminee failed", e);
      }
    }
    await fetchMissions();
    return true;
  };


  const toggleOptionCompletion = async (mission: Mission, key: string, done: boolean) => {
    const current = (mission.options_completion ?? {}) as Record<string, { done: boolean; at?: string }>;
    const next = { ...current, [key]: { ...(current[key] ?? {}), done, at: done ? new Date().toISOString() : undefined } };
    const { error } = await supabase
      .from("attributions")
      .update({ options_completion: next } as never)
      .eq("id", mission.id);
    if (error) {
      toast.error("Mise à jour impossible", { description: error.message });
      return;
    }
    toast.success(done ? "Tâche validée" : "Tâche annulée");
    await fetchMissions();
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
    // "Toutes" = missions actives uniquement (proposées / acceptées / à venir / en cours)
    // Les missions terminées, validées ou refusées vont dans l'onglet Terminées / Historique.
    if (filter === "all") list = list.filter(m => !DONE_STATUTS.has(m.statut));
    if (filter === "today") list = list.filter(m => m.trajet?.date_trajet === today);
    if (filter === "upcoming") list = list.filter(m => m.trajet?.date_trajet && m.trajet.date_trajet > today);
    if (filter === "in_progress") list = list.filter(m => m.statut === "en_cours");
    if (filter === "proposed") list = list.filter(m => m.statut === "propose");
    if (filter === "accepted") list = list.filter(m => m.statut === "accepte");
    if (filter === "done") list = list.filter(m => DONE_STATUTS.has(m.statut));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(m =>
        m.trajet?.depart?.toLowerCase().includes(q) ||
        m.trajet?.arrivee?.toLowerCase().includes(q) ||
        m.trajet?.immatriculation?.toLowerCase().includes(q) ||
        m.trajet?.marque?.toLowerCase().includes(q),
      );
    }
    // Tri : en cours d'abord, puis à venir (date asc), puis terminées (date desc).
    const bucket = (m: typeof missions[number]) => {
      if (m.statut === "en_cours") return 0;
      if (DONE_STATUTS.has(m.statut)) return 2;
      return 1;
    };
    return [...list].sort((a, b) => {
      const ba = bucket(a), bb = bucket(b);
      if (ba !== bb) return ba - bb;
      const da = `${a.trajet?.date_trajet ?? ""} ${a.trajet?.heure_trajet ?? ""}`;
      const db = `${b.trajet?.date_trajet ?? ""} ${b.trajet?.heure_trajet ?? ""}`;
      // Terminées : plus récentes en haut. Autres : plus proches en haut.
      return ba === 2 ? (db > da ? 1 : -1) : (da > db ? 1 : -1);
    });
  }, [missions, filter, search]);

  const closeInspection = useCallback(() => {
    if (typeof window !== "undefined") {
      try {
        sessionStorage.removeItem(EDL_SESSION_KEY);
        localStorage.removeItem(EDL_SESSION_KEY);
      } catch {
        // ignore
      }
    }
    setInspection(null);
  }, []);

  // Une mission « recharge uniquement » n'a pas d'état des lieux de livraison :
  // on purge toute session EDL restaurée par erreur pour ce type de mission.
  useEffect(() => {
    if (!inspection) return;
    const m = missions.find((mm) => mm.id === inspection.attributionId);
    if (!m) return;
    if (isRechargeSeule(m.trajet as { options_meta?: unknown; type_mission?: string | null } | null)) {
      closeInspection();
    }
  }, [inspection, missions, closeInspection]);


  const openMission = openMissionId ? missions.find(m => m.id === openMissionId) : null;

  // Overlay plein écran via Portal (dans EtatDesLieuxFlow) — rendu même pendant
  // le chargement parent : au retour de l'appareil photo Android, on évite
  // l'écran blanc + spinner entre deux captures.
  const inspectionMission = inspection ? missions.find(m => m.id === inspection.attributionId) : null;
  const driverDisplayName =
    user?.user_metadata?.prenom && user?.user_metadata?.nom
      ? `${user.user_metadata.prenom} ${user.user_metadata.nom}`
      : user?.email ?? "Convoyeur";
  const inspectionOverlay = inspection && user ? (
    <EdlErrorBoundary onClose={closeInspection}>
      <EdlPremiumFlow
        attributionId={inspection.attributionId}
        type={inspection.type}
        userId={user.id}
        driverName={driverDisplayName}
        vehicule={{
          marque: inspectionMission?.trajet?.marque ?? null,
          modele: inspectionMission?.trajet?.modele ?? null,
          immatriculation: inspectionMission?.trajet?.immatriculation || (inspectionMission?.trajet as { vehicule_immatriculation?: string | null } | null | undefined)?.vehicule_immatriculation || null,
          vin: (inspectionMission?.trajet as { vin?: string | null; vehicule_vin?: string | null } | null | undefined)?.vin || (inspectionMission?.trajet as { vehicule_vin?: string | null } | null | undefined)?.vehicule_vin || null,
        }}
        defaultClientName={inspectionMission?.trajet?.marque ? undefined : undefined}
        onComplete={handleInspectionComplete}
        onClose={closeInspection}
      />
    </EdlErrorBoundary>
  ) : null;

  if (loading) {
    return inspectionOverlay ?? (
      <div className="min-h-[60vh] flex items-center justify-center bg-[#050a1f]">
        <Loader2 className="animate-spin text-[#d4af37]" size={24} />
      </div>
    );
  }

  // === FICHE MISSION DÉTAILLÉE ===
  if (openMission) {
    const t = openMission.trajet;
    const rechargeOnly = isRechargeSeule(t as { options_meta?: unknown; depart?: string | null; arrivee?: string | null } | null);
    const isActive = openMission.id === activeMissionId;
    const lastPoint = gpsPoints.length > 0 ? gpsPoints[gpsPoints.length - 1] : null;

    // === Mappage 6 étapes (nouvel ordre standardisé) ===
    // 1 Arrivé enlèvement · 2 Inspection enlèvement · 3 Trajet
    // 4 Arrivé livraison · 5 Inspection livraison · 6 Validation admin
    const etape = normalizeMissionEtape(openMission.etape_courante);
    const inspDepartOk = !!openMission.inspectionDepart;
    const inspArriveeOk = !!openMission.inspectionArrivee;
    const isTermine = ["termine", "validee"].includes(openMission.statut);
    const isPendingValidation = openMission.statut === "en_attente_validation";

    let currentIdx = 1;
    if (etape === "acceptee" || openMission.statut === "accepte" || etape === null) currentIdx = 1;
    else if (etape === "en_route") currentIdx = 2;
    else if (etape === "sur_place" || etape === "vehicule_recupere") currentIdx = 3;
    else if (etape === "edl_depart_fait") currentIdx = 4;
    else if (etape === "en_livraison") currentIdx = 5;
    else if (etape === "arrive_destination") currentIdx = 6;
    else if (etape === "edl_arrivee_fait" || inspArriveeOk) currentIdx = 7;
    if (isPendingValidation) currentIdx = 7;
    if (isTermine) currentIdx = 7;

    const stepLabels = [
      { label: "En route pour récupérer le véhicule" },
      { label: "Arrivé au lieu d'enlèvement" },
      { label: "Inspection d'enlèvement" },
      { label: "Trajet" },
      { label: "Arrivé au lieu de livraison" },
      { label: "Inspection d'arrivée" },
      { label: "Envoyer à l'admin" },
    ];
    const TOTAL = stepLabels.length;
    const timelineSteps: TimelineStep[] = stepLabels.map((s, i) => {
      const idx = i + 1;
      // Si terminé, toutes les étapes sont done
      const state: TimelineStep["state"] = isTermine
        ? "done"
        : idx < currentIdx ? "done" : idx === currentIdx ? "current" : "todo";
      return {
        index: idx,
        label: s.label,
        state,
        sub: state === "done" ? "Terminée" : state === "current" ? "En cours" : "À venir",
      };
    });

    const currentStepLabel = stepLabels[Math.min(currentIdx, TOTAL) - 1].label;
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

    const v3TimelineIcons: V3TimelineStep["icon"][] = ["nav", "clip", "search", "package", "pin", "shield", "send"];
    const v3Timeline: V3TimelineStep[] = stepLabels.map((s, i) => {
      const idx = i + 1;
      const state: V3TimelineStep["state"] = isTermine
        ? "done"
        : idx < currentIdx ? "done" : idx === currentIdx ? "current" : "todo";
      return { label: s.label, state, icon: v3TimelineIcons[i] ?? "nav" };
    });
    const v3ProgressPct = isTermine ? 100 : Math.min(95, Math.round(((currentIdx - 1) / TOTAL) * 100));

    const contactDepartTel = (t as { contact_depart_tel?: string | null } | null)?.contact_depart_tel ?? null;
    const contactArriveeTel = (t as { arrivee_contact_telephone?: string | null; contact_arrivee_tel?: string | null } | null)?.arrivee_contact_telephone
      ?? (t as { contact_arrivee_tel?: string | null } | null)?.contact_arrivee_tel ?? null;
    const clientNom = (t as { arrivee_contact_nom?: string | null } | null)?.arrivee_contact_nom ?? null;
    const clientInstructions = (t as { arrivee_contact_instructions?: string | null } | null)?.arrivee_contact_instructions ?? null;
    const gpsTarget = currentIdx <= 3 ? (t?.depart ?? null) : (t?.arrivee ?? null);

    const infoSlot = (
      <>
        <MissionV3InfoPane
          vehicule={{
            marque: t?.marque ?? null,
            modele: t?.modele ?? null,
            immatriculation: t?.immatriculation || (t as { vehicule_immatriculation?: string | null } | null | undefined)?.vehicule_immatriculation || null,
            vin: t?.vin || (t as { vehicule_vin?: string | null } | null | undefined)?.vehicule_vin || null,
            energie: (t as { vehicule_energie?: string | null } | null)?.vehicule_energie ?? null,
            type: (t as { vehicule_type?: string | null } | null)?.vehicule_type ?? null,
            couleur: (t as { vehicule_couleur?: string | null } | null)?.vehicule_couleur ?? null,
            km: (t as { vehicule_km?: number | null } | null)?.vehicule_km ?? null,
          }}
          client={{
            nom: clientNom ?? "Contact mission",
            telephone: contactArriveeTel ?? contactDepartTel ?? null,
            type: "Particulier",
          }}
          depart={{ ville: dep.ville, adresse: dep.adresse }}
          arrivee={{ ville: arr.ville, adresse: arr.adresse }}
          instructions={clientInstructions}
          contactDepartTel={contactDepartTel}
          contactArriveeTel={contactArriveeTel}
          gpsTarget={gpsTarget}
          timeline={v3Timeline}
          currentIndex={Math.min(currentIdx, TOTAL)}
          totalSteps={TOTAL}
          progressPct={v3ProgressPct}
        />
        {isActive && (
          <div className="mv3-live-block">
            <div className="mv3-live-header">
              <span className="mv3-live-pulse" />
              <div className="mv3-live-text">
                <p className="mv3-live-title">Mission en cours</p>
                <p className="mv3-live-sub">
                  GPS actif · {gpsPoints.length} position{gpsPoints.length > 1 ? "s" : ""}
                  {getDuration() && ` · ${getDuration()}`}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowMap(!showMap)}
              className="mv3-live-mapbtn"
            >
              <MapPin size={14} />
              {showMap ? "Masquer la carte" : "Voir la carte en direct"}
              {showMap ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {showMap && (
              <div className="mt-2 space-y-2">
                <LiveMissionMap points={gpsPoints} className="h-[280px] md:h-[400px] rounded-xl overflow-hidden" />
                {lastPoint && (
                  <div className="flex items-center justify-between text-[10px] text-white/50 px-1">
                    <span className="flex items-center gap-1">
                      <Clock size={10} />
                      Dernière position: {new Date(lastPoint.recorded_at).toLocaleTimeString("fr-FR")}
                    </span>
                    {lastPoint.accuracy && <span>Précision: ±{Math.round(lastPoint.accuracy)}m</span>}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </>
    );

    const docsSlot = user ? (
      <MissionV3DocsPane
        attributionId={openMission.id}
        userId={user.id}
        inspectionDepartDone={!!openMission.inspectionDepart}
        inspectionArriveeDone={!!openMission.inspectionArrivee}
        carteGriseAvailable={!!(t?.carte_grise_recto_url || t?.carte_grise_verso_url || t?.vin || (t as { vehicule_vin?: string | null } | null | undefined)?.vehicule_vin)}
        edlContext={{
          numero: openMission.numero_mission
            ? displayNumero(openMission.numero_mission)
            : `MIS-${openMission.id.slice(0, 8).toUpperCase()}`,
          client: clientNom,
          societe:
            (t as { arrivee_contact_societe?: string | null } | null)?.arrivee_contact_societe ||
            (t as { client_nom?: string | null } | null)?.client_nom ||
            clientNom,
          marque_modele:
            [t?.marque, t?.modele].filter(Boolean).join(" ") ||
            (t as { vehicule_type?: string | null } | null)?.vehicule_type ||
            null,
          immatriculation: t?.immatriculation || (t as { vehicule_immatriculation?: string | null } | null | undefined)?.vehicule_immatriculation || null,
          vin: t?.vin || (t as { vehicule_vin?: string | null } | null | undefined)?.vehicule_vin || null,
          kilometrage_depart: (t as { vehicule_km?: number | null } | null)?.vehicule_km != null
            ? String((t as { vehicule_km?: number | null }).vehicule_km)
            : null,
          carburant: (t as { vehicule_energie?: string | null } | null)?.vehicule_energie ?? null,
          depart: t?.depart ?? null,
          arrivee: t?.arrivee ?? null,
          date_prevue: t?.date_trajet ?? null,
          convoyeur_nom:
            [
              (t as { arrivee_contact_prenom?: string | null } | null)?.arrivee_contact_prenom,
              (t as { arrivee_contact_nom?: string | null } | null)?.arrivee_contact_nom,
            ].filter(Boolean).join(" ") || driverDisplayName,
        }}
      />
    ) : null;

    return (
      <>
      {inspectionOverlay}
      <div className="mv3-fullscreen">
        <style>{`
          .mv3-fullscreen { margin: -1rem -1rem 0; min-height: calc(100vh - 1rem); background: #060B24;
            padding: 0 0 calc(24px + env(safe-area-inset-bottom));
            color: #EAF3FF; }
          @media (min-width: 640px) { .mv3-fullscreen { margin: -1.5rem -1.5rem 0; } }
          @media (min-width: 1024px) { .mv3-fullscreen { margin: -2rem -2rem 0; } }
          .mv3-backbar { position: sticky; top: 0; z-index: 30; padding: 10px 14px;
            background: rgba(6,11,36,0.85); backdrop-filter: blur(10px);
            border-bottom: 1px solid rgba(120,180,255,0.08); }
          .mv3-back-btn { display: inline-flex; align-items: center; gap: 6px;
            color: #EAF3FF; font-size: 13px; font-weight: 600; padding: 6px 8px;
            border-radius: 8px; background: transparent; border: none; cursor: pointer;
            transition: background .15s; }
          .mv3-back-btn:hover { background: rgba(255,255,255,0.06); }
          .mv3-live-pill-top { display: inline-flex; align-items: center; gap: 6px;
            font-size: 10.5px; font-weight: 700; color: #0B1026;
            background: linear-gradient(120deg,#F5D57A,#E6BE58); padding: 4px 10px;
            border-radius: 20px; }
          .mv3-live-pill-top-dot { width: 5px; height: 5px; border-radius: 50%; background: #0B1026;
            animation: mv3PulseGold 1.6s ease-in-out infinite; }
          @keyframes mv3PulseGold { 0%,100% { opacity: 1;} 50% { opacity: .35;} }
          .mv3-legacy-info { border-radius: 20px; overflow: hidden; }
          .mv3-live-block { background: rgba(255,255,255,0.04);
            border: 1px solid rgba(120,180,255,0.14); border-radius: 20px; padding: 14px; }
          .mv3-live-header { display: flex; align-items: center; gap: 10px; }
          .mv3-live-pulse { width: 10px; height: 10px; border-radius: 50%; background: #34E8B0;
            box-shadow: 0 0 0 4px rgba(52,232,176,0.18); animation: mv3PulseDot 1.6s ease-in-out infinite; }
          .mv3-live-text { flex: 1; }
          .mv3-live-title { font-size: 13px; font-weight: 700; color: #EAF3FF; margin: 0; }
          .mv3-live-sub { font-size: 11.5px; color: #9098AE; margin: 2px 0 0; }
          .mv3-live-mapbtn { margin-top: 10px; width: 100%; display: flex; align-items: center; justify-content: center;
            gap: 6px; padding: 10px; border-radius: 12px; background: rgba(255,255,255,0.05);
            border: 1px solid rgba(120,180,255,0.14); color: #EAF3FF; font-size: 12.5px; font-weight: 600;
            cursor: pointer; }
          .mv3-live-mapbtn:hover { background: rgba(255,255,255,0.09); }
          .mv3-docs-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(120,180,255,0.14);
            border-radius: 20px; padding: 14px; color: #EAF3FF; }
          .mv3-propose { padding: 14px; }
          .mv3-propose-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; }
        `}</style>

        {/* Sticky back bar */}
        <div className="mv3-backbar">
          <div className="flex items-center justify-between gap-3">
            <button onClick={() => setOpenMissionId(null)} className="mv3-back-btn">
              <ArrowLeft size={18} /> Missions
            </button>
            {isActive && (
              <span className="mv3-live-pill-top">
                <span className="mv3-live-pill-top-dot" />
                EN COURS
                {getDuration() && <span>· {getDuration()}</span>}
              </span>
            )}
          </div>
        </div>

        {/* Acceptation rapide si proposée */}
        {openMission.statut === "propose" && (
          <div className="mv3-propose">
            <div className="mv3-docs-card">
              <p className="text-sm font-semibold text-white mb-1">Mission proposée</p>
              <p className="text-xs text-white/60">Acceptez ou refusez cette mission pour continuer.</p>
              <div className="mv3-propose-grid">
                <button
                  onClick={() => updateStatus(openMission.id, "accepte")}
                  className="flex items-center justify-center gap-2 py-4 bg-emerald-600 text-white rounded-xl text-base font-semibold hover:bg-emerald-700 active:scale-[0.98]"
                >
                  <Check size={18} /> Accepter
                </button>
                <button
                  onClick={() => updateStatus(openMission.id, "refusee")}
                  className="flex items-center justify-center gap-2 py-4 bg-white/5 text-red-300 border border-red-400/30 rounded-xl text-base font-semibold hover:bg-red-500/10 active:scale-[0.98]"
                >
                  <X size={18} /> Refuser
                </button>
              </div>
            </div>
          </div>
        )}

        {/* === COCKPIT MISSION plein écran === */}
        {openMission.statut !== "propose" && user && rechargeOnly && (
          <RechargeMissionCockpit
            attributionId={openMission.id}
            userId={user.id}
            driverName={driverDisplayName}
            currentEtape={openMission.etape_courante ?? null}
            statut={openMission.statut}
            completions={openMission.options_completion ?? {}}
            missionNumber={openMission.numero_mission ?? null}
            plaque={t?.immatriculation || (t as { vehicule_immatriculation?: string | null } | null)?.vehicule_immatriculation || null}
            depart={t?.depart ?? null}
            rechargePoint={t?.arrivee ?? null}
            onMacroStatusChange={(s: string) => updateStatus(openMission.id, s)}
            onUpdated={fetchMissions}
          />
        )}
        {openMission.statut !== "propose" && user && !rechargeOnly && (
          <MissionCockpit
            attributionId={openMission.id}
            userId={user.id}
            driverName={driverDisplayName}
            clientName={undefined}
            currentEtape={openMission.etape_courante ?? null}
            statut={openMission.statut}
            inspectionDepartDone={!!openMission.inspectionDepart}
            inspectionArriveeDone={!!openMission.inspectionArrivee}
            onStartInspection={(type: "depart" | "arrivee") => openInspection({ attributionId: openMission.id, type })}
            onMacroStatusChange={(s: string) => updateStatus(openMission.id, s)}
            onUpdated={fetchMissions}
            forceOpenSelfie={resumeSelfieMissionId === openMission.id}
            onSelfieModalStateChange={(open: boolean) => {
              if (!open && resumeSelfieMissionId === openMission.id) {
                setResumeSelfieMissionId(null);
              }
            }}
            missionNumber={openMission.numero_mission ?? null}
            departVille={dep.ville}
            arriveeVille={arr.ville}
            activeTab={detailTab}
            onTabChange={setDetailTab}
            infoSlot={infoSlot}
            docsSlot={docsSlot}
          />
        )}
      </div>
      </>
    );
  }


  // === LISTE ===
  const counts = {
    proposed: missions.filter(m => m.statut === "propose").length,
    accepted: missions.filter(m => m.statut === "accepte").length,
    today: missions.filter(m => m.trajet?.date_trajet === new Date().toISOString().split("T")[0]).length,
    in_progress: missions.filter(m => m.statut === "en_cours").length,
    upcoming: missions.filter(m => m.trajet?.date_trajet && m.trajet.date_trajet > new Date().toISOString().split("T")[0]).length,
    done: missions.filter(m => DONE_STATUTS.has(m.statut)).length,
  };

  const filters: { key: FilterKey; label: string; count?: number }[] = [
    { key: "all", label: "Toutes" },
    { key: "proposed", label: "Proposées", count: counts.proposed },
    { key: "accepted", label: "Acceptées", count: counts.accepted },
    { key: "today", label: "Aujourd'hui", count: counts.today },
    { key: "in_progress", label: "En cours", count: counts.in_progress },
    { key: "upcoming", label: "À venir", count: counts.upcoming },
    { key: "done", label: "Terminées", count: counts.done },
  ];

  const emptyMessages: Record<FilterKey, { title: string; hint?: string }> = {
    all: { title: "Aucune mission active pour le moment.", hint: "Consultez le catalogue pour vous positionner sur une mission." },
    proposed: { title: "Vous n'avez aucune proposition pour le moment.", hint: "Dès qu'une mission vous sera proposée, elle apparaîtra ici." },
    accepted: { title: "Aucune mission acceptée en attente.", hint: "Les missions que vous acceptez apparaîtront ici jusqu'au démarrage." },
    in_progress: { title: "Aucune mission en cours.", hint: "Démarrez une mission acceptée pour la voir apparaître ici." },
    today: { title: "Aucune mission prévue aujourd'hui." },
    upcoming: { title: "Aucune mission à venir.", hint: "Positionnez-vous sur une mission depuis le catalogue." },
    done: { title: "Aucune mission terminée.", hint: "Retrouvez l'ensemble de vos missions passées dans l'Historique." },
  };

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
          <p className="text-pro-text text-sm font-medium">
            {search ? "Aucune mission ne correspond à votre recherche." : emptyMessages[filter].title}
          </p>
          {!search && emptyMessages[filter].hint && (
            <p className="text-pro-text-soft text-xs mt-1.5">{emptyMessages[filter].hint}</p>
          )}
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
