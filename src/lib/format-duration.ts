/** Formate une durée en minutes façon FR : "45 min", "3 h 20", "1 j 2 h". */
export function formatDureeMinutes(totalMinutes: number): string {
  const m = Math.max(0, Math.round(totalMinutes));
  if (m < 60) return `${m} min`;
  const heures = Math.floor(m / 60);
  const minutes = m % 60;
  if (heures < 24) {
    return minutes === 0 ? `${heures} h` : `${heures} h ${String(minutes).padStart(2, "0")}`;
  }
  const jours = Math.floor(heures / 24);
  const restHeures = heures % 24;
  return restHeures === 0 ? `${jours} j` : `${jours} j ${restHeures} h`;
}

/** Heure d'arrivée : ajoute le jour si l'ETA n'est pas aujourd'hui. */
export function formatEta(date: Date): string {
  const heure = date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const now = new Date();
  const sameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
  if (sameDay) return heure;
  return `${date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })} · ${heure}`;
}
