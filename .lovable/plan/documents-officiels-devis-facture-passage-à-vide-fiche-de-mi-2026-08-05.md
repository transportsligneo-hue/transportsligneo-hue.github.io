# Documents officiels — devis, facture, passage à vide, fiche de mission, EDL, contrat

Objectif : brancher les 6 modèles fournis sur de vraies données, avec une source unique pour les mentions légales, et un workflow de signature sécurisé pour le contrat convoyeur.

## 1. Informations légales de l'entreprise (préalable bloquant)

- Nouvelle table `company_settings` (ligne unique) : raison sociale, forme juridique, capital, RCS, SIRET, TVA intra, adresse siège, email, téléphone, site, IBAN, BIC, nom + fonction du signataire. Lecture publique limitée aux champs non bancaires, écriture admin uniquement.
- Nouvelle page Admin `Réglages > Informations légales` (formulaire + indicateur "complet / incomplet").
- Un module partagé `src/lib/doc-branding.ts` fournit : en-tête navy + liseré or, logo, pied de page mentions légales, palette et typographies — utilisé par TOUS les générateurs PDF.
- Tant que les champs obligatoires manquent : les boutons de génération devis/facture sont désactivés avec un message explicite dans l'admin.

## 2. Devis et facture

- Refonte de `devis-pdf.ts` et `facture-pdf.ts` sur la maquette exacte des modèles 01 et 02 (bloc "Établi pour" / "Référence mission", tableau détail, totaux HT / TVA / TTC, conditions, cartouche signature).
- Bouton "Générer la facture" sur un devis au statut accepté : crée la facture liée (référence croisée devis ↔ facture), sans ressaisie.
- Côté clients (Particulier, B2B, Flotte) : la facture liée devient consultable et téléchargeable depuis le devis accepté, même rendu visuel.
- Les estimateurs (site public et espaces connectés) exportent leur estimation avec la même charte via `doc-branding`.

## 3. Fiche de mission (modèle 04)

- Générateur `mission-fiche-pdf.ts` conforme au modèle, pré-rempli (véhicule, enlèvement, livraison, convoyeur, contacts).
- Génération automatique à l'assignation d'un convoyeur, enregistrée dans `mission_documents` ; téléchargement à tout moment côté admin et côté app convoyeur.

## 4. EDL papier (modèle 05)

- Bouton de téléchargement sur chaque mission (admin + app convoyeur), champs pré-remplis depuis la mission.
- Nouveau schéma véhicule : illustration vue de dessus dessinée en vectoriel dans le PDF (carrosserie réaliste, vitrage, roues), avec les 4 zones avant / arrière / gauche / droite repérables pour annoter les dommages.

## 5. Passage à vide (modèle 03)

- Action rapide "Générer un passage à vide" sur la fiche mission admin, mise en avant quand un incident "véhicule non disponible / non roulant" est signalé.
- Formulaire pré-rempli (convoyeur, dates, lieux) + champs à compléter (véhicule du trajet à vide, motif).
- PDF numéroté `PAV-…`, attaché à la mission et consultable dans son historique.

## 6. Contrat de partenariat convoyeur (modèle 06)

- Table `convoyeur_contrats` : token à usage unique + expiration, statut, données de signature (nom saisi, case lu et approuvé, horodatage, IP, user agent).
- Admin : action "Envoyer le contrat pour signature" sur un candidat → email contenant le lien sécurisé (aucun PDF en pièce jointe).
- Page publique `/contrat/$token` : contrat pré-rempli affiché à l'écran (nom, SIRET, adresse, permis), signature électronique simple en fin de lecture. Aucun PDF accessible avant signature.
- Après signature : PDF signé téléchargeable depuis l'espace convoyeur, copie envoyée à l'admin, statut "Contrat signé le …" sur la fiche convoyeur.

## Détails techniques

- Génération PDF : jsPDF côté client comme aujourd'hui, en factorisant l'habillage dans `doc-branding.ts` pour garantir un rendu identique entre tous les documents.
- Stockage : bucket privé existant pour les documents de mission, lignes dans `mission_documents` (type `fiche_mission`, `passage_a_vide`, `edl_papier`).
- Sécurité : RLS admin sur `company_settings` et `convoyeur_contrats` ; validation du token contrat côté serveur (server function), jamais côté client.
- Aucune mention légale codée en dur : toutes proviennent de `company_settings`.

## Livraison par étapes

Étape A : réglages légaux + charte PDF partagée. Étape B : devis/facture + estimateurs. Étape C : fiche de mission auto. Étape D : EDL papier + schéma véhicule. Étape E : passage à vide. Étape F : signature contrat.
