import { lazy, Suspense, useEffect, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import type { LiveGpsPoint, LiveMetricsSnapshot } from "@/components/map/types";

const LiveMissionMap = lazy(() =>
  import("@/components/map/LiveMissionMap").then((m) => ({ default: m.LiveMissionMap })),
);

// Trajet de démonstration réel Tours → Bordeaux (points de passage autoroute A10)
const WAYPOINTS: Array<[number, number]> = [
  [47.3941, 0.6848], [47.2, 0.62], [46.95, 0.55], [46.58, 0.34], [46.3, 0.12],
  [45.95, -0.25], [45.65, -0.45], [45.3, -0.55], [45.05, -0.58], [44.8378, -0.5792],
];

function interpolate(t: number): [number, number] {
  const seg = (WAYPOINTS.length - 1) * t;
  const i = Math.min(Math.floor(seg), WAYPOINTS.length - 2);
  const f = seg - i;
  const [a, b] = [WAYPOINTS[i], WAYPOINTS[i + 1]];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
}

function buildPoints(progress: number): LiveGpsPoint[] {
  const now = Date.now();
  const steps = Math.max(2, Math.round(progress * 60));
  return Array.from({ length: steps }, (_, k) => {
    const t = (progress * k) / (steps - 1);
    const [lat, lng] = interpolate(t);
    return {
      latitude: lat,
      longitude: lng,
      recorded_at: new Date(now - (steps - 1 - k) * 60_000).toISOString(),
      speed: 30,
    };
  });
}

export function DemoLiveMap({ onMetrics }: { onMetrics?: (m: LiveMetricsSnapshot | null) => void }) {
  const [progress, setProgress] = useState(0.55);
  const [points, setPoints] = useState<LiveGpsPoint[]>([]);

  useEffect(() => {
    setPoints(buildPoints(progress));
  }, [progress]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setProgress((p) => (p >= 0.97 ? 0.35 : p + 0.004));
    }, 4000);
    return () => window.clearInterval(id);
  }, []);

  const fallback = <div className="h-[300px] w-full rounded-xl bg-white/[0.04]" />;
  return (
    <ClientOnly fallback={fallback}>
      <Suspense fallback={fallback}>
        {points.length > 0 && (
          // Conteneur à hauteur fixe : .ligneo-mbx force height:100%, il faut
          // un parent dimensionné sinon la carte s'étire et pousse la suite hors du cadre.
          <div className="h-[300px] w-full">
            <LiveMissionMap
              className="h-full w-full overflow-hidden rounded-xl"
            points={points}
            origin={{ lat: WAYPOINTS[0][0], lng: WAYPOINTS[0][1], label: "Tours" }}
            destination={{ lat: 44.8378, lng: -0.5792, label: "Bordeaux" }}
            role="client"
            title="Mission démo"
            onMetrics={onMetrics}
            />
          </div>
        )}
      </Suspense>
    </ClientOnly>
  );
}
