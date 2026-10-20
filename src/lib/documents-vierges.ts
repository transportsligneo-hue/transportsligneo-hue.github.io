import {
  generateFicheMissionPdf,
  generatePassageAVidePdf,
  generateEdlPapierPdf,
  generateContratConvoyeurPdf,
  generateCharteDiscretionPdf,
} from "@/lib/documents-officiels";
import { generatePvMissionPdf } from "@/lib/pv-mission-pdf";
import { generateMandatRecuperationPdf } from "@/lib/mandat-recuperation-pdf";
import type { CompanyInfo } from "@/lib/doc-branding";

export interface DocumentVierge {
  key: string;
  label: string;
  description: string;
  filename: string;
  build: (company: CompanyInfo | null) => Promise<Blob>;
}

/** Tous les documents du site, générés sans aucune donnée (à remplir à la main). */
export const DOCUMENTS_VIERGES: DocumentVierge[] = [
  {
    key: "pv_livraison",
    label: "PV de livraison",
    description: "Procès-verbal remis au destinataire à la livraison",
    filename: "PV-livraison-vierge.pdf",
    build: (c) => generatePvMissionPdf("livraison", { numero_mission: "…………", numero_pv: "…………" }, c),
  },
  {
    key: "pv_restitution",
    label: "PV de restitution",
    description: "Procès-verbal de restitution / prise en charge",
    filename: "PV-restitution-vierge.pdf",
    build: (c) => generatePvMissionPdf("restitution", { numero_mission: "…………", numero_pv: "…………" }, c),
  },
  {
    key: "edl_livraison",
    label: "État des lieux — Livraison",
    description: "État des lieux papier à la livraison",
    filename: "EDL-livraison-vierge.pdf",
    build: (c) => generateEdlPapierPdf({ numero: "", variant: "livraison" }, c),
  },
  {
    key: "edl_restitution",
    label: "État des lieux — Restitution",
    description: "État des lieux papier à la prise en charge",
    filename: "EDL-restitution-vierge.pdf",
    build: (c) => generateEdlPapierPdf({ numero: "", variant: "restitution" }, c),
  },
  {
    key: "fiche_mission",
    label: "Fiche de mission",
    description: "Fiche d'une page remise au convoyeur",
    filename: "Fiche-mission-vierge.pdf",
    build: (c) => generateFicheMissionPdf({ numero: "" }, c),
  },
  {
    key: "mandat",
    label: "Mandat de récupération",
    description: "Mandat signé par le propriétaire du véhicule",
    filename: "Mandat-recuperation-vierge.pdf",
    build: (c) => generateMandatRecuperationPdf({ numero_mission: "…………", numero_mandat: "…………" }, c),
  },
  {
    key: "passage_a_vide",
    label: "Passage à vide",
    description: "Justificatif de déplacement à vide",
    filename: "Passage-a-vide-vierge.pdf",
    build: (c) => generatePassageAVidePdf({ numero: "" }, c),
  },
  {
    key: "contrat",
    label: "Contrat de partenariat convoyeur",
    description: "Contrat convoyeur indépendant",
    filename: "Contrat-convoyeur-vierge.pdf",
    build: (c) => generateContratConvoyeurPdf({ nom_complet: "………………………………" }, c),
  },
  {
    key: "charte",
    label: "Charte de présentation et de discrétion",
    description: "Charte à faire signer aux convoyeurs",
    filename: "Charte-discretion-vierge.pdf",
    build: (c) => generateCharteDiscretionPdf({ nom_complet: "………………………………" }, c),
  },
];
