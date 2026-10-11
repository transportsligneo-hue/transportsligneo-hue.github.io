/** Calculs d'échéances de la fiche véhicule, partagés par la fenêtre d'ajout et ses tests. */
export function daysUntil(date: string | null | undefined, now = new Date()): number | null {
  if (!date) return null;
  const t = new Date(`${date}T00:00:00`).getTime();
  if (!Number.isFinite(t)) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((t - today) / 86_400_000);
}

export type DueTone = "empty" | "ok" | "soon" | "urgent" | "late";
export function dueTone(days: number | null): DueTone {
  if (days === null) return "empty";
  if (days < 0) return "late";
  if (days <= 30) return "urgent";
  if (days <= 60) return "soon";
  return "ok";
}

export function addMonths(date: string, months: number): string {
  const d = new Date(`${date}T00:00:00`);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

/** Premier contrôle technique : 4 ans après la mise en circulation. */
export function firstTechnicalControl(miseEnCirculation: string): string {
  return addMonths(miseEnCirculation, 48);
}

/** Prochaine révision : au premier atteint entre l'intervalle km et l'intervalle en mois. */
export function nextRevision(input: {
  lastDate: string | null; lastKm: number | null; currentKm: number | null;
  intervalKm: number; intervalMonths: number; kmPerMonth: number; now?: Date;
}) {
  const now = input.now ?? new Date();
  const baseKm = input.lastKm ?? input.currentKm ?? 0;
  const nextKm = baseKm + input.intervalKm;
  const current = input.currentKm ?? baseKm;
  const remainingKm = Math.max(0, nextKm - current);
  const byKm = new Date(now.getTime() + (remainingKm / Math.max(1, input.kmPerMonth)) * 30.44 * 86_400_000);
  const byTime = input.lastDate ? new Date(`${addMonths(input.lastDate, input.intervalMonths)}T00:00:00`) : null;
  const date = byTime && byTime < byKm ? byTime : byKm;
  const progress = Math.min(1, Math.max(0, (current - baseKm) / input.intervalKm));
  return { nextKm, remainingKm, date: date.toISOString().slice(0, 10), progress };
}

export function annualCost(loyer: number | null, assurance: number | null, entretien: number | null): number {
  return (loyer ?? 0) * 12 + (assurance ?? 0) + (entretien ?? 0);
}
