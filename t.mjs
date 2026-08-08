globalThis.window = globalThis.window || {};
const { generatePassageAVidePdf, generateFicheMissionPdf, generateEdlPapierPdf } = await import('./src/lib/documents-officiels.ts');
const company = { raison_sociale:"Transports Ligneo", forme_juridique:"SASU", capital_social:"1 000 €", rcs:"Tours 987 654 321", siret:"98765432100019", tva_intra:"FR12987654321", adresse_ligne1:"12 rue de la Paix", adresse_cp:"37000", adresse_ville:"Tours", adresse_pays:"France", email_contact:"contact@transportsligneo.fr", telephone:"07 82 45 61 81", site_web:"transportsligneo.fr", signataire_nom:"M. Ligneo", signataire_fonction:"Président", assurance_mention:null };
const fs = await import('fs');
const b = await generatePassageAVidePdf({ numero:"PV-2026-001", date: new Date().toISOString(), convoyeur_nom:"Jean Dupont", motif:"Annulation client", depart:"Tours", arrivee:"Paris", distance_km:240, montant_ht:120, montant_ttc:144 }, company);
fs.writeFileSync('/tmp/pv.pdf', Buffer.from(await b.arrayBuffer()));
console.log('ok');
