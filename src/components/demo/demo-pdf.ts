import type { ProMission } from "@/hooks/useProMissions";
import { demoAmounts, demoDocumentData, DEMO_BILLING } from "./demo-document-data";

/** Official templates, fictional inputs only; never resolve real client records. */
export async function downloadDemoPdf(kind: string, m: ProMission) {
  const [{ fetchCompanyInfo }, { fetchActiveRegime }] = await Promise.all([
    import("@/lib/doc-branding"), import("@/lib/pricing/fetch"),
  ]);
  const [company, regime] = await Promise.all([fetchCompanyInfo(), fetchActiveRegime()]);
  if (!company) throw new Error("Les informations publiques Ligneo sont momentanément indisponibles.");
  const amounts = demoAmounts(m.prix_total ?? 0, regime.vatRate);
  const data = demoDocumentData(m);
  const context = { demo: true };
  let blob: Blob;
  switch (kind) {
    case "Devis": {
      const { generateDevisPdf } = await import("@/lib/devis-pdf");
      blob = await generateDevisPdf(data, company, context);
      break;
    }
    case "Bon de commande": {
      const { generateLotRecapPdf } = await import("@/lib/documents-officiels");
      blob = await generateLotRecapPdf({
        devisNumero: data.numero, lotNumero: 1, lotNom: "Commande de démonstration",
        client: DEMO_BILLING.societe, signedAt: m.created_at, signerName: "Claire Martin (fictif)",
        totalTtc: amounts.ttc, totalHt: amounts.ht,
        lignes: [{ reference: m.numero, type: "Livraison simple", plaque: m.immatriculation ?? "",
          vehicule: `${m.marque ?? ""} ${m.modele ?? ""}`, trajet: `${data.depart} → ${data.arrivee}`,
          date: `${m.date_prise_en_charge} ${m.heure_prise_en_charge ?? ""}`, prix: amounts.ttc }],
      }, company, context);
      break;
    }
    case "PV de livraison": {
      const { generatePvMissionPdf, pvNumero } = await import("@/lib/pv-mission-pdf");
      blob = await generatePvMissionPdf("livraison", {
        numero_mission: m.numero, numero_pv: `DEMO-${pvNumero("livraison", m.numero)}`,
        donneur_ordre: DEMO_BILLING.societe, destinataire: "Claire Martin (fictif)",
        marque_modele: `${m.marque ?? ""} ${m.modele ?? ""}`, immatriculation: m.immatriculation,
        lieu_prise_en_charge: data.depart, lieu_livraison: data.arrivee,
        date_prise_en_charge: m.date_prise_en_charge, date_livraison: m.updated_at.slice(0, 10),
        dommages: [{ code: "R", zone: "Côté droit", note: "Exemple : rayure de 4 cm, porte arrière droite." }],
      }, company, context);
      break;
    }
    case "Facture": {
      const { generateFacturePdf } = await import("@/lib/facture-pdf");
      blob = await generateFacturePdf({
        numero: `DEMO-FAC-${m.numero}`, type_facture: "b2b", statut: "payee",
        date_facture: m.updated_at.slice(0, 10), date_mission: m.date_prise_en_charge,
        client_nom: data.nom, client_prenom: data.prenom, client_societe: data.societe,
        client_email: data.email, client_adresse: data.adresse,
        designation: "Convoyage — Livraison simple (démonstration)", depart: data.depart, arrivee: data.arrivee,
        vehicule_marque: m.marque, vehicule_modele: m.modele, vehicule_immatriculation: m.immatriculation,
        prix_ht: amounts.ht, prix_tva: amounts.tva, prix_ttc: amounts.ttc, tva_taux: regime.vatRate,
        tva_exempt: regime.regime !== "societe", tva_exemption_note: regime.exemptionNote,
        legal_mention: data.message, mode_paiement: data.mode_paiement,
        devis_message: data.message, reference_client: data.numero,
        iban: "Démonstration — non utilisable", bic: "Non utilisable",
      }, company, context);
      break;
    }
    default: throw new Error("Document non disponible.");
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `demo-${kind.toLowerCase().replace(/\s+/g, "-")}-${m.numero}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
