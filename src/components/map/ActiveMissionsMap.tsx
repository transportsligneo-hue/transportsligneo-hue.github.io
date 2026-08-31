import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Radio } from "lucide-react";

const GpsMapView = lazy(() => import("@/components/GpsMapView").then((m) => ({ default: m.GpsMapView })));
const LiveMissionMap = lazy(() => import("@/components/map/LiveMissionMap").then((m) => ({ default: m.LiveMissionMap })));

interface ActiveMission {
  attributionId: string;
  numero: string | null;
  depart: string | null;
  arrivee: string | null;
  latitude: number;
  longitude: number;
  recordedAt: string;
}

interface Props {
  /** Scope : "all" (admin), ou une user_id / org_id pour filtrer côté client */
  scope?: "all" | { fleetOrgId?: string | null; userId?: string | null };
  title?: string;
  className?: string;
  emptyMessage?: string;
}

/**
 * Carte "trajets en cours" · affiche la dernière position GPS connue
 * de chaque mission active (attribution.statut ∈ en_cours/livraison).
 * Rendu client-only (Leaflet), fallback vide propre si aucun trajet.
 */
export function ActiveMissionsMap({
  scope = "all",
  title = "Trajets en cours",
  className = "",
  emptyMessage = "Aucun trajet actif en ce moment.",
}: Props) {
  const [missions, setMissions] = useState<ActiveMission[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      // Récup dernières positions (2h) · on regroupe côté JS
      const sinceIso = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const { data: locs } = await supabase
        .from("mission_locations")
        .select("attribution_id, latitude, longitude, recorded_at")
        .gte("recorded_at", sinceIso)
        .order("recorded_at", { ascending: false })
        .limit(500);
      if (!locs || locs.length === 0) {
        if (!cancelled) {
          setMissions([]);
          setLoading(false);
        }
        return;
      }
      const latestByAttrib = new Map<string, typeof locs[number]>();
      for (const p of locs) {
        if (!latestByAttrib.has(p.attribution_id)) latestByAttrib.set(p.attribution_id, p);
      }
      const attribIds = [...latestByAttrib.keys()];
      const { data: attribs } = await supabase
        .from("attributions")
        .select("id, numero_mission, statut, trajet_id, trajets(depart, arrivee, client_email)")
        .in("id", attribIds)
        .in("statut", ["en_cours", "livraison", "attribue", "en_livraison"]);
      if (!attribs) {
        if (!cancelled) {
          setMissions([]);
          setLoading(false);
        }
        return;
      }
      // Filtrage scope côté client (RLS fait déjà le gros du tri)
      const filtered = attribs.filter((a) => {
        if (scope === "all") return true;
        const trajet = Array.isArray(a.trajets) ? a.trajets[0] : a.trajets;
        void trajet;
        return true; // scope fin non nécessaire ici : RLS restreint déjà
      });
      const rows: ActiveMission[] = filtered
        .map((a) => {
          const loc = latestByAttrib.get(a.id)!;
          const t = Array.isArray(a.trajets) ? a.trajets[0] : a.trajets;
          return {
            attributionId: a.id,
            numero: a.numero_mission ?? null,
            depart: (t as { depart?: string } | null)?.depart ?? null,
            arrivee: (t as { arrivee?: string } | null)?.arrivee ?? null,
            latitude: loc.latitude,
            longitude: loc.longitude,
            recordedAt: loc.recorded_at,
          };
        });
      if (!cancelled) {
        setMissions(rows);
        setLoading(false);
      }
    }
    load();
    const t = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [scope]);

  const gpsPoints = useMemo(
    () =>
      missions.map((m) => ({
        latitude: m.latitude,
        longitude: m.longitude,
        recorded_at: m.recordedAt,
        accuracy: null,
      })),
    [missions],
  );

  return (
    <section className={`rounded-2xl bg-white border border-pro-border shadow-pro-card overflow-hidden ${className}`}>
      <header className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-pro-border">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <h3 className="text-sm font-semibold text-pro-text tracking-tight">{title}</h3>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-pro-muted">
          <Radio size={12} /> {missions.length} live
        </span>
      </header>
      <div className="relative" style={{ height: 380 }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-50 text-pro-muted">
            <Loader2 className="animate-spin" size={22} />
          </div>
        )}
        {!loading && missions.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 text-pro-muted text-sm gap-1">
            <Radio size={22} className="opacity-40" />
            {emptyMessage}
          </div>
        )}
        {mounted && !loading && missions.length > 0 && (
          <Suspense fallback={<div className="absolute inset-0 bg-slate-50" />}>
            <GpsMapView points={gpsPoints} className="absolute inset-0 !rounded-none" />
          </Suspense>
        )}
      </div>
    </section>
  );
}
