export interface DeadlineVehicle {
  id: string;
  marque: string | null;
  modele: string | null;
  immatriculation: string | null;
  controle_technique_expire_le: string | null;
  assurance_expire_le: string | null;
  derniere_revision_le: string | null;
  intervalle_revision_mois: number | null;
}

export interface FleetDeadline {
  vehicle: DeadlineVehicle;
  kind: "ct" | "revision" | "assurance";
  date: string;
  days: number;
}

export const DEADLINE_HORIZON_DAYS = 60;

const DAY = 86400000;
const toUtc = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());

function daysUntil(iso: string, now: Date) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - toUtc(now)) / DAY);
}

function addMonths(iso: string, months: number) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + months, d));
  return dt.toISOString().slice(0, 10);
}

/** Échéances dépassées ou à moins de 60 jours, de la plus urgente à la moins urgente. */
export function computeFleetDeadlines(vehicles: DeadlineVehicle[], now: Date): FleetDeadline[] {
  const out: FleetDeadline[] = [];
  for (const v of vehicles) {
    const push = (kind: FleetDeadline["kind"], date: string | null) => {
      if (!date) return;
      const days = daysUntil(date, now);
      if (days <= DEADLINE_HORIZON_DAYS) out.push({ vehicle: v, kind, date: date.slice(0, 10), days });
    };
    push("ct", v.controle_technique_expire_le);
    push("assurance", v.assurance_expire_le);
    if (v.derniere_revision_le) push("revision", addMonths(v.derniere_revision_le, v.intervalle_revision_mois || 12));
  }
  return out.sort((a, b) => a.days - b.days);
}
