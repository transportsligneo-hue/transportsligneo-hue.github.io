import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Maximize2, X, Radio } from "lucide-react";
import type { LiveMissionMapProps } from "./types";

export type { LiveGpsPoint, LiveMissionMapProps } from "./types";

export { MAPBOX_TOKEN, hasMapbox } from "@/lib/mapbox-token";
import { hasMapbox } from "@/lib/mapbox-token";

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
function MapImpl(props: LiveMissionMapProps) {
  const Impl = hasMapbox ? MapboxImpl : LeafletImpl;
  return (
    <Suspense fallback={<Skeleton className={props.className} />}>
      <Impl {...props} />
    </Suspense>
  );
}

/**
 * Sur téléphone (espaces client, flotte, admin) : la carte est compacte et ne capte pas le défilement ;
 * un appui ouvre une page plein écran avec le GPS en direct, façon application.
 */
export function LiveMissionMap(props: LiveMissionMapProps) {
  const [mounted, setMounted] = useState(false);
  const [compact, setCompact] = useState(false);
  const [full, setFull] = useState(false);
  const holder = useRef<HTMLDivElement>(null);
  useEffect(() => setMounted(true), []);

  const eligible = !props.hideOverlay && !props.fleet && !props.worldOverview;
  useEffect(() => {
    if (!mounted || !eligible) return;
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setCompact(mq.matches && !!holder.current?.closest(".dash-main-mobile"));
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [mounted, eligible]);

  // Bouton « retour » du téléphone : ferme le plein écran
  useEffect(() => {
    if (!full) return;
    history.pushState({ lgMap: 1 }, "");
    const onPop = () => setFull(false);
    window.addEventListener("popstate", onPop);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("popstate", onPop);
      document.body.style.overflow = prev;
    };
  }, [full]);
  const closeFull = () => { if (history.state?.lgMap) history.back(); else setFull(false); };

  if (!mounted) return <Skeleton className={props.className} />;
  if (!compact) return <div ref={holder} className="contents"><MapImpl {...props} /></div>;

  if (full) {
    return createPortal(
      <div className="lgmap-full" role="dialog" aria-modal="true" aria-label="Suivi GPS en direct">
        <div className="lgmap-full-bar">
          <button type="button" onClick={closeFull} aria-label="Fermer"><X size={22} /></button>
          <div><b>{props.title || "Suivi GPS en direct"}</b><span><Radio size={12} /> Position en temps réel</span></div>
        </div>
        <div className="lgmap-full-map"><MapImpl {...props} className="absolute inset-0 !rounded-none" /></div>
      </div>,
      document.body,
    );
  }

  return (
    <div ref={holder} className="lgmap-compact">
      <div className="lgmap-compact-map" aria-hidden="true">
        <MapImpl {...props} hideOverlay className="absolute inset-0 !rounded-none" />
      </div>
      <button type="button" className="lgmap-compact-hit" onClick={() => setFull(true)} aria-label="Ouvrir le suivi GPS en plein écran">
        <span className="lgmap-compact-cta"><Maximize2 size={16} /> Voir le GPS en direct</span>
      </button>
    </div>
  );
}

export default LiveMissionMap;
