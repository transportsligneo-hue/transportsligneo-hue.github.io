# Stabilisation Transports Ligneo — Plan d'exécution

> Règle absolue : **on corrige les fonctionnels avant tout redesign**.
> Les refontes visuelles (devis/factures/mission PDF, emails) viennent
> APRÈS que les bugs critiques aient été reproduits, corrigés et vérifiés.

## Lot A — Bugs critiques fonctionnels (PRIORITAIRE)

### A1. Inspection mobile convoyeur (driver)
- Footer/CTA sticky toujours visible (bouton "Suivant" jamais coupé).
- Capture selfie convoyeur : prise → preview → enregistrement Storage
  (`mission-selfies`) → ligne `mission_selfies` → visible côté convoyeur
  ET admin (`/admin/missions/$missionId`).
- Photos état des lieux : flux Photo → Preview → Confirmer → Étape
  suivante, sans perte, et upload réel dans `inspection-photos` +
  insertion `inspection_photos`.
- Vérification : poser 1 selfie + 1 photo par zone sur une mission test
  et confirmer la présence dans la fiche admin.

### A2. Demande de devis end-to-end
- Vérifier que le formulaire écrit bien dans `demandes_convoyage` ET
  crée la ligne `devis` correspondante (selon le parcours actuel).
- Le devis remonte : espace client (`/dashboard-client`), admin
  (`/admin/devis`, `/admin/demandes`), email transactionnel envoyé,
  PDF généré et téléchargeable, numéro `DEV-TLG-2026-XXX` cohérent.
- Corriger les éventuels statuts bloqués (`envoye` jamais mis à jour).

### A3. Inscription — types de compte
- Particulier / Professionnel-Partenaire / B2B-Flotte.
- Sélecteur clair à l'inscription, écriture du `type_client` correct
  dans `profiles` + rôle adéquat dans `user_roles`.
- Redirection vers le bon dashboard après login :
  - particulier → `/dashboard-client`
  - pro/partenaire → `/dashboard-pro`
  - b2b/flotte → `/dashboard-pro` (vue flotte) ou route dédiée.

### A4. Sécurité / sessions
- Audit rapide : "vérification sécurité échouée", déconnexions
  intempestives, redirection après refresh.
- Hardening du `_authenticated` gate + `beforeLoad`.

## Lot B — Numérotation officielle centralisée

- Étendre `mission_sequences` à 3 préfixes : `DEV-TLG`, `FAC-TLG`,
  `MIS-TLG` (déjà partiellement en place via `next_mission_number`).
- Format strict : `XXX-TLG-YYYY-NNN` (NNN = padding 3 chiffres).
- Triggers ou RPC `next_document_number(prefix)` appelée à la création
  d'un devis, d'une facture, d'une mission/attribution.
- Backfill conservatif : on **ne réécrit pas** les numéros déjà émis,
  on aligne uniquement les nouveaux.
- Vérification : impossible de créer deux devis avec le même numéro.

## Lot C — Documents PDF premium (refonte exacte des captures)

Réutilisation du moteur PDF existant (`@/lib/devis-pdf`), refonte
template-par-template avec **identité midnight blue + or + Playfair**
et structure conforme aux captures fournies :

- **C1. Devis PDF** (`DEV-TLG-…`) — header logo + coords + bloc
  référence/dates/validité/mode paiement, tableau prestation, détails
  inclus, bloc HT/TVA/TTC, cachet, signature, mentions légales.
- **C2. Facture particulier** (`FAC-TLG-…`) — bandeau "FACTURE
  ACQUITTÉE" si payée, sinon statut + date d'échéance.
- **C3. Facture B2B / Flottes / Partenaires** — bloc IBAN/BIC,
  échéance 30j fin de mois, conditions de paiement L441-10.
- **C4. Fiche de mission convoyeur** (`MIS-TLG-…`) — infos mission,
  rappel important, lieux départ/arrivée, instructions, documents,
  urgences, blocs signatures départ/arrivée.

Chaque PDF est téléchargeable depuis : estimateur, espace client,
espace pro, admin, dashboard convoyeur, emails.

## Lot D — Emails corporate

Refonte des templates React Email (`src/lib/email-templates/`) avec
header bleu nuit + or, logo, CTA premium, références (`DEV-TLG`,
`FAC-TLG`, `MIS-TLG`), lisibilité mobile :

- Confirmation devis
- Facture émise
- Mission attribuée / acceptée / terminée
- Inscription / validation compte convoyeur
- Notifications client (état de la mission)

## Lot E — Dashboards dédiés par type de compte

- Particulier : suivi missions, devis, factures, documents.
- Pro / Partenaire : devis, missions, facturation, équipe.
- B2B / Flotte : demandes ponctuelles + leads flotte, factures B2B.
- Admin : déjà fait (lots 1-4 précédents).

## Ordre d'exécution proposé

1. **A1** (driver mobile / inspection / selfie / photos)
2. **A2** (devis end-to-end)
3. **A3** (types de compte)
4. **A4** (sécurité / sessions)
5. **B**  (numérotation centralisée)
6. **C1 → C4** (PDF premium)
7. **D**  (emails)
8. **E**  (dashboards par type)

## Note importante

Je ne peux pas faire le tout en une réponse sans risquer de casser le
site. Chaque lot est livré → testé → validé avant le suivant. Le
redesign des tables admin (Lot 4 précédent) est mis en pause sur les
écrans restants (devis, missions, paiements, etc.) tant que A et B ne
sont pas verts.
