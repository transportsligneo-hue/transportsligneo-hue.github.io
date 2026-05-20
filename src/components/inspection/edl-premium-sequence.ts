/**
 * Séquence stricte EDL Premium — révisée selon le cahier des charges conducteur.
 *
 * Ordre final 17 étapes photo + scans (départ).
 * Câble électrique: étape conditionnelle (visible seulement si véhicule électrique).
 *
 * Les `id` (vue_type) restent compatibles avec le backend existant (table inspection_photos).
 * Les anciens steps `cote_droit` / `cote_gauche` ne sont plus présentés au conducteur,
 * mais les photos déjà prises restent visibles côté admin.
 *
 * Les signatures d'arrivée ne font plus partie du flow EDL d'arrivée — elles sont
 * gérées séparément par ArriveeSignatureSheet, déclenchée par le cockpit APRÈS
 * que l'EDL d'arrivée est complet.
 */

import face_avant from "@/assets/edl/01-face-avant.jpg";
import tq_avant_droit from "@/assets/edl/02-3q-avant-droit.jpg";
import jante_av_droite from "@/assets/edl/04-jante-avant-droite.jpg";
import tq_arriere_droit from "@/assets/edl/05-3q-arriere-droit.jpg";
import jante_ar_droite from "@/assets/edl/06-jante-arriere-droite.jpg";
import face_arriere from "@/assets/edl/07-face-arriere.jpg";
import coffre_ouvert from "@/assets/edl/08-coffre-ouvert.jpg";
import tq_arriere_gauche from "@/assets/edl/09-3q-arriere-gauche.jpg";
import jante_ar_gauche from "@/assets/edl/10-jante-arriere-gauche.jpg";
import jante_av_gauche from "@/assets/edl/12-jante-avant-gauche.jpg";
import tq_avant_gauche from "@/assets/edl/13-3q-avant-gauche.jpg";
import interieur_avant from "@/assets/edl/14-interieur-avant.jpg";
import interieur_arriere from "@/assets/edl/15-interieur-arriere.jpg";
import compteur from "@/assets/edl/16-compteur.jpg";
import kit_securite from "@/assets/edl/17-kit-securite.jpg";
import pv_livraison from "@/assets/edl/18-pv-livraison.jpg";
import carte_grise from "@/assets/edl/19-carte-grise.jpg";

export type EdlStepKind =
  | "selfie"
  | "signature"
  | "photo"
  | "scan"
  | "extras"
  | "validation";

export interface EdlStepDef {
  num: number;
  id: string;
  kind: EdlStepKind;
  label: string;
  hint: string;
  example?: string;
  section: "demarrage" | "exterieur" | "interieur" | "documents" | "cloture";
  phase: "depart" | "arrivee";
  signatureKind?: "driver_start" | "client_start" | "driver_end" | "client_end";
  /** True si l'étape ne doit apparaître que pour les véhicules électriques. */
  electricOnly?: boolean;
}

/**
 * SÉQUENCE STRICTE — phase DÉPART.
 * Mêmes IDs en DB, ordre conforme au cahier des charges.
 * Les signatures arrivée sont gérées hors flow EDL (ArriveeSignatureSheet).
 */
export const EDL_PREMIUM_SEQUENCE: EdlStepDef[] = [
  // ─── Démarrage (selfie) ───
  { num: 1, id: "selfie_driver_start", kind: "selfie", section: "demarrage", phase: "depart",
    label: "Selfie convoyeur",
    hint: "Prenez un selfie pour confirmer votre identité au démarrage de la mission" },

  // ─── Extérieur — tour véhicule ───
  { num: 2, id: "face_avant", kind: "photo", section: "exterieur", phase: "depart",
    label: "Avant", hint: "Cadrez la face avant complète, calandre + phares visibles",
    example: face_avant },

  { num: 3, id: "trois_quart_avant_droite", kind: "photo", section: "exterieur", phase: "depart",
    label: "Trois quarts avant droit", hint: "Vue 3/4 avant du côté droit",
    example: tq_avant_droit },

  { num: 4, id: "jante_avant_droite", kind: "photo", section: "exterieur", phase: "depart",
    label: "Jante avant droite", hint: "Gros plan jante avant droite",
    example: jante_av_droite },

  { num: 5, id: "jante_arriere_droite", kind: "photo", section: "exterieur", phase: "depart",
    label: "Jante arrière droite", hint: "Gros plan jante arrière droite",
    example: jante_ar_droite },

  { num: 6, id: "trois_quart_arriere_droite", kind: "photo", section: "exterieur", phase: "depart",
    label: "Trois quarts arrière droit", hint: "Vue 3/4 arrière du côté droit",
    example: tq_arriere_droit },

  { num: 7, id: "face_arriere", kind: "photo", section: "exterieur", phase: "depart",
    label: "Arrière", hint: "Cadrez la face arrière complète",
    example: face_arriere },

  { num: 8, id: "coffre_ouvert", kind: "photo", section: "exterieur", phase: "depart",
    label: "Coffre ouvert", hint: "Coffre grand ouvert, intérieur visible",
    example: coffre_ouvert },

  // Conditionnel : véhicule électrique uniquement
  { num: 9, id: "cable_electrique", kind: "photo", section: "exterieur", phase: "depart",
    label: "Câble électrique", hint: "Photo du/des câble(s) de recharge fournis avec le véhicule",
    electricOnly: true },

  { num: 10, id: "trois_quart_arriere_gauche", kind: "photo", section: "exterieur", phase: "depart",
    label: "Trois quarts arrière gauche", hint: "Vue 3/4 arrière du côté gauche",
    example: tq_arriere_gauche },

  { num: 11, id: "jante_arriere_gauche", kind: "photo", section: "exterieur", phase: "depart",
    label: "Jante arrière gauche", hint: "Gros plan jante arrière gauche",
    example: jante_ar_gauche },

  { num: 12, id: "jante_avant_gauche", kind: "photo", section: "exterieur", phase: "depart",
    label: "Jante avant gauche", hint: "Gros plan jante avant gauche",
    example: jante_av_gauche },

  { num: 13, id: "trois_quart_avant_gauche", kind: "photo", section: "exterieur", phase: "depart",
    label: "Trois quarts avant gauche", hint: "Vue 3/4 avant du côté gauche",
    example: tq_avant_gauche },

  // ─── Intérieur ───
  { num: 14, id: "siege_avant", kind: "photo", section: "interieur", phase: "depart",
    label: "Siège avant", hint: "Tableau de bord + sièges avant",
    example: interieur_avant },

  { num: 15, id: "siege_arriere", kind: "photo", section: "interieur", phase: "depart",
    label: "Siège arrière", hint: "Banquette arrière",
    example: interieur_arriere },

  { num: 16, id: "compteur", kind: "photo", section: "interieur", phase: "depart",
    label: "Compteur", hint: "Kilométrage + niveau carburant lisibles",
    example: compteur },

  { num: 17, id: "kit_securite", kind: "photo", section: "interieur", phase: "depart",
    label: "Kit de sécurité", hint: "Gilet jaune + triangle de signalisation",
    example: kit_securite },

  // ─── Documents — scan auto OCR ───
  { num: 18, id: "pv_livraison", kind: "scan", section: "documents", phase: "depart",
    label: "PV livraison / restitution", hint: "Cadrez le document, contours détectés automatiquement",
    example: pv_livraison },

  { num: 19, id: "carte_grise", kind: "scan", section: "documents", phase: "depart",
    label: "Carte grise", hint: "Cadrez la carte grise, OCR automatique",
    example: carte_grise },

  { num: 20, id: "photos_libres_degats", kind: "extras", section: "documents", phase: "depart",
    label: "Photos libres / dégâts",
    hint: "Ajoutez si besoin des photos complémentaires : dégâts, remarques, accessoires ou détail utile. Étape optionnelle." },

  // ─── Signatures départ (toujours dans le flow EDL départ) ───
  { num: 21, id: "signature_driver_start", kind: "signature", section: "cloture", phase: "depart",
    signatureKind: "driver_start",
    label: "Signature départ — convoyeur",
    hint: "Signez pour attester de l'état du véhicule au départ" },

  { num: 22, id: "signature_client_start", kind: "signature", section: "cloture", phase: "depart",
    signatureKind: "client_start",
    label: "Signature départ — client / parc",
    hint: "Faites signer le donneur d'ordre (concession, parc, client)" },
];

/**
 * Étapes de signature ARRIVÉE — déclenchées séparément par ArriveeSignatureSheet,
 * APRÈS validation complète de l'EDL d'arrivée.
 */
export const ARRIVEE_SIGNATURE_STEPS: EdlStepDef[] = [
  { num: 1, id: "signature_driver_end", kind: "signature", section: "cloture", phase: "arrivee",
    signatureKind: "driver_end",
    label: "Signature arrivée — convoyeur",
    hint: "Signez pour attester de la livraison" },

  { num: 2, id: "signature_client_end", kind: "signature", section: "cloture", phase: "arrivee",
    signatureKind: "client_end",
    label: "Signature arrivée — client final",
    hint: "Faites signer le réceptionnaire" },
];

export const EDL_TOTAL_STEPS = EDL_PREMIUM_SEQUENCE.length;

export const EDL_SECTION_LABEL: Record<EdlStepDef["section"], string> = {
  demarrage: "Démarrage mission",
  exterieur: "Tour du véhicule",
  interieur: "Intérieur",
  documents: "Documents",
  cloture: "Clôture & validation",
};
