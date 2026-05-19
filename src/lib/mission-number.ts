/** Numéro mission MIS-YYYY-XXXX dérivé déterministe depuis created_at + id */
export function formatMissionNumber(id: string, createdAt: string): string {
  const year = new Date(createdAt).getFullYear();
  const hex = id.replace(/-/g, "").slice(-6);
  const num = (parseInt(hex, 16) % 9999) + 1;
  return `MIS-${year}-${String(num).padStart(4, "0")}`;
}

export function missionNumberOf(row: {
  id: string;
  created_at: string;
  numero_mission?: string | null;
}): string {
  return row.numero_mission || formatMissionNumber(row.id, row.created_at);
}
