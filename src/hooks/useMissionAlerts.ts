/**
 * useMissionAlerts — chargement temps réel des alertes opérationnelles (admin).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SEVERITY_META, type AlertSeverity, type MissionAlertRow } from "@/lib/mission-alerts";

export interface MissionAlert extends MissionAlertRow {
  attribution: {
    id: string;
    trajet_id: string | null;
    numero_mission: string | null;
    etape_courante: string | null;
    statut: string | null;
    convoyeur: { nom: string | null; prenom: string | null; telephone: string | null } | null;
    trajet: {
      depart: string | null;
      arrivee: string | null;
      client_nom: string | null;
      client_telephone: string | null;
      date_trajet: string | null;
      heure_trajet: string | null;
    } | null;
  } | null;
}

const SELECT = `
  id, attribution_id, alert_type, severity, base_severity, status, titre, message, details,
  triggered_at, escalated_at, acknowledged_at, resolved_at,
  attributions!inner (
    id, trajet_id, numero_mission, etape_courante, statut,
    convoyeurs ( nom, prenom, telephone ),
    trajets ( depart, arrivee, client_nom, client_telephone, date_trajet, heure_trajet )
  )
`;

function normalize(row: any): MissionAlert {
  const a = row.attributions ?? null;
  const conv = Array.isArray(a?.convoyeurs) ? a?.convoyeurs[0] : a?.convoyeurs;
  const traj = Array.isArray(a?.trajets) ? a?.trajets[0] : a?.trajets;
  return {
    ...row,
    attribution: a
      ? {
          id: a.id,
          trajet_id: a.trajet_id ?? null,
          numero_mission: a.numero_mission ?? null,
          etape_courante: a.etape_courante ?? null,
          statut: a.statut ?? null,
          convoyeur: conv ?? null,
          trajet: traj ?? null,
        }
      : null,
  };
}

export function useMissionAlerts(scope: "active" | "history" = "active", limit = 200) {
  const [alerts, setAlerts] = useState<MissionAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = useCallback(async () => {
    let q = supabase
      .from("mission_alerts" as never)
      .select(SELECT as never)
      .order("triggered_at", { ascending: false })
      .limit(limit);
    q =
      scope === "active"
        ? q.in("status" as never, ["open", "acknowledged"] as never)
        : q.eq("status" as never, "resolved" as never);
    const { data } = await q;
    setAlerts(((data as unknown as any[]) ?? []).map(normalize));
    setLoading(false);
  }, [scope, limit]);

  useEffect(() => {
    setLoading(true);
    fetchAlerts();
    const channel = supabase
      .channel(`mission-alerts-${scope}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "mission_alerts" }, () => fetchAlerts())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAlerts, scope]);

  const sorted = useMemo(
    () =>
      [...alerts].sort((a, b) => {
        const s = SEVERITY_META[b.severity].order - SEVERITY_META[a.severity].order;
        if (s !== 0) return s;
        return new Date(a.triggered_at).getTime() - new Date(b.triggered_at).getTime();
      }),
    [alerts],
  );

  const counts = useMemo(() => {
    const c: Record<AlertSeverity, number> = { critique: 0, attention: 0, info: 0 };
    alerts.forEach((a) => { c[a.severity] = (c[a.severity] ?? 0) + 1; });
    return { ...c, total: alerts.length };
  }, [alerts]);

  /** Sévérité la plus haute par trajet (pour pastilles dans la liste missions). */
  const byTrajet = useMemo(() => {
    const m = new Map<string, AlertSeverity>();
    alerts.forEach((a) => {
      const tid = a.attribution?.trajet_id;
      if (!tid) return;
      const cur = m.get(tid);
      if (!cur || SEVERITY_META[a.severity].order > SEVERITY_META[cur].order) m.set(tid, a.severity);
    });
    return m;
  }, [alerts]);

  return { alerts: sorted, counts, byTrajet, loading, refetch: fetchAlerts };
}
