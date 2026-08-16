/**
 * Badges des plateformes de PV digitalisés (moDel / Welcome Auto) affichés
 * à côté du client dans l'admin (Missions, Attributions).
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PV_PLATEFORMES, PvLogo, pvDef } from "@/components/mission/pv-plateformes";

const cache = new Map<string, string[]>();

/** attribution_id -> plateformes PV actives */
export function useMissionPv(attributionIds: (string | null | undefined)[]) {
  const key = Array.from(new Set(attributionIds.filter(Boolean) as string[])).sort().join("|");
  const [map, setMap] = useState<Map<string, string[]>>(new Map(cache));

  useEffect(() => {
    const list = key ? key.split("|") : [];
    const missing = list.filter((id) => !cache.has(id));
    if (missing.length === 0) {
      setMap(new Map(cache));
      return;
    }
    let cancelled = false;
    supabase
      .from("mission_pv_digitaux")
      .select("attribution_id, plateforme, actif")
      .in("attribution_id", missing)
      .eq("actif", true)
      .then(({ data }) => {
        missing.forEach((id) => cache.set(id, []));
        ((data ?? []) as { attribution_id: string; plateforme: string }[]).forEach((r) => {
          if (!PV_PLATEFORMES.some((p) => p.key === r.plateforme)) return;
          const cur = cache.get(r.attribution_id) ?? [];
          if (!cur.includes(r.plateforme)) cache.set(r.attribution_id, [...cur, r.plateforme]);
        });
        if (!cancelled) setMap(new Map(cache));
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return map;
}

export function pvOf(map: Map<string, string[]>, attributionId: string | null | undefined) {
  if (!attributionId) return [];
  return map.get(attributionId) ?? [];
}

/** Petits logos des plateformes PV (moDel, Welcome Auto). */
export function MissionPvBadges({
  plateformes,
  size = 18,
  className = "",
}: {
  plateformes: string[];
  size?: number;
  className?: string;
}) {
  const defs = plateformes.map((p) => pvDef(p)).filter(Boolean);
  if (defs.length === 0) return null;
  return (
    <span className={`inline-flex items-center gap-1 align-middle ${className}`}>
      {defs.map((d) => (
        <span key={d!.key} title={`PV digitalisé ${d!.label}`} className="inline-flex">
          <PvLogo def={d!} size={size} />
        </span>
      ))}
    </span>
  );
}
