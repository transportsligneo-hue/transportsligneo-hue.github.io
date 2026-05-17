/**
 * Séquence stricte EDL Premium — Lot 1
 *
 * Spec utilisateur (immuable) : 26 étapes ordonnées exactes du parcours convoyeur.
 *
 * Les `id` (vue_type) restent compatibles avec le backend existant
 * (table `inspection_photos`). Les nouveaux IDs (selfie_*, signature_*)
 * sont gérés via mission_selfies / mission_signatures.
 *
 * NE PAS RÉORDONNER. NE PAS RENOMMER LES IDS.
 */

import face_avant from "@/assets/edl/01-face-avant.jpg";
import tq_avant_droit from "@/assets/edl/02-3q-avant-droit.jpg";
import cote_droit from "@/assets/edl/03-cote-droit.jpg";
import jante_av_droite from "@/assets/edl/04-jante-avant-droite.jpg";
import tq_arriere_droit from "@/assets/edl/05-3q-arriere-droit.jpg";
import jante_ar_droite from "@/assets/edl/06-jante-arriere-droite.jpg";
import face_arriere from "@/assets/edl/07-face-arriere.jpg";
import coffre_ouvert from "@/assets/edl/08-coffre-ouvert.jpg";
import tq_arriere_gauche from "@/assets/edl/09-3q-arriere-gauche.jpg";
import jante_ar_gauche from "@/assets/edl/10-jante-arriere-gauche.jpg";
import cote_gauche from "@/assets/edl/11-cote-gauche.jpg";
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
  /** Numéro d'ordre 1..26 (affichage) */
  num: number;
  /** ID stable BDD (vue_type / kind selfie / kind signature) */
  id: string;
  /** Type fonctionnel */
  kind: EdlStepKind;
  /** Libellé court */
  label: string;
  /** Consigne */
  hint: string;
  /** Photo exemple visible avant prise (vide pour selfie/signature/validation) */
  example?: string;
  /** Section logique pour timeline */
  section: "demarrage" | "exterieur" | "interieur" | "documents" | "cloture";
  /** Phase backend (depart vs arrivee) — pour insertion BDD */
  phase: "depart" | "arrivee";
  /** Pour signatures : rôle */
  signatureKind?: "driver_start" | "client_start" | "driver_end" | "client_end";
}

/**
 * SÉQUENCE STRICTE — 26 étapes (départ + arrivée fusionnés en un seul flow continu)
 * Si tu veux séparer départ et arrivée en deux sessions distinctes, filtre par .phase.
 */
export const EDL_PREMIUM_SEQUENCE: EdlStepDef[] = [
  // ═══════ DÉMARRAGE MISSION (selfie uniquement) ═══════
  { num: 1, id: "selfie_driver_start", kind: "selfie", section: "demarrage", phase: "depart",
    label: "Selfie convoyeur",
    hint: "Prenez un selfie pour confirmer votre identité au démarrage de la mission" },

  // ═══════ EXTÉRIEUR — TOUR DU VÉHICULE (sens horaire depuis face avant) ═══════
  { num: 2, id: "face_avant", kind: "photo", section: "exterieur", phase: "depart",
    label: "Face avant", hint: "Cadrez la face avant complète, calandre + phares visibles",
    example: face_avant },

  { num: 3, id: "trois_quart_avant_droite", kind: "photo", section: "exterieur", phase: "depart",
    label: "Trois quarts avant droit", hint: "Vue 3/4 avant du côté droit",
    example: tq_avant_droit },

  { num: 4, id: "cote_droit", kind: "photo", section: "exterieur", phase: "depart",
    label: "Côté droit", hint: "Profil complet du côté droit",
    example: cote_droit },

  { num: 5, id: "jante_avant_droite", kind: "photo", section: "exterieur", phase: "depart",
    label: "Jante avant droite", hint: "Gros plan jante avant droite",
    example: jante_av_droite },

  { num: 6, id: "trois_quart_arriere_droite", kind: "photo", section: "exterieur", phase: "depart",
    label: "Trois quarts arrière droit", hint: "Vue 3/4 arrière du côté droit",
    example: tq_arriere_droit },

  { num: 7, id: "jante_arriere_droite", kind: "photo", section: "exterieur", phase: "depart",
    label: "Jante arrière droite", hint: "Gros plan jante arrière droite",
    example: jante_ar_droite },

  { num: 8, id: "face_arriere", kind: "photo", section: "exterieur", phase: "depart",
    label: "Face arrière", hint: "Cadrez la face arrière complète",
    example: face_arriere },

  { num: 9, id: "coffre_ouvert", kind: "photo", section: "exterieur", phase: "depart",
    label: "Coffre OUVERT", hint: "Coffre grand ouvert, intérieur visible",
    example: coffre_ouvert },

  { num: 10, id: "trois_quart_arriere_gauche", kind: "photo", section: "exterieur", phase: "depart",
    label: "Trois quarts arrière gauche", hint: "Vue 3/4 arrière du côté gauche",
    example: tq_arriere_gauche },

  { num: 11, id: "jante_arriere_gauche", kind: "photo", section: "exterieur", phase: "depart",
    label: "Jante arrière gauche", hint: "Gros plan jante arrière gauche",
    example: jante_ar_gauche },

  { num: 12, id: "cote_gauche", kind: "photo", section: "exterieur", phase: "depart",
    label: "Côté gauche", hint: "Profil complet du côté gauche",
    example: cote_gauche },

  { num: 13, id: "jante_avant_gauche", kind: "photo", section: "exterieur", phase: "depart",
    label: "Jante avant gauche", hint: "Gros plan jante avant gauche",
    example: jante_av_gauche },

  { num: 14, id: "trois_quart_avant_gauche", kind: "photo", section: "exterieur", phase: "depart",
    label: "Trois quarts avant gauche", hint: "Vue 3/4 avant du côté gauche",
    example: tq_avant_gauche },

  // ═══════ INTÉRIEUR ═══════
  { num: 15, id: "siege_avant", kind: "photo", section: "interieur", phase: "depart",
    label: "Intérieur avant", hint: "Tableau de bord + sièges avant",
    example: interieur_avant },

  { num: 16, id: "siege_arriere", kind: "photo", section: "interieur", phase: "depart",
    label: "Intérieur arrière", hint: "Banquette arrière + plafonnier",
    example: interieur_arriere },

  { num: 17, id: "compteur", kind: "photo", section: "interieur", phase: "depart",
    label: "Compteur", hint: "Kilométrage + niveau carburant lisibles",
    example: compteur },

  { num: 18, id: "kit_securite", kind: "photo", section: "interieur", phase: "depart",
    label: "Kit sécurité", hint: "Gilet jaune + triangle de signalisation",
    example: kit_securite },

  // ═══════ DOCUMENTS — SCAN AUTO OCR ═══════
  { num: 19, id: "pv_livraison", kind: "scan", section: "documents", phase: "depart",
    label: "PV livraison / restitution", hint: "Cadrez le document, contours détectés automatiquement",
    example: pv_livraison },

  { num: 20, id: "carte_grise", kind: "scan", section: "documents", phase: "depart",
    label: "Carte grise / documents", hint: "Cadrez la carte grise, OCR automatique",
    example: carte_grise },

  { num: 21, id: "photos_libres_degats", kind: "extras", section: "documents", phase: "depart",
    label: "Photos libres / dégâts",
    hint: "Ajoutez si besoin des photos complémentaires : dégâts, remarques, accessoires ou détail utile. Étape optionnelle." },

  // ═══════ SIGNATURES DÉPART — APRÈS l'état des lieux départ ═══════
  { num: 22, id: "signature_driver_start", kind: "signature", section: "cloture", phase: "depart",
    signatureKind: "driver_start",
    label: "Signature départ — convoyeur",
    hint: "Signez pour attester de l'état du véhicule au départ" },

  { num: 23, id: "signature_client_start", kind: "signature", section: "cloture", phase: "depart",
    signatureKind: "client_start",
    label: "Signature départ — client / parc",
    hint: "Faites signer le donneur d'ordre (concession, parc, client)" },

  // ═══════ SIGNATURES ARRIVÉE ═══════
  { num: 24, id: "signature_driver_end", kind: "signature", section: "cloture", phase: "arrivee",
    signatureKind: "driver_end",
    label: "Signature arrivée — convoyeur",
    hint: "Signez pour attester de la livraison" },

  { num: 25, id: "signature_client_end", kind: "signature", section: "cloture", phase: "arrivee",
    signatureKind: "client_end",
    label: "Signature arrivée — client final",
    hint: "Faites signer le réceptionnaire" },

  { num: 26, id: "send_admin", kind: "validation", section: "cloture", phase: "arrivee",
    label: "Envoi à l'admin", hint: "Transmission automatique pour validation finale" },

  { num: 27, id: "admin_validated", kind: "validation", section: "cloture", phase: "arrivee",
    label: "Validation admin", hint: "Mission terminée, notifications envoyées" },
];

export const EDL_TOTAL_STEPS = EDL_PREMIUM_SEQUENCE.length;

export const EDL_SECTION_LABEL: Record<EdlStepDef["section"], string> = {
  demarrage: "Démarrage mission",
  exterieur: "Tour du véhicule",
  interieur: "Intérieur",
  documents: "Documents",
  cloture: "Clôture & validation",
};
