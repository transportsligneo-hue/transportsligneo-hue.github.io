import { lazy, Suspense, useEffect, useState } from "react";
import type { LiveMissionMapProps } from "./types";

export type { LiveGpsPoint, LiveMissionMapProps } from "./types";

/** Clé publique Mapbox — fournie via la variable d'environnement VITE_MAPBOX_TOKEN. */
export const MAPBOX_TOKEN: string = (import.meta.env.VITE_MAPBOX_TOKEN as string | undefined) ?? "";
export const hasMapbox = MAPBOX_TOKEN.length > 0;

const MapboxImpl = lazy(() => import("./MapboxLiveMap").then((m) => ({ default: m.MapboxLiveMap })));
const LeafletImpl = lazy(() => import("./LeafletLiveMap").then((m) => ({ default: m.LeafletLiveMap })));

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-900/5 ${className ?? ""}`}
      style={{ minHeight: 260 }}
    >
      <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-slate-100 to-slate-200" />
    </div>
  );
}

/**
 * Carte de suivi live (rendu façon Uber/Deliveroo).
 * Utilise Mapbox GL JS dès que VITE_MAPBOX_TOKEN est disponible,
 * sinon bascule automatiquement sur le rendu Leaflet/OSM historique.
 */
export function LiveMissionMap(props: LiveMissionMapProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <Skeleton className={props.className} />;

  const Impl = hasMapbox ? MapboxImpl : LeafletImpl;
  return (
    <Suspense fallback={<Skeleton className={props.className} />}>
      <Impl {...props} />
    </Suspense>
  );
}

export default LiveMissionMap;
