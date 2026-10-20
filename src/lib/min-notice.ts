/** Délai minimum de prévenance entre la demande et la prise en charge (heures). */
export const MIN_NOTICE_HOURS = 12;

/** Retourne un message d'erreur si la date/heure souhaitée est trop proche, sinon null. */
export function checkMinNotice(date: string, heure?: string | null, now: Date = new Date()): string | null {
  if (!date) return null;
  const when = new Date(`${date}T${heure && /^\d{2}:\d{2}/.test(heure) ? heure.slice(0, 5) : "00:00"}:00`);
  if (Number.isNaN(when.getTime())) return null;
  const earliest = new Date(now.getTime() + MIN_NOTICE_HOURS * 3600_000);
  if (when >= earliest) return null;
  const d = earliest.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  return `Nous ne pouvons pas prendre en charge un véhicule à moins de ${MIN_NOTICE_HOURS} h. Merci de choisir une date à partir de ${d} (${earliest.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}), ou appelez-nous au 07 82 45 61 81 pour une demande urgente.`;
}
