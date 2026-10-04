import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface ProMission {
  id: string;
  numero: string;
  ville_depart: string;
  ville_arrivee: string;
  date_prise_en_charge: string;
  heure_prise_en_charge: string | null;
  statut: string;
  prix_total: number;
  created_at: string;
  updated_at: string;
  immatriculation: string | null;
  marque: string | null;
  modele: string | null;
  site_id: string | null;
}

const COLS =
  "id, numero, ville_depart, ville_arrivee, date_prise_en_charge, heure_prise_en_charge, statut, prix_total, created_at, updated_at, immatriculation, marque, modele, site_id";

/** Missions visibles par l'utilisateur pro : les siennes + celles de ses organisations (RLS appliquée). */
export function useProMissions() {
  const { user } = useAuth();
  const [missions, setMissions] = useState<ProMission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const email = user.email ?? "";
      const orFilter = `user_id.eq.${user.id}${email ? `,email.eq.${email}` : ""}`;
      const [{ data: direct }, { data: profile }, { data: members }] = await Promise.all([
        supabase.from("missions").select(COLS).or(orFilter),
        supabase.from("profiles").select("organization_id").eq("user_id", user.id).maybeSingle(),
        supabase.from("organization_members").select("organization_id").eq("user_id", user.id).eq("status", "active"),
      ]);
      const orgIds = Array.from(
        new Set([profile?.organization_id, ...(members ?? []).map((m) => m.organization_id)].filter(Boolean)),
      ) as string[];
      let orgRows: ProMission[] = [];
      if (orgIds.length) {
        const { data } = await supabase
          .from("missions")
          .select(COLS)
          .or(orgIds.map((id) => `organization_id.eq.${id},fleet_organization_id.eq.${id}`).join(","));
        orgRows = (data ?? []) as ProMission[];
      }
      const merged = new Map<string, ProMission>();
      for (const m of [...((direct ?? []) as ProMission[]), ...orgRows]) merged.set(m.id, m);
      if (!cancelled) {
        setMissions(Array.from(merged.values()));
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return { missions, loading };
}

const DONE = new Set(["livree", "terminee"]);
const CANCELLED = new Set(["annulee", "refuse"]);

export const isDone = (s: string) => DONE.has(s);
export const isCancelled = (s: string) => CANCELLED.has(s);

/** Mission en retard : pas livrée/annulée et date de prise en charge dépassée. */
export function isLate(m: ProMission, now = new Date()) {
  if (isDone(m.statut) || isCancelled(m.statut)) return false;
  const d = new Date(m.date_prise_en_charge + "T23:59:59");
  return d.getTime() < now.getTime();
}

/** Livrée à temps : clôturée au plus tard le lendemain de la date prévue. */
export function deliveredOnTime(m: ProMission) {
  if (!isDone(m.statut)) return null;
  const planned = new Date(m.date_prise_en_charge + "T23:59:59").getTime() + 86400000;
  return new Date(m.updated_at).getTime() <= planned;
}

export function computePilotage(missions: ProMission[], now = new Date()) {
  const inTransit = missions.filter((m) => m.statut === "en_cours").length;
  const late = missions.filter((m) => isLate(m, now)).length;
  const sameMonth = (iso: string, offset: number) => {
    const d = new Date(iso);
    const ref = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
  };
  const spend = (offset: number) =>
    missions
      .filter((m) => !isCancelled(m.statut) && sameMonth(m.date_prise_en_charge, offset))
      .reduce((s, m) => s + Number(m.prix_total ?? 0), 0);
  const thisMonth = spend(0);
  const lastMonth = spend(1);
  const since = now.getTime() - 30 * 86400000;
  const recent = missions.filter((m) => isDone(m.statut) && new Date(m.updated_at).getTime() >= since);
  const onTime = recent.filter((m) => deliveredOnTime(m)).length;
  const punctuality = recent.length ? Math.round((onTime / recent.length) * 100) : null;
  return { inTransit, late, thisMonth, lastMonth, punctuality, recentCount: recent.length };
}

export const STATUS_META: Record<string, { label: string; cls: string }> = {
  en_attente: { label: "En attente", cls: "pp-st-wait" },
  confirmee: { label: "Confirmée", cls: "pp-st-wait" },
  en_cours: { label: "En cours", cls: "pp-st-run" },
  livree: { label: "Livrée", cls: "pp-st-done" },
  terminee: { label: "Livrée", cls: "pp-st-done" },
  annulee: { label: "Annulée", cls: "pp-st-ko" },
  refuse: { label: "Refusée", cls: "pp-st-ko" },
};

export const euro = (n: number) =>
  n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";"))
    .join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
