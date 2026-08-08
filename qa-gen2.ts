import { generateFacturePdf } from "@/lib/facture-pdf";
const blob = await generateFacturePdf({
  numero: "FAC-TLG-2026-114", type_facture: "particulier", statut: "payee",
  date_facture: "2026-07-22", date_mission: "2026-07-20", date_paiement: "2026-07-22", mode_paiement: "Carte bancaire",
  client_nom: "Durand", client_prenom: "Morgane",
  client_adresse: "12 avenue de la Logistique, ZAC des Portes, 37000 Tours",
  client_siret: "812 345 678 00021", client_tva: "FR32812345678", client_email: "morgane.durand@catfrance.fr",
  depart: "La Riche, 37520", arrivee: "Paris La Défense, 92800", distance_km: 245,
  vehicule_marque: "Peugeot", vehicule_modele: "3008 GT", vehicule_immatriculation: "GB-745-QR",
  prix_ht: 100, tva_taux: 20, prix_tva: 20, prix_ttc: 120,
  iban: "FR76 1562 9020 0100 0200 1234 567", bic: "CMCIFR2A",
} as any, null);
await Bun.write("/tmp/qa/facture-b2c.pdf", await blob.arrayBuffer());
console.log("ok");
