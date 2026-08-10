/** Types partagés du registre des incidents (vue admin aplatie). */

export interface IncidentRow {
  id: string;
  attribution_id: string;
  type_incident: string | null;
  titre: string;
  description: string;
  gravite: string;
  statut: string;
  photos: unknown;
  latitude: number | null;
  longitude: number | null;
  reponse_admin: string | null;
  assigned_to: string | null;
  prise_en_charge_at: string | null;
  resolu_at: string | null;
  created_at: string;
  /** Contexte mission (aplati depuis attributions/trajets/convoyeurs) */
  numero_mission: string | null;
  mission_statut: string | null;
  mission_etape: string | null;
  depart: string | null;
  arrivee: string | null;
  client_nom: string | null;
  client_tel: string | null;
  convoyeur_id: string | null;
  convoyeur_nom: string | null;
  convoyeur_tel: string | null;
}

export interface AdminOption {
  user_id: string;
  label: string;
}
