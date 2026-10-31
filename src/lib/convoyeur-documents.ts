export interface ConvoyeurDocSpec {
  key: string;
  label: string;
  required: boolean;
  independantOnly?: boolean;
  hint?: string;
  /** Document à renouveler : durée de validité en mois à compter du dépôt. */
  renewMonths?: number;
}

export const CONVOYEUR_DOC_TYPES: ConvoyeurDocSpec[] = [
  { key: "permis", label: "Permis de conduire (recto)", required: true, hint: "Le devant du permis, en entier et lisible." },
  { key: "permis_verso", label: "Permis de conduire (verso)", required: true, hint: "Le dos du permis, avec les catégories et dates." },
  { key: "identite", label: "Pièce d'identité (CNI recto)", required: true },
  { key: "identite_verso", label: "Pièce d'identité (CNI verso)", required: true },
  { key: "rib", label: "RIB", required: true },
  { key: "assurance", label: "Assurance RC Pro", required: true },
  { key: "kbis", label: "KBIS", required: true, independantOnly: true, hint: "Extrait Kbis de moins de 3 mois (ou avis de situation Sirene)." },
  { key: "vigilance", label: "Attestation de vigilance URSSAF", required: true, independantOnly: true, renewMonths: 6, hint: "À renouveler tous les 6 mois, gratuit sur urssaf.fr (espace Mon compte > Mes attestations)." },
  { key: "autre", label: "Autres documents", required: false, hint: "Ajoutez autant de documents que vous voulez." },
];

const DOC_ALIASES: Record<string, string> = {
  cni: "identite",
  cni_recto: "identite",
  cni_verso: "identite_verso",
  identite_recto: "identite",
  carte_identite: "identite",
  permis_recto: "permis",
  permis_dos: "permis_verso",
  permis_photo: "permis",
  rc_pro: "assurance",
  assurance_rc_pro: "assurance",
  contrat: "autre",
  vigilance: "vigilance",
  attestation_vigilance: "vigilance",
  attestation_urssaf: "vigilance",
  w_garage: "autre",
};

export function normalizeConvoyeurDocType(type: string | null | undefined): string {
  const clean = (type ?? "").trim().toLowerCase();
  return DOC_ALIASES[clean] ?? clean;
}

export function getConvoyeurDocLabel(type: string | null | undefined): string {
  const normalized = normalizeConvoyeurDocType(type);
  return CONVOYEUR_DOC_TYPES.find((doc) => doc.key === normalized)?.label ?? type ?? "Document";
}

/** Tous les convoyeurs sont indépendants : KBIS et attestation de vigilance sont requis pour tous. */
export function getVisibleConvoyeurDocTypes(_typeConvoyeur?: string | null): ConvoyeurDocSpec[] {
  return CONVOYEUR_DOC_TYPES;
}

export function getRequiredConvoyeurDocTypes(typeConvoyeur: string | null | undefined): ConvoyeurDocSpec[] {
  return getVisibleConvoyeurDocTypes(typeConvoyeur).filter((doc) => doc.required);
}

export function isConvoyeurDocApproved(status: string | null | undefined): boolean {
  return status === "approuve" || status === "valide";
}

export function getConvoyeurDocStatusLabel(status: string | null | undefined): string {
  if (isConvoyeurDocApproved(status)) return "Approuvé";
  if (status === "refuse") return "Refusé";
  if (status === "a_renvoyer") return "À renvoyer";
  return "En attente";
}
/** Échéance d'un document à renouveler (null si le type n'expire pas). */
export function getDocRenewal(spec: ConvoyeurDocSpec, createdAt: string | null | undefined, now = new Date()) {
  if (!spec.renewMonths || !createdAt) return null;
  const exp = new Date(createdAt);
  exp.setMonth(exp.getMonth() + spec.renewMonths);
  const daysLeft = Math.ceil((exp.getTime() - now.getTime()) / 86_400_000);
  return { expiresAt: exp, daysLeft, expired: daysLeft < 0, soon: daysLeft >= 0 && daysLeft <= 30 };
}
