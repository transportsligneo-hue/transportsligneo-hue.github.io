/**
 * Registre universel des signatures de documents.
 *
 * Chaque document officiel déclare ici ses emplacements de signature (« slots »).
 * Une signature enregistrée est stockée dans `mission_signatures` avec la clé
 * `kind = "<docType>:<slot>"`, ce qui garantit qu'une signature ne peut jamais
 * atterrir sur le mauvais document ni sur le mauvais emplacement.
 *
 * La taille d'impression (en mm) est fixe pour tous les documents : les
 * générateurs PDF placent l'image dans la zone prévue du gabarit.
 */

export type SignatureDocType =
  | "devis"
  | "pv_livraison"
  | "pv_restitution"
  | "mandat"
  | "edl_papier";

export interface SignatureSlot {
  /** Identifiant technique du slot (unique dans le document). */
  slot: string;
  /** Libellé lisible affiché à l'écran et sur le téléphone. */
  label: string;
  /** Petite précision affichée sous le libellé. */
  hint?: string;
}

export interface SignatureDocDef {
  docType: SignatureDocType;
  label: string;
  slots: SignatureSlot[];
}

/** Largeur / hauteur d'impression d'une signature dans les PDF (mm). */
export const SIGNATURE_PRINT_W = 46;
export const SIGNATURE_PRINT_H = 15;

export const SIGNATURE_DOCS: Record<SignatureDocType, SignatureDocDef> = {
  devis: {
    docType: "devis",
    label: "Devis",
    slots: [{ slot: "client", label: "Client", hint: "Bon pour accord" }],
  },
  pv_livraison: {
    docType: "pv_livraison",
    label: "PV de livraison",
    slots: [
      { slot: "convoyeur", label: "Convoyeur", hint: "Certifie la livraison" },
      { slot: "destinataire", label: "Destinataire", hint: "Certifie la réception" },
    ],
  },
  pv_restitution: {
    docType: "pv_restitution",
    label: "PV de restitution",
    slots: [
      { slot: "convoyeur", label: "Convoyeur", hint: "Certifie la restitution" },
      { slot: "proprietaire", label: "Propriétaire / donneur d'ordre", hint: "Certifie la reprise" },
    ],
  },
  mandat: {
    docType: "mandat",
    label: "Mandat de récupération",
    slots: [
      { slot: "mandant", label: "Mandant (propriétaire)", hint: "Autorise la récupération" },
      { slot: "mandataire", label: "Transports Ligneo", hint: "Accepte le mandat" },
    ],
  },
  edl_papier: {
    docType: "edl_papier",
    label: "État des lieux papier",
    slots: [
      { slot: "convoyeur", label: "Convoyeur" },
      { slot: "client", label: "Client" },
    ],
  },
};

/** Clé stockée en base pour un couple document / emplacement. */
export const signatureKind = (docType: SignatureDocType, slot: string) => `${docType}:${slot}`;

export function slotLabel(docType: SignatureDocType, slot: string): string {
  return SIGNATURE_DOCS[docType]?.slots.find((s) => s.slot === slot)?.label ?? slot;
}
