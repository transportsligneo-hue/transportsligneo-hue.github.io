import { writeFileSync } from "fs";
import { generatePvMissionPdf, pvNumero } from "@/lib/pv-mission-pdf";
const company = { raison_sociale: "Transports Ligneo", siret: "75332000100012", adresse_ville: "Tours", adresse_cp: "37000", site_web: "www.transportsligneo.fr", email_contact: "contact@transportsligneo.fr" } as never;
const base = {
  numero_mission: "MIS-TLG-2026-#014", numero_pv: "",
  donneur_ordre: "Garage Dupont SARL", destinataire: "M. Martin",
  marque_modele: "Peugeot 3008", immatriculation: "AB-123-CD", vin: "VF3ABCDEFGH123456",
  kilometrage_depart: "84 120", kilometrage_arrivee: null, carburant: "Diesel 1/2",
  lieu_prise_en_charge: "12 rue des Lilas, 37000 Tours", lieu_livraison: "5 av. Foch, 75008 Paris",
  date_prise_en_charge: "12/09/2026 09:00", date_livraison: null,
  dommages: [{ code: "R", zone: "Côté gauche" }],
};
for (const v of ["livraison", "restitution"] as const)
  for (const plateau of [false, true]) {
    const b = await generatePvMissionPdf(v, { ...base, plateau, plateau_numero: plateau ? "Plateau 37-AZ-902" : null, numero_pv: pvNumero(v, base.numero_mission) }, company);
    writeFileSync(`/tmp/qa/${v}${plateau ? "-plateau" : ""}.pdf`, Buffer.from(await b.arrayBuffer()));
  }
console.log("ok");
