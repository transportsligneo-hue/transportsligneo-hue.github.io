## Objectif

Ajouter un parcours "Nouvelle demande de convoyage" dans chaque espace client, avec paiement Stripe obligatoire pour les particuliers/pros, et workflow devis/facturation pour B2B/flotte/partenaire. Finir en parallèle la page détail mission admin et la QA visuelle des 3 PDFs.

## Lot 1 — Finir l'admin (reste du tour précédent)

1. **Page détail mission** `src/routes/_authenticated/admin.missions.$missionId.tsx`
   - Bloc client (nom, email, tel, société, type)
   - Bloc trajet (départ → arrivée, distance, durée, date)
   - Bloc véhicule (marque, modèle, immat, carburant)
   - Bloc convoyeur attribué + bouton réattribuer
   - Aperçu PDF iframe + bouton télécharger
   - Actions : changer statut, annuler, ouvrir incident
2. Bouton œil dans `admin.missions.tsx` vers la page détail
3. **QA visuelle des 3 PDFs** : génération échantillon → `pdftoppm` → inspection → corrections

## Lot 2 — Composant partagé "Nouvelle demande"

Wizard mobile-first en 5 étapes, réutilisable :

```text
[1 Départ/Arrivée] → [2 Véhicule] → [3 Date] → [4 Récap + Prix] → [5 Paiement OU Confirmation]
```

- Fichiers :
  - `src/components/quick-request/QuickRequestWizard.tsx` (orchestrateur)
  - `src/components/quick-request/Step{1..5}.tsx`
  - `src/hooks/useQuickRequest.ts` (état + calcul prix via logique existante de l'estimateur)
- Variantes par mode :
  - `mode: "paid"` (particulier, pro non-B2B) → étape 5 = paiement Stripe Embedded
  - `mode: "invoiced"` (B2B, flotte, partenaire) → étape 5 = "Demande envoyée, devis à valider"
- Calcul prix : réutiliser la formule existante de `/tarifs` (per-km + forfaits Tours)

## Lot 3 — Intégration dans les 4 espaces

Ajouter un bouton CTA "+ Nouvelle demande" en haut de chaque dashboard :

1. `src/routes/_authenticated/espace-client.tsx` (particulier) → mode `paid`
2. `src/routes/_authenticated/espace-pro.tsx` (pro non-B2B) → mode `paid`
3. `src/routes/_authenticated/espace-b2b.tsx` (B2B/flotte) → mode `invoiced`
4. `src/routes/_authenticated/espace-partenaire.tsx` → mode `invoiced`

Le routage espace ↔ mode est déterminé par `profiles.type_client` (`particulier` / `b2b` / `flotte`) et le rôle.

## Lot 4 — Paiement Stripe (mode `paid`)

Stripe sandbox déjà actif dans le projet (`STRIPE_SANDBOX_API_KEY`, `PAYMENTS_SANDBOX_WEBHOOK_SECRET`).

1. **Edge function** `supabase/functions/create-checkout/index.ts`
   - Reçoit `{ demandeId, environment }`
   - Crée Stripe Customer (`resolveOrCreateCustomer` avec `metadata.userId`)
   - Crée session `ui_mode: "embedded_page"` avec `price_data` (prix dynamique calculé côté serveur, jamais côté client)
   - Retourne `clientSecret`
2. **Edge function** `supabase/functions/stripe-webhook/index.ts`
   - Vérifie signature
   - Sur `checkout.session.completed` : crée mission, génère facture, marque demande `payee`, envoie email confirmation, crée admin_notification
3. **Composant** `src/components/quick-request/StripeCheckoutStep.tsx` (Embedded Checkout)
4. **Page retour** `src/routes/checkout-return.tsx`
5. `supabase/config.toml` : `verify_jwt = false` sur `create-checkout` et `stripe-webhook`

## Lot 5 — Workflow B2B (mode `invoiced`)

1. Insert dans `demandes_convoyage` avec `statut = "en_attente_devis"`
2. Création automatique d'un `devis` en `statut = "envoye"`
3. Email client + admin_notification
4. Aucune mission tant que devis non `accepte` (statut visible dans l'espace)
5. Affichage badge statut dans la liste des demandes : `en_attente`, `validee`, `facturee`, `payee`

## Lot 6 — Schéma DB

Migration nécessaire :

- Ajouter colonne `demandes_convoyage.stripe_session_id text`
- Ajouter colonne `demandes_convoyage.payment_status text default 'pending'` (`pending` / `paid` / `invoiced`)
- Ajouter colonne `demandes_convoyage.user_id uuid` (lien avec auth.users) + index
- Trigger : à l'insert si `auth.uid()` non null, set `user_id = auth.uid()`
- RLS : `Users can read own demandes` (par `user_id`), `Users can create own demandes`

## Lot 7 — Email & notifications

- Réutiliser l'infra emails existante (`enqueue_email`)
- Templates :
  - `demande-paiement-confirme` (particulier/pro)
  - `demande-recue-b2b` (B2B/flotte/partenaire)
- Notifications admin via `create_admin_notification` avec les nouveaux types autorisés (déjà whitelistés : `estimation`, `devis`, `b2b_lead`)

## Détails techniques

- Calcul prix **côté serveur** dans `create-checkout` (interdiction de faire confiance au montant envoyé par le client)
- Stripe utilise `createStripeClient` du `_shared/stripe.ts` (gateway, jamais clé directe)
- Le wizard est responsive (≤768 = 1 col, ≥1024 = 2 col avec récap latéral)
- Animations CSS/Tailwind uniquement (pas de framer-motion — contrainte mémoire)
- Tokens design midnight blue/gold conservés

## Ordre d'exécution

1. Lot 1 (admin mission detail + QA PDFs) — court
2. Lot 6 (migration DB) — bloque la suite
3. Lot 2 (wizard composant)
4. Lot 4 (Stripe edge functions + webhook)
5. Lot 5 (workflow B2B)
6. Lot 3 (intégration dans les 4 espaces)
7. Lot 7 (emails) — polissage final

## Hors scope (à clarifier si besoin)

- Modification du tunnel public `/estimation` (reste devis only, pas de paiement)
- Annulation / remboursement Stripe (workflow séparé)
- Paiement sur facture B2B via lien Stripe (peut être un Lot 8 séparé)
