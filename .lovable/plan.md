## Contexte

3 chantiers + 1 rattrapage :

1. **Phase 5** — Permettre aux pros de payer leurs factures depuis leur espace (Stripe embedded checkout, comme côté client).
2. **Code externe par facture** — Pour les clients type CAT France qui paient à 30j via plateforme tierce et exigent un code interne différent à chaque dépôt de facture (n° BC, n° commande client, n° dossier…). Saisie ergonomique avant téléchargement + persistance.
3. **Phase 5 bis** — Pouvoir désactiver globalement (et par client) les relances automatiques et le passage en "En retard".
4. **Rattrapage** — Refonte de la page mission mobile côté convoyeur (jamais faite, à confirmer).

---

## 1. Code externe / référence client par facture

**Problème métier :** CAT (et d'autres flottes B2B) imposent à chaque facture une référence unique (n° commande, n° BC, n° dossier sinistre…) à reporter sur le PDF avant dépôt sur leur extranet. Aujourd'hui impossible.

### 1.1 Schéma

Ajout colonne `reference_client` (text, nullable) sur `factures`. Optionnel : `reference_label` (text, default "Référence client") pour personnaliser le libellé sur le PDF (ex. "N° de commande", "N° dossier").

### 1.2 UI admin — saisie ergonomique

**Fichier : `src/routes/_authenticated/admin.factures.tsx**`

Deux points d'entrée pour rester pro :

- **Édition inline rapide** : dans la liste, à côté du badge type B2B, un petit champ "Réf. client" éditable (icône crayon → input → ✓ sauvegarde). Vide = neutre, rempli = pill or.
- **Drawer détail** : nouveau bloc "Référence externe" avec champ `reference_client` + sélecteur `reference_label` (presets : Référence client / N° de commande / N° BC / N° dossier / Autre). Sauvegarde au blur.

**Bouton "Télécharger PDF"** : si `type_facture = b2b` et `reference_client` vide, prompt rapide ("Référence client pour cette facture ?") avant génération, avec option "ignorer". Évite les téléchargements sans code.

### 1.3 PDF

**Fichier : `src/lib/facture-pdf.ts**`

Ajouter `reference_client` et `reference_label` dans `FactureData`. Si présent, ligne dédiée dans le bloc client/facture en haut à droite : `{label} : {valeur}` (gras, encadré sobre, visible scan).

### 1.4 Mission → facture

**Fichier : `src/routes/_authenticated/admin.missions.$missionId.tsx**` (et dialog de génération facture si existant)

Au moment de générer la facture depuis une mission B2B, proposer un champ "Référence client" pré-rempli si dispo depuis la mission, sinon vide. Plus ergonomique que d'éditer après coup.

---

## 2. Phase 5 — Paiement Pro

### 2.1 Page Documents Pro (onglet Factures déjà créé phase 4)

**Fichier : `src/routes/_authenticated/dashboard-pro.documents.tsx**`

- Sur chaque ligne facture `emise` ou `en_retard` → bouton **"Payer"** (or, primaire) à côté de "Télécharger PDF"
- Click → ouvre un modal Stripe embedded checkout (réutilise le pattern de `DevisEmbeddedCheckout`)
- Montant : `prix_ttc` (ou HT si `tva_exempt`)
- Metadata Stripe : `{ facture_id, type: "facture_pro" }`

### 2.2 Endpoint checkout

**Fichier : `src/routes/api/facture/checkout.ts**` (nouveau, server route, modèle `api/devis/checkout.ts`)

POST `{ facture_id }` → vérifie ownership (email match) → crée Stripe Checkout Session embedded → retourne `client_secret`.

### 2.3 Webhook

**Fichier : `src/routes/api/public/facture/webhook.ts**` (nouveau, modèle `api/public/devis/webhook.ts`)

Sur `checkout.session.completed` avec `metadata.type = "facture_pro"` :

- `factures.statut = 'payee'`, `date_paiement = today`
- Notif admin
- Email confirmation au pro

### 2.4 Composant

**Fichier : `src/components/facture/FactureEmbeddedCheckout.tsx**` (nouveau, copie adaptée de `DevisEmbeddedCheckout`)

---

## 3. Phase 5 bis — Désactiver relances & retard

### 3.1 Réglages admin

**Fichier : `src/routes/_authenticated/admin.parametres.tsx**`

Nouvelle section "Relances factures" avec deux switches :

- `auto_relances_enabled` (bool) — Envoyer les relances email automatiques aux clients en retard
- `auto_retard_enabled` (bool) — Marquer automatiquement les factures en retard après `date_echeance`

Stockés dans `app_settings` (clés `factures.auto_relances`, `factures.auto_retard`).

### 3.2 Par client (option fine)

**Fichier : `src/routes/_authenticated/admin.clients.$clientId.tsx**`

Switch `Désactiver les relances pour ce client` → colonne `profiles.relances_disabled` (bool, default false). Utile pour clients comme CCAT qui ont leur propre cycle.

### 3.3 Job cron (si existant)

Si un cron pg passe les factures en `en_retard` ou envoie des relances : conditionner par les flags ci-dessus (lecture `app_settings` + `profiles.relances_disabled`). Si aucun cron n'existe encore, on l'esquive — juste mettre l'infra de réglage en place pour le futur.

### 3.4 Badge "En retard"

Si `auto_retard_enabled = false`, ne plus calculer le badge "En retard" côté admin/pro automatiquement à partir de `date_echeance` ; seul un passage manuel admin déclenche le statut.

---

## 4. Rattrapage — Mission mobile convoyeur

**Confirmation :** la refonte mobile dédiée n'a pas été faite. La page actuelle (`src/components/convoyeur/MissionCockpit.tsx`, 528 lignes) est responsive mais pas optimisée smartphone (hauteur header, padding, taille des CTA, lisibilité du timeline).

### Périmètre

**Fichiers : `src/components/convoyeur/MissionCockpit.tsx**` + sous-composants ciblés.

- Hero compact en sticky-top mobile (trajet départ→arrivée + chrono mission)
- Actions principales (Démarrer / Inspecter / Finaliser) en **bottom action bar fixe** (full-width, pouce-friendly, mêmes pills or que MissionCard)
- Workflow steps en accordéon vertical au lieu du layout horizontal desktop
- Documents véhicule en bottom-sheet plutôt que panneau latéral
- Tap targets ≥ 44px, typo 15-16px body, contraste renforcé
- Conservation totale du desktop (breakpoint `md:`)

Pas de refonte logique métier, uniquement layout/UX.

---

## Hors scope

- Pas de Stripe Connect / virements directs (paiement = même flux que client)
- Pas de génération de bordereau d'envoi par lot vers plateformes B2B (CCAT etc.) — uniquement saisie de la réf. par facture
- Pas de modification du PDF devis

---

## Ordre d'exécution proposé

1. **Code externe facture** (impact business immédiat CCAT) — schéma + UI admin + PDF
2. **Phase 5 bis** désactivation relances (rapide, débloque)
3. **Mission mobile convoyeur** (rattrapage UX terrain)
4. **Phase 5 paiement pro** (plus gros, dernier)

Confirme l'ordre ou indique ta priorité, je commence.