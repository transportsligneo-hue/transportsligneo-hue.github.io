type DeliverySchedule = {
  date_livraison?: string | null;
  heure_livraison?: string | null;
};

export function resolveDevisDeliverySchedule(d: DeliverySchedule) {
  return { date: d.date_livraison ?? null, time: d.date_livraison ? d.heure_livraison ?? null : null };
}