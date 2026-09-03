/**
 * Mise en forme lisible des métadonnées d'une notification admin pour l'email.
 * Les identifiants techniques (UUID, clés internes) ne doivent jamais apparaître
 * dans le bloc « Activité plateforme ».
 */

/** Libellés lisibles pour les clés que l'on accepte d'afficher. */
const LABELS: Record<string, string> = {
  prix: 'Montant',
  montant: 'Montant',
  total: 'Total',
  numero: 'Numéro',
  numero_mission: 'Mission',
  numero_devis: 'Devis',
  numero_facture: 'Facture',
  depart: 'Départ',
  arrivee: 'Arrivée',
  ville_depart: 'Départ',
  ville_arrivee: 'Arrivée',
  date_trajet: 'Date du trajet',
  client: 'Client',
  client_nom: 'Client',
  nom: 'Nom',
  email: 'Email',
  telephone: 'Téléphone',
  societe: 'Société',
  convoyeur: 'Convoyeur',
  convoyeur_nom: 'Convoyeur',
  immatriculation: 'Immatriculation',
  marque: 'Marque',
  modele: 'Modèle',
  statut: 'Statut',
  motif: 'Motif',
  type_mission: 'Type de mission',
  distance_km: 'Distance',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Clés purement techniques, jamais affichées dans un email. */
function isTechnicalKey(key: string) {
  const k = key.toLowerCase();
  return (
    k === 'id' ||
    k.endsWith('_id') ||
    k.endsWith('_uuid') ||
    k.startsWith('_') ||
    k.includes('token') ||
    k.includes('secret') ||
    k.includes('url') ||
    k.includes('slug') ||
    k.includes('payload') ||
    k.includes('raw')
  );
}

const MONEY_KEYS = new Set(['prix', 'montant', 'total', 'prix_estime', 'tarif', 'tarif_convoyeur']);

function formatValue(key: string, value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
  if (typeof value === 'object') return null;
  const raw = String(value).trim();
  if (!raw || UUID_RE.test(raw)) return null;
  if (MONEY_KEYS.has(key.toLowerCase()) && !Number.isNaN(Number(raw))) {
    return `${Number(raw).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €`;
  }
  if (key.toLowerCase() === 'distance_km' && !Number.isNaN(Number(raw))) return `${raw} km`;
  return raw;
}

function humanLabel(key: string) {
  if (LABELS[key.toLowerCase()]) return LABELS[key.toLowerCase()];
  const words = key.replace(/[_-]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Transforme les métadonnées brutes en lignes « Libellé / Valeur » lisibles. */
export function buildAlertDetails(
  metadata: unknown,
  max = 6,
): Array<{ label: string; value: string }> {
  const meta = (metadata ?? {}) as Record<string, unknown>;
  if (typeof meta !== 'object') return [];
  const out: Array<{ label: string; value: string }> = [];
  for (const [key, value] of Object.entries(meta)) {
    if (isTechnicalKey(key)) continue;
    const formatted = formatValue(key, value);
    if (!formatted) continue;
    out.push({ label: humanLabel(key), value: formatted });
    if (out.length >= max) break;
  }
  return out;
}
