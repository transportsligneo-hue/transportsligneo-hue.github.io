import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface MissionRealtimeState {
  statut: string | null;
  etape_courante: string | null;
  lastGps: { latitude: number; longitude: number; recorded_at: string; accuracy: number | null } | null;
  lastEtape: { etape: string; created_at: string; notes: string | null } | null;
  documentsCount: number;
  bumpKey: number;
}

/**
 * Hook realtime unifié — écoute toutes les mutations d'une mission (attribution).
 * Utilisable depuis admin, convoyeur, client et B2B.
 */
export function useMissionRealtime(attributionId: string | null) {
  const [state, setState] = useState<MissionRealtimeState>({
    statut: null,
    etape_courante: null,
    lastGps: null,
    lastEtape: null,
    documentsCount: 0,
    bumpKey: 0,
  });
  const bumpRef = useRef(0);

  useEffect(() => {
    if (!attributionId) return;
    let cancelled = false;

    // initial fetch
    (async () => {
      const [{ data: a }, { data: g }, { data: h }, { data: docs }] = await Promise.all([
        supabase.from("attributions").select("statut, etape_courante").eq("id", attributionId).maybeSingle(),
        supabase
          .from("mission_locations")
          .select("latitude, longitude, recorded_at, accuracy")
          .eq("attribution_id", attributionId)
          .order("recorded_at", { ascending: false })
          .limit(1),
        supabase
          .from("mission_etape_history")
          .select("etape, created_at, notes")
          .eq("attribution_id", attributionId)
          .order("created_at", { ascending: false })
          .limit(1),
        supabase.from("mission_documents").select("id", { count: "exact", head: true }).eq("attribution_id", attributionId),
      ]);
      if (cancelled) return;
      setState((prev) => ({
        ...prev,
        statut: a?.statut ?? null,
        etape_courante: a?.etape_courante ?? null,
        lastGps: g?.[0] ?? null,
        lastEtape: h?.[0] ?? null,
        documentsCount: docs ? (docs as unknown as { length: number }).length ?? 0 : prev.documentsCount,
      }));
    })();

    const bump = () => {
      bumpRef.current += 1;
      setState((prev) => ({ ...prev, bumpKey: bumpRef.current }));
    };

    const channel = supabase
      .channel(`mission-rt-${attributionId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "attributions", filter: `id=eq.${attributionId}` }, (payload) => {
        const n = payload.new as { statut: string; etape_courante: string | null };
        setState((prev) => ({ ...prev, statut: n.statut, etape_courante: n.etape_courante, bumpKey: ++bumpRef.current }));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mission_locations", filter: `attribution_id=eq.${attributionId}` }, (payload) => {
        const p = payload.new as { latitude: number; longitude: number; recorded_at: string; accuracy: number | null };
        setState((prev) => ({ ...prev, lastGps: p, bumpKey: ++bumpRef.current }));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mission_etape_history", filter: `attribution_id=eq.${attributionId}` }, (payload) => {
        const e = payload.new as { etape: string; created_at: string; notes: string | null };
        setState((prev) => ({ ...prev, lastEtape: e, bumpKey: ++bumpRef.current }));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mission_documents", filter: `attribution_id=eq.${attributionId}` }, () => {
        setState((prev) => ({ ...prev, documentsCount: prev.documentsCount + 1, bumpKey: ++bumpRef.current }));
        bump();
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [attributionId]);

  return state;
}
