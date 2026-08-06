import { generateEdlPapierPdf } from "@/lib/documents-officiels";
const company = { raison_sociale:"TRANSPORTS LIGNEO", forme_juridique:"SASU", capital_social:"10 000 €", rcs:"Tours 900 000 000", siret:"900 000 000 00012", tva_intra:"FR00900000000", adresse_ligne1:"12 rue de la Convoyage", adresse_cp:"37000", adresse_ville:"Tours", adresse_pays:"France", email_contact:"contact@transportsligneo.fr", telephone:"07 82 45 61 81", site_web:"www.transportsligneo.fr", signataire_nom:null, signataire_fonction:null, assurance_mention:null } as never;
for (const v of ["livraison","restitution"] as const) {
  const blob = await generateEdlPapierPdf({ numero:"MIS-TLG-2026-#148", variant:v, client:"Jean Dupont", marque_modele:"Peugeot 508", immatriculation:"AB-123-CD", vin:"VF3XXXXXXXXXXXXXX", kilometrage_depart:"34218", carburant:"Diesel", depart:"Tours (37)", arrivee:"Lyon (69)", date_prevue:"2026-08-12", convoyeur_nom:"Marc Leroy" }, company);
  await Bun.write(`/tmp/edl-${v}.pdf`, await blob.arrayBuffer());
}
console.log("ok");
