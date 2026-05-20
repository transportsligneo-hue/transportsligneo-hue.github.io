## Objectif

Améliorer l'espace client (devis, factures, missions, suivi) et le PDF, sans casser l'estimateur, les dashboards, les devis/factures existants, ni les missions. Design conservé.

---

## 1. Estimateur unifié dans le dashboard client

Le bouton "Devis instantané" du dashboard client (`dashboard-client.nouvelle-reservation.tsx`) utilise déjà `TunnelReservation`, mais l'expérience diverge de l'estimateur principal (`DevisGenerator`) et redemande des infos déjà connues.

- Remplacer `TunnelReservation` par `DevisGenerator` dans `dashboard-client/nouvelle-reservation` ET `dashboard-pro/nouvelle-demande` (mode "Devis instantané"), pour garantir : même UI, mêmes options (Livraison simple / Livraison + restitution / Express), Google Places, plaques, mêmes tarifs et règles.
- Ajouter à `DevisGenerator` une prop `prefill?: { nom; prenom; email; telephone; societe? }` + `hideAccountStep?: boolean`.
- Côté route dashboard : charger `profiles` + `organizations` du user connecté et passer les valeurs en `prefill`. Sauter l'étape "création de compte" et la double saisie email/tel.
- Conserver tout le moteur de prix existant. Aucun changement à `reservation-pricing.ts` ni `pricing-engine.ts`.

## 2. Dashboard client — sections et lisibilité

`dashboard-client.devis.tsx` mélange devis et factures. Cette page liste actuellement les `devis` uniquement, mais le libellé sidebar/menu est "Factures & devis".

- Renommer la page en `dashboard-client.factures-devis.tsx` (route + lien sidebar) et y afficher **deux onglets** : "Mes devis" / "Mes factures".
  - Devis : badge doré `DEVIS`, montant TTC, bouton "Télécharger PDF" (existant), bouton "Réserver" si statut accepté.
  - Factures : badge `FACTURE` (couleur distincte), montant TTC, statut paiement, bouton "Télécharger PDF" (utilise `facture-pdf.ts` déjà présent ou `pdf_url`).
- `dashboard-client.missions.tsx` : retirer la colonne prix, ne garder que `numero`, trajet, véhicule + plaque, date, statut, lien suivi.
- `dashboard-client.index.tsx` : nettoyer la vue d'ensemble (sections "Mes demandes en cours", "Mes devis", "Mes missions", "Mes factures"), supprimer toute section morte.

## 3. Page détail mission client (suivi premium)

`dashboard-client.missions.$missionId.tsx` existe déjà mais reste basique.

- Ajouter au-dessus du tracker : timeline d'étapes (Acceptée → Prise en charge → En cours → Livrée → Restitution si applicable) alimentée par `attributions` / `mission_gates` (déjà utilisés par `MissionLiveTracker`).
- Bloc Véhicule : marque/modèle/plaque/VIN/carburant.
- Bloc Restitution (si `type_trajet` contient retour) : 2ᵉ plaque + adresse retour.
- Bloc Documents : devis lié, facture liée (si émise), documents mission (`MissionDocuments`).
- Aucune info admin sensible (prix de revient, marges, contact chauffeur privé…). Conserver le prix TTC payé par le client.
- Responsive mobile (grilles 1 col < 640px, déjà la base).

## 4. Facturation admin

La table `factures` existe déjà (`pdf_url`, `mission_id`, totaux, statut). À ajouter :

- Dans `admin.missions.$missionId.tsx` : bouton "Générer la facture" visible quand `statut = livree/terminee` et qu'aucune facture n'est rattachée.
- Server function `generateInvoiceFromMission(missionId)` :
  - lit mission + client + organisation,
  - calcule HT/TVA/TTC depuis `prix_total`,
  - insère ligne `factures` (numéro auto `F-YYYY-NNNN`),
  - génère le PDF via `facture-pdf.ts`, l'upload dans le bucket `factures` (créer si absent), stocke `pdf_url`,
  - envoie l'email "Votre facture" au client (template existant ou nouveau court template).
- Lien depuis la mission admin vers la facture créée. RLS : client voit ses factures via `client_email = auth.email()` ou `mission.user_id = auth.uid()`.

## 5. PDF Devis & Facture — finition premium

`devis-pdf.ts` est déjà très abouti. Améliorations ciblées :

- **Signature "GO"** : remplacer le texte italique `G.O` par une vraie signature manuscrite SVG/PNG embarquée (asset `src/assets/signature-go.png`), gardée petite et nette.
- **Icônes contact** : remplacer les lettres `@ T W` du header par des petits glyphes vectoriels propres (dessinés en jsPDF : enveloppe, téléphone, globe, pin).
- **Logo client** : déjà géré (`logo_url`). S'assurer que `facture-pdf.ts` accepte la même propriété et l'affiche à côté de la société.
- **Conditions de validité** : encadré doré dédié sous les totaux.
- **Détails prestation** : ajouter plaque + VIN si présent, prestation (Livraison simple / + restitution / Express), heure de livraison souhaitée.
- Appliquer la même refonte à `facture-pdf.ts` (mêmes header/footer/blocs) pour cohérence visuelle.

## 6. Garde-fous (ne rien casser)

- Aucun changement à `pricing-engine.ts`, `reservation-pricing.ts`, `pricing-departments.ts`, `pricing-resolver.ts`.
- `TunnelReservation` reste en place pour la route publique `/reserver` (non touchée).
- Aucune migration destructive : seulement `CREATE BUCKET IF NOT EXISTS factures` + politiques RLS de lecture client.
- Les anciens devis/factures déjà émis restent lisibles (pdf_url conservé).

---

## Détails techniques

**Fichiers modifiés**
- `src/components/DevisGenerator.tsx` — props `prefill`, `hideAccountStep`
- `src/routes/_authenticated/dashboard-client.nouvelle-reservation.tsx` — utilise `DevisGenerator` préfillé
- `src/routes/_authenticated/dashboard-pro.nouvelle-demande.tsx` — idem en mode instantané
- `src/routes/_authenticated/dashboard-client.devis.tsx` → renommer en `dashboard-client.factures-devis.tsx`, onglets devis/factures
- `src/routes/_authenticated/dashboard-client.missions.tsx` — retirer prix
- `src/routes/_authenticated/dashboard-client.missions.$missionId.tsx` — timeline, restitution, documents, facture
- `src/routes/_authenticated/admin.missions.$missionId.tsx` — bouton "Générer facture"
- `src/lib/facture-pdf.ts` — refonte cohérente avec `devis-pdf.ts`, support logo client
- `src/lib/devis-pdf.ts` — signature image, icônes vectorielles, encadré validité, détails étendus
- `src/lib/invoice.functions.ts` (nouveau) — `generateInvoiceFromMission`
- `src/components/dashboard/DashboardSidebar.tsx` — libellé "Factures & devis"
- `src/assets/signature-go.png` (nouveau)

**Migration**
- `storage.buckets` : `factures` (privé) + policies (admin write, client read si email/mission match)
- `factures` table : déjà ok, juste s'assurer que RLS SELECT autorise le client propriétaire

**QA**
- Créer une demande depuis dashboard client → estimateur identique au site, profil préfillé, devis en base avec `prix_estime` et `distance_km`.
- Générer facture depuis mission terminée → PDF téléchargeable côté client, email reçu.
- Anciennes missions/devis : toujours ouvrables.
