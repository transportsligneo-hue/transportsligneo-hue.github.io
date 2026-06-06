
# Plan de refonte Transports Ligneo

Travail découpé en 5 phases livrées séquentiellement. Chaque phase est testable et déployable seule. Je m'arrête en fin de chaque phase pour validation avant d'attaquer la suivante.

---

## Phase 1 — Nettoyage marques & identité visuelle (rapide, sûr)

**Objectif** : supprimer toute trace Welcome Auto / Ayvens, garantir que le logo Ligneo apparaît partout.

- Recherche globale (`rg`) sur `welcome auto`, `ayvens`, `WelcomeAuto`, `AYVENS` dans :
  - code source (`src/`, `supabase/`)
  - templates email (`src/lib/email-templates/`)
  - libs PDF (`devis-pdf.ts`, `facture-pdf.ts`, `mission-pdf.ts`, `edl-final-pdf.ts`)
  - base de données (champs `logo_url`, `client_nom`, partners, etc.)
- Remplacement par neutre ou logo Ligneo.
- Vérifier `PartnersMarquee` (mémoire dit "intouchable" — je retire seulement Welcome Auto / Ayvens si présents).
- Centraliser le logo Ligneo dans un composant unique + URL stable (`/logo-ligneo.png` ou import asset) utilisé dans :
  - emails (composant `<Img />` partagé)
  - PDF (devis/facture/mission/EDL)
  - notifications navigateur

**Livrable** : 0 occurrence des deux marques, logo Ligneo cohérent partout.

---

## Phase 2 — Fusion espaces B2B + Flotte

**Objectif** : un seul espace pro (`/pro`) qui sert client_b2b ET flotte_partenaire avec les mêmes routes/composants.

- Audit des routes existantes : `/dashboard-pro/*`, `/entreprise/*`, `/flotte/*`.
- Choix de la cible : garder `/pro` comme racine unique, alias `/dashboard-pro`, `/entreprise`, `/flotte` en redirections.
- Fusion sidebar : sidebar pro unique avec items conditionnels (ex. "Mes conducteurs" uniquement si `orgRole = flotte_partenaire`).
- Mise à jour `useAuth.computeHomeRoute` → toutes les variantes pro retournent `/pro`.
- Permissions : composant `<ProFeature requires="flotte_partenaire">` pour les blocs réservés flotte.
- Migration : pas de changement schéma, juste route layer + composants.

**Livrable** : `/pro` unique, anciennes URLs redirigent, parité fonctionnelle.

---

## Phase 3 — Refonte espace particulier sur design pro

**Objectif** : `/dashboard-client` reprend la sidebar/cards/header de `/pro` avec un sous-ensemble d'items.

- Réutiliser `ProSidebar` (renommée `ClientSidebar` ou paramétrée).
- Items particulier : Vue d'ensemble · Nouvelle demande · Mes missions · Devis · Factures · Profil.
- Pas d'accès : adresses favorites bulk, société, conducteurs, dispatch.
- Réutiliser les mêmes composants cards/tables que le pro.
- Conserver les routes existantes `/dashboard-client/*`, juste mise à niveau visuelle + UX.

**Livrable** : particulier ↔ pro = même feel, fonctions filtrées.

---

## Phase 4 — Stripe complet

**Objectif** : paiement automatique pour particuliers + pros sans rôle org récurrent ; facturation différée pour `flotte_partenaire` et `client_b2b`.

Règle confirmée : `orgRole IN ('flotte_partenaire','client_b2b')` → différé. Sinon → Stripe obligatoire.

- Audit existant : routes API Stripe déjà en place (`/api/devis/checkout`, `/api/b2b/checkout`, `/api/facture/checkout`, webhooks `/api/public/devis|facture|b2b/webhook`). Utilise `stripe-server.ts` via gateway Lovable.
- Helper `requiresImmediatePayment(user)` côté client + serveur :
  - lit `organization_roles` du user
  - true sauf si flotte_partenaire ou client_b2b
- Brancher dans :
  - création devis → si paiement requis : tunnel Stripe Checkout embedded obligatoire avant validation
  - création mission ponctuelle pro → idem
  - particulier : Stripe systématique
- Webhooks Stripe (déjà présents) : vérifier qu'au `payment_succeeded` :
  1. statut paiement mis à jour (`paid_at`)
  2. facture PDF générée auto (déclencher `facture-pdf.ts`)
  3. notification admin (`notifyAdmin` type `b2b_paiement`)
  4. email confirmation client (`mission-confirmation` ou nouveau template `paiement-confirme`)
- Test sandbox : carte `4242 4242 4242 4242`.
- Banner test mode (`PaymentTestModeBanner`) ajouté sur layouts paiement.

**Livrable** : flux paiement bout-en-bout, facture auto, notifications.

---

## Phase 5 — Audit emails & notifications

**Objectif** : pour chaque événement listé, un email + une notif admin déclenchés.

Matrice à vérifier/compléter :

| Événement | Email client | Notif admin | Statut actuel |
|---|---|---|---|
| Inscription | ✓ welcome | ✓ client_action/driver_action | déjà fait |
| Validation compte convoyeur | ✓ convoyeur-validation | ✓ | à vérifier |
| Demande de devis | ✓ devis-client | ✓ devis | à vérifier |
| Création mission | ✓ mission-confirmation | ✓ | à vérifier |
| Attribution convoyeur | ⨯ à créer | ✓ mission_acceptee | manquant côté client |
| Changement statut | ⨯ optionnel | ⨯ | à décider |
| Mission terminée | ⨯ à créer | ✓ mission_terminee | manquant côté client |
| Facture générée | ⨯ à créer | ⨯ à créer | manquant |
| Paiement Stripe validé | ⨯ à créer | ✓ b2b_paiement | template à créer |
| Reset password | ✓ recovery (auth) | n/a | OK |

- Audit `src/lib/email-templates/registry.ts` + tous les call sites.
- Ajouter templates manquants (logo Ligneo en header).
- Vérifier `notifyAdmin` appelé partout (déjà fait sur inscriptions selon historique).
- Tester via `/lovable/email/transactional/preview` chaque template.
- Vérifier que `email_send_log` n'a pas de DLQ.

**Livrable** : matrice 100% verte.

---

## Détails techniques transverses

- Aucun changement de stack (TanStack Start + Supabase + Stripe via gateway Lovable).
- Migrations DB attendues : aucune phase 1-3 ; phase 4 possiblement une colonne `requires_stripe boolean` sur `organizations` si on retient l'override admin un jour. Pour l'instant règle déduite à la volée.
- Tests : build après chaque phase, smoke test du flow concerné.
- Pas de framer-motion (mémoire).
- Respect tokens design `oklch` / `.glass-onyx` / `.card-premium-light`.

---

## Ordre d'exécution

Je commence Phase 1 dès validation de ce plan, puis stop pour confirmation avant Phase 2. Si tu veux que j'enchaîne sans pause, dis-le et je fais 1 → 5 d'affilée (durée ≈ très longue, plusieurs tours d'outils).

Validez-vous ce découpage ? Quelque chose à ajuster avant que je commence ?
