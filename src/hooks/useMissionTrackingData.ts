import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ConvoyeurInfo {
  prenom: string | null;
  nom: string | null;
  email: string | null;
  telephone: string | null;
  ville: string | null;
}

export interface EtapeRow {
  id: string;
  etape: string;
  notes: string | null;
  created_at: string;
}

export interface IncidentRow {
  id: string;
  titre: string;
  description: string;
  gravite: string;
  statut: string;
  created_at: string;
  photos: string[];
}

export interface TrackingData {
  loading: boolean;
  convoyeur: ConvoyeurInfo | null;
  history: EtapeRow[];
  incidents: IncidentRow[];
  /** Heure de démarrage effectif (1ère étape enregistrée). */
  startedAt: string | null;
  /** Heure de fin (étape "termine" ou statut validé/terminé). */
  endedAt: string | null;
}

/**
 * Charge les données de suivi (lecture seule) pour le client :
 * convoyeur, historique d'étapes complet, incidents.
 * Realtime : mise à jour automatique sur INSERT mission_etape_history.
 */
export function useMissionTrackingData(
  attributionId: string | null,
  convoyeurId: string | null,
): TrackingData {
  const [convoyeur, setConvoyeur] = useState<ConvoyeurInfo | null>(null);
  const [history, setHistory] = useState<EtapeRow[]>([]);
  const [incidents, setIncidents] = useState<IncidentRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Convoyeur
  useEffect(() => {
    let cancelled = false;
    if (!convoyeurId) {
      setConvoyeur(null);
      return;
    }
    void (async () => {
      const { data } = await supabase
        .from("convoyeurs")
        .select("prenom, nom, email, telephone, ville")
        .eq("id", convoyeurId)
        .maybeSingle();
      if (!cancelled) setConvoyeur((data as ConvoyeurInfo | null) ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [convoyeurId]);

  // History + incidents
  useEffect(() => {
    let cancelled = false;
    if (!attributionId) {
      setHistory([]);
      setIncidents([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    void (async () => {
      const [{ data: hist }, { data: inc }] = await Promise.all([
        supabase
          .from("mission_etape_history")
          .select("id, etape, notes, created_at")
          .eq("attribution_id", attributionId)
          .order("created_at", { ascending: true }),
        supabase
          .from("mission_incidents")
          .select("id, type_incident, description, created_at, photos_urls")
          .eq("attribution_id", attributionId)
          .order("created_at", { ascending: false }),
      ]);
      if (cancelled) return;
      setHistory((hist as EtapeRow[] | null) ?? []);
      setIncidents(
        ((inc as
          | { id: string; type_incident: string | null; description: string | null; created_at: string; photos_urls: string[] | null }[]
          | null) ?? []).map((i) => ({
          id: i.id,
          type: i.type_incident,
          description: i.description,
          created_at: i.created_at,
          photos: i.photos_urls ?? [],
        })),
      );
      setLoading(false);
    })();

    const channel = supabase
      .channel(`mission-tracking-${attributionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mission_etape_history", filter: `attribution_id=eq.${attributionId}` },
        (payload) => {
          const row = payload.new as EtapeRow;
          setHistory((prev) => (prev.some((p) => p.id === row.id) ? prev : [...prev, row]));
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mission_incidents", filter: `attribution_id=eq.${attributionId}` },
        (payload) => {
          const r = payload.new as {
            id: string;
            type_incident: string | null;
            description: string | null;
            created_at: string;
            photos_urls: string[] | null;
          };
          setIncidents((prev) => [
            { id: r.id, type: r.type_incident, description: r.description, created_at: r.created_at, photos: r.photos_urls ?? [] },
            ...prev,
          ]);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [attributionId]);

  const startedAt = history.length > 0 ? history[0].created_at : null;
  const endEvent = [...history].reverse().find((h) => h.etape === "termine" || h.etape === "livraison");
  const endedAt = endEvent?.created_at ?? null;

  return { loading, convoyeur, history, incidents, startedAt, endedAt };
}
