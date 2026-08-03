/** Numéro mission MIS-TLG-YYYY-#XXX dérivé déterministe depuis created_at + id */
export function formatMissionNumber(id: string, createdAt: string): string {
  const year = new Date(createdAt).getFullYear();
  const hex = id.replace(/-/g, "").slice(-6);
  const num = (parseInt(hex, 16) % 999) + 1;
  return `MIS-TLG-${year}-#${String(num).padStart(3, "0")}`;
}

export function missionNumberOf(row: {
  id: string;
  created_at: string;
  numero_mission?: string | null;
}): string {
  return row.numero_mission || formatMissionNumber(row.id, row.created_at);
}

/**
 * Référence d'un trajet, suffixée A (livraison) / R (restitution)
 * pour les missions livraison + restitution. Les deux volets partagent
 * le même numéro de base (dérivé du mission_group_id).
 */
export function formatTrajetRef(opts: {
  id: string;
  createdAt: string;
  groupId?: string | null;
  isRoundTrip?: boolean;
  legType?: string | null;
  legIndex?: number | null;
}): string {
  const base = formatMissionNumber(opts.groupId ?? opts.id, opts.createdAt);
  if (!opts.isRoundTrip) return base;
  const isRetour = opts.legType === "retour" || opts.legIndex === 2;
  return `${base}${isRetour ? "R" : "A"}`;
}
