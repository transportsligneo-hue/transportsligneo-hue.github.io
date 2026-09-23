import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Radio } from "lucide-react";
import { SIGNAL_STALE_MIN } from "@/lib/mission-live-metrics";

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
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      // 1) Missions actives (indépendamment de la fraîcheur GPS)
      const { data: attribs } = await supabase
        .from("attributions")
        .select("id, numero_mission, statut, trajet_id, trajets(depart, arrivee, client_email)")
        .in("statut", ["en_cours", "livraison", "attribue", "en_livraison"])
        .order("created_at", { ascending: false })
        .limit(100);
      if (!attribs || attribs.length === 0) {
        if (!cancelled) {
          setMissions([]);
          setLoading(false);
        }
        return;
      }
      // 2) Dernière position connue de chacune (pas de fenêtre temporelle stricte)
      const attribIds = attribs.map((a) => a.id);
      const { data: locs } = await supabase
        .from("mission_locations")
        .select("attribution_id, latitude, longitude, recorded_at")
        .in("attribution_id", attribIds)
        .order("recorded_at", { ascending: false })
        .limit(2000);
      const latestByAttrib = new Map<string, NonNullable<typeof locs>[number]>();
      for (const p of locs ?? []) {
        if (!latestByAttrib.has(p.attribution_id)) latestByAttrib.set(p.attribution_id, p);
      }
      const rows: ActiveMission[] = attribs
        .filter((a) => latestByAttrib.has(a.id))
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
        setNow(Date.now());
      }
    }
    load();
    const t = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [scope]);

  const freshMissions = missions.filter((m) => now - new Date(m.recordedAt).getTime() <= SIGNAL_STALE_MIN * 60_000);

  const gpsPoints = useMemo(
    () =>
      missions.length === 1 ? missions.map((m) => ({
        latitude: m.latitude,
        longitude: m.longitude,
        recorded_at: m.recordedAt,
        accuracy: null,
      })) : [],
    [missions],
  );

  const fleetPoints = useMemo(
    () =>
      freshMissions.map((m) => ({
        lat: m.latitude,
        lng: m.longitude,
        label: [m.numero, m.depart && m.arrivee ? `${m.depart} → ${m.arrivee}` : null].filter(Boolean).join(" · ") || undefined,
      })),
    [missions, now],
  );

  return (
    <section className={`rounded-2xl bg-white border border-pro-border shadow-pro-card overflow-hidden ${className}`}>
      <header className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-pro-border">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            {freshMissions.length > 0 && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />}
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${freshMissions.length ? "bg-emerald-500" : "bg-amber-500"}`} />
          </span>
          <h3 className="text-sm font-semibold text-pro-text tracking-tight">{title}</h3>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-pro-muted">
          <Radio size={12} /> {freshMissions.length} suivi{freshMissions.length > 1 ? "s" : ""} en direct{missions.length > freshMissions.length ? ` · ${missions.length - freshMissions.length} sans signal` : ""}
        </span>
      </header>
      <div className="relative" style={{ height: 380 }}>
        {mounted && (
          <Suspense fallback={<div className="absolute inset-0 bg-slate-50" />}>
            {missions.length === 1 && freshMissions.length === 1 ? (
              <LiveMissionMap
                points={gpsPoints}
                origin={missions[0].depart}
                destination={missions[0].arrivee}
                title={missions[0].numero ?? undefined}
                role="admin"
                className="absolute inset-0 !rounded-none"
              />
            ) : freshMissions.length > 0 ? (
              <LiveMissionMap points={[]} fleet={fleetPoints} hideOverlay className="absolute inset-0 !rounded-none" />
            ) : null}
          </Suspense>
        )}
        {loading && (
          <div className="absolute inset-0 z-[401] flex items-center justify-center bg-white/60 text-pro-muted backdrop-blur-sm">
            <Loader2 className="animate-spin" size={22} />
          </div>
        )}
        {!loading && missions.length === 0 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-4 z-[401] flex justify-center">
            <div className="flex items-center gap-1.5 rounded-2xl border border-white/70 bg-white/92 px-4 py-3 text-sm text-pro-text-soft shadow-2xl backdrop-blur-xl">
              <Radio size={16} className="opacity-40" />
              {emptyMessage}
            </div>
          </div>
        )}
        {!loading && missions.length > 0 && freshMissions.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-pro-bg px-5 text-center text-sm text-pro-muted">
            <Radio size={22} />
            <strong className="text-pro-text">Aucune position GPS récente</strong>
            <span>L'emplacement actuel des véhicules est inconnu.</span>
            {missions.length === 1 && <span>Dernière position reçue le {new Date(missions[0].recordedAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}.</span>}
          </div>
        )}
      </div>
    </section>
  );
}
