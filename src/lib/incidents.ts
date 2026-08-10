/**
 * incidents — métadonnées partagées du registre des incidents (admin).
 * Source unique : table `mission_incidents` (même données que les alertes temps réel).
 */

export type IncidentStatut = "ouvert" | "en_cours" | "resolu" | "annule";
export type IncidentGravite = "mineur" | "moyen" | "grave" | "critique";

export const INCIDENT_TYPES: Record<string, string> = {
  retard: "Retard",
  vehicule_non_dispo: "Véhicule non disponible",
  vehicule_non_roulant: "Véhicule non roulant",
  probleme_vehicule: "Problème véhicule",
  client_injoignable: "Client injoignable",
  acces_difficile: "Accès difficile",
  accident: "Accident",
  vol_securite: "Vol / Sécurité",
  autre: "Autre",
};

/** Les types "autre:<libellé>" sont stockés préfixés par le formulaire convoyeur. */
export function incidentTypeLabel(raw: string | null | undefined): string {
  if (!raw) return "Non catégorisé";
  if (raw.startsWith("autre:")) return raw.slice(6) || "Autre";
  return INCIDENT_TYPES[raw] ?? raw;
}

export function incidentTypeKey(raw: string | null | undefined): string {
  if (!raw) return "non_categorise";
  return raw.startsWith("autre:") ? "autre" : raw;
}

export const STATUT_META: Record<IncidentStatut, { label: string; chip: string }> = {
  ouvert: { label: "Nouveau", chip: "bg-red-50 text-red-700 border-red-200" },
  en_cours: { label: "En cours", chip: "bg-amber-50 text-amber-700 border-amber-200" },
  resolu: { label: "Résolu", chip: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  annule: { label: "Sans suite", chip: "bg-slate-100 text-slate-600 border-slate-200" },
};

export const GRAVITE_META: Record<IncidentGravite, { label: string; chip: string; dot: string; order: number }> = {
  critique: { label: "Critique", chip: "bg-red-50 text-red-700 border-red-200", dot: "bg-[#dc2626]", order: 4 },
  grave: { label: "Grave", chip: "bg-orange-50 text-orange-700 border-orange-200", dot: "bg-[#f97316]", order: 3 },
  moyen: { label: "Moyen", chip: "bg-amber-50 text-amber-800 border-amber-200", dot: "bg-[#b8862a]", order: 2 },
  mineur: { label: "Mineur", chip: "bg-blue-50 text-[#2f5fff] border-blue-200", dot: "bg-[#2f5fff]", order: 1 },
};

export function graviteMeta(g: string | null | undefined) {
  return GRAVITE_META[(g ?? "moyen") as IncidentGravite] ?? GRAVITE_META.moyen;
}

export function statutMeta(s: string | null | undefined) {
  return STATUT_META[(s ?? "ouvert") as IncidentStatut] ?? STATUT_META.ouvert;
}

/** Durée de résolution en minutes (null si non résolu). */
export function resolutionMinutes(createdAt: string, resoluAt: string | null): number | null {
  if (!resoluAt) return null;
  return Math.max(0, Math.round((new Date(resoluAt).getTime() - new Date(createdAt).getTime()) / 60000));
}

export function formatDuration(mins: number | null | undefined): string {
  if (mins == null) return "—";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h} h ${String(mins % 60).padStart(2, "0")}`;
  const d = Math.floor(h / 24);
  return `${d} j ${h % 24} h`;
}

export function photosOf(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((u): u is string => typeof u === "string");
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((u): u is string => typeof u === "string") : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Export CSV (séparateur ; pour Excel FR, BOM UTF-8). */
export function downloadCsv(filename: string, rows: Record<string, string | number | null | undefined>[]) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
  const csv = [headers.map(esc).join(";"), ...rows.map((r) => headers.map((h) => esc(r[h])).join(";"))].join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
