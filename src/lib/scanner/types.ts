/**
 * Types partagés du scanner premium TRANSPORTS LIGNEO.
 *
 * `ExtractedFields` est la représentation NORMALISÉE utilisée pour préremplir
 * les formulaires de création de mission (admin, client, pro). Chaque champ
 * est optionnel — on ne remplit que ce qui a été détecté avec fiabilité.
 *
 * Le serveur (extract.functions.ts) renvoie ce format quel que soit le type
 * de document scanné (carte grise, CPI, bon de commande, PV, facture…).
 */

export type DocumentType =
  | "carte_grise"
  | "cpi"
  | "bon_commande"
  | "bon_livraison"
  | "pv_livraison"
  | "pv_restitution"
  | "mandat"
  | "facture"
  | "devis"
  | "document_constructeur"
  | "inconnu";

export const DOCUMENT_LABEL: Record<DocumentType, string> = {
  carte_grise: "Carte grise",
  cpi: "Certificat provisoire d'immatriculation",
  bon_commande: "Bon de commande",
  bon_livraison: "Bon de livraison",
  pv_livraison: "PV de livraison",
  pv_restitution: "PV de restitution",
  mandat: "Mandat",
  facture: "Facture",
  devis: "Devis",
  document_constructeur: "Document constructeur",
  inconnu: "Document",
};

export interface ExtractedFields {
  // Véhicule
  vin?: string;
  immatriculation?: string;
  marque?: string;
  modele?: string;
  version?: string;
  energie?: string;
  puissance?: string;
  couleur?: string;
  date_mec?: string; // ISO 8601 ou français
  kilometrage?: string;

  // Titulaire / client
  titulaire_nom?: string;
  titulaire_adresse?: string;
  client_nom?: string;
  client_email?: string;
  client_telephone?: string;

  // Contexte pro
  concession?: string;
  garage?: string;
  numero_commande?: string;
  numero_dossier?: string;
  numero_facture?: string;

  // Livraison / trajet
  lieu_depart?: string;
  lieu_arrivee?: string;
  date_livraison?: string;
  observations?: string;
}

export interface ExtractionResult {
  document_type: DocumentType;
  confidence: number; // 0..1
  fields: ExtractedFields;
  raw_text: string;
  warnings: string[];
}

export interface MultiExtractionResult {
  documents: ExtractionResult[];
  /** Fusion prioritaire de tous les documents scannés. */
  merged: ExtractedFields;
}

/**
 * Fusionne plusieurs extractions en une seule structure.
 *
 * Priorités :
 *  - Champs véhicule (VIN, immat, marque, modèle…) : carte grise > CPI > BC > BL > facture
 *  - Champs client (nom, mail, tel) : BC > BL > facture > CG (titulaire) > PV
 *  - Champs livraison (lieu, date) : PV > BL > BC
 *
 * Règle : la première valeur non vide selon la priorité gagne.
 */
export function mergeExtractions(docs: ExtractionResult[]): ExtractedFields {
  const VEHICLE_PRIORITY: DocumentType[] = [
    "carte_grise", "cpi", "bon_commande", "bon_livraison", "facture", "devis",
    "pv_livraison", "pv_restitution", "mandat", "document_constructeur", "inconnu",
  ];
  const CLIENT_PRIORITY: DocumentType[] = [
    "bon_commande", "bon_livraison", "facture", "devis",
    "carte_grise", "cpi", "pv_livraison", "pv_restitution", "mandat", "document_constructeur", "inconnu",
  ];
  const DELIVERY_PRIORITY: DocumentType[] = [
    "pv_livraison", "pv_restitution", "bon_livraison", "bon_commande", "facture",
    "devis", "mandat", "carte_grise", "cpi", "document_constructeur", "inconnu",
  ];

  const VEHICLE_KEYS = [
    "vin", "immatriculation", "marque", "modele", "version",
    "energie", "puissance", "couleur", "date_mec", "kilometrage",
  ] as const;
  const CLIENT_KEYS = [
    "client_nom", "client_email", "client_telephone",
    "titulaire_nom", "titulaire_adresse",
    "concession", "garage",
    "numero_commande", "numero_dossier", "numero_facture",
  ] as const;
  const DELIVERY_KEYS = [
    "lieu_depart", "lieu_arrivee", "date_livraison", "observations",
  ] as const;

  const merged: ExtractedFields = {};

  const pickBy = <K extends keyof ExtractedFields>(keys: readonly K[], order: DocumentType[]) => {
    for (const key of keys) {
      for (const type of order) {
        const doc = docs.find((d) => d.document_type === type);
        const val = doc?.fields[key];
        if (val && String(val).trim()) {
          merged[key] = val;
          break;
        }
      }
    }
  };

  pickBy(VEHICLE_KEYS, VEHICLE_PRIORITY);
  pickBy(CLIENT_KEYS, CLIENT_PRIORITY);
  pickBy(DELIVERY_KEYS, DELIVERY_PRIORITY);

  return merged;
}

/**
 * Contrôle de cohérence VIN (17 caractères alphanumériques, pas de I/O/Q).
 * Utilisé pour afficher un warning "VIN suspect" sans bloquer.
 */
export function isValidVinShape(vin?: string): boolean {
  if (!vin) return false;
  const clean = vin.trim().toUpperCase();
  if (clean.length !== 17) return false;
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(clean);
}

/** Immatriculation FR SIV : AA-123-AA. Ancien FNI : 1234 AB 12. */
export function isValidFrenchPlate(plate?: string): boolean {
  if (!plate) return false;
  const clean = plate.trim().toUpperCase().replace(/[\s]+/g, "");
  return /^[A-Z]{2}-?\d{3}-?[A-Z]{2}$/.test(clean) || /^\d{1,4}[A-Z]{1,3}\d{2,3}$/.test(clean);
}
