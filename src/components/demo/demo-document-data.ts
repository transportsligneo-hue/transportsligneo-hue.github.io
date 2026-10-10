import type { ProMission } from "@/hooks/useProMissions";

export const DEMO_BILLING = {
  nom: "Martin", prenom: "Claire", societe: "Flotte Exemple — Démonstration",
  email: "claire.martin@example.invalid", adresse: "Adresse fictive — Tours (37)",
};

export function demoAmounts(total: number, vatRate: number) {
  const ttc = Math.round(total * 100) / 100;
  const ht = Math.round(ttc / (1 + vatRate / 100) * 100) / 100;
  return { ttc, ht, tva: Math.round((ttc - ht) * 100) / 100 };
}

export function demoDocumentData(m: ProMission) {
  return {
    ...DEMO_BILLING,
    numero: `DEMO-DEV-${m.numero}`,
    depart: m.ville_depart ?? "", arrivee: m.ville_arrivee ?? "",
    marque: m.marque, modele: m.modele, immatriculation: m.immatriculation,
    prix_estime: m.prix_total ?? 0, created_at: m.created_at,
    date_souhaitee: m.date_prise_en_charge, heure_souhaitee: m.heure_prise_en_charge,
    prestation: "Livraison simple", type_vehicule: "Voiture",
    message: "Démonstration — données fictives, aucune valeur contractuelle.",
    mode_paiement: "Démonstration — aucun paiement à effectuer",
  };
}