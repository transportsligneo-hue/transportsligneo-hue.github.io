## Cadre

- Aucune fonctionnalité existante supprimée. Tous les écrans/routes actuels restent en place — on corrige, on enrichit, on harmonise.
- Anciens devis/missions en base **non touchés** (audit légal). Nouvelle terminologie et nouveaux prix s'appliquent uniquement aux **nouveaux** documents.
- **Bleu électrique en accent uniquement** : on garde navy `#0b1026` + or `#d4af37` (mémoire brand). Le bleu électrique sert aux CTA interactifs, focus, badges live, GPS, états temps réel sur dashboards/PWA — il ne remplace ni le navy ni l'or.
- Livraison en 4 lots indépendants, testables séparément. Chaque lot finit par une passe build + vérification visuelle.

---

## Lot 1 — Estimateur, tarifs, terminologie (fondations métier)

### Tarification (source de vérité)

- `pricing-engine.ts` + `resolve_client_pricing_rule` (déjà source unique côté serveur) : ajout des nouveaux modificateurs.
- Options véhicule : roulant (base), **non roulant +70%**, plateau (forfait sur grille), **0 km** (forfait livraison neuf).
- **Jockeyage** = nouveau type de prestation, tarif < convoyage standard (grille séparée courte distance / forfait ville).
- Lavages : extérieur **24 € TTC**, intérieur+extérieur **59 € TTC**. Stockage **« sur devis »** — suppression du prix affiché, badge "Sur devis".
- Express → renommé **« Horaire & week-end »** (majoration weekend + créneau hors heures ouvrées).
- Recharge **batterie** et recharge **carburant** = options trajet (et non destination).
- Correction du bug 79 vs 95 : audit `pricing-engine.ts` + `pricing-resolver.ts` + `client-pricing.ts` pour s'assurer que `resolvePersonalizedPrice` est appelé partout et qu'aucun arrondi/TVA n'est appliqué deux fois. Test : trajet de référence → 79 € TTC strictement identique estimateur / devis / PDF / dashboard.

### UI estimateur (desktop + mobile)

- `DevisGenerator.tsx`, `MobileDevisGenerator.tsx`, `QuickMissionForm.tsx` : section options unifiée (composant `<EstimatorOptions />` partagé).
- **Choix trajet** : sélecteur ville↔département (4 combinaisons) avec autocomplete adaptatif.
- **Livraison + Restitution** remplace partout l'intitulé « aller-retour » côté UI (clé interne `is_aller_retour` conservée en DB pour compat). Étiquettes, libellés PDF, emails, statuts dashboard mis à jour.
- **2ᵉ plaque** déjà ajoutée — on la généralise aux 3 estimateurs avec UX cohérente.
- **Adresses favorites one-click** : composant `<FavoriteAddressPicker />` branché sur `client_default_addresses`, accessible dans estimateur client + QuickMissionForm.
- **N° de commande client** : champ optionnel saisissable jusqu'à émission facture, modifiable depuis dashboard client/admin, affiché sur devis + facture.

### Migration DB nouveaux devis

- `client_pricing_rules` : nouvelles colonnes `option_jockeyage_remise_pct`, `option_non_roulant_majoration_pct` (défauts 0).
- `demandes_convoyage` / `devis` : `numero_commande_client text`, `prestation_type text` (convoyage / jockeyage / 0km), `option_lavage text`, `option_carburant boolean`, `option_batterie boolean`.
- Pas de backfill, pas de recalcul des anciennes lignes.

---

## Lot 2 — Site vitrine (Services, Comment ça marche, À propos)

### `/services` (`ServicesContent.tsx` + `Prestations.tsx`)

- Refonte de la liste pour intégrer : jockeyage CT / vacances / révision, convoyage porte-à-porte, EDL digitalisé, signature électronique, livraison sécurisée, recherche véhicule par plaque, devis 3 s, livraison+restitution, et "convoyage complet".
- Chaque service = carte avec icône, titre, description courte, lien vers estimateur.

### `/comment-ca-marche` (`CommentCaMarcheTimeline.tsx`)

- Refonte en **10 étapes** détaillées : création compte → commande estimateur → devis auto → **signature obligatoire** → réception admin → validation → attribution convoyeur → suivi GPS → livraison + EDL signé → facturation auto.
- Chaque étape : icône, titre, description, mini-illustration ou capture.

### `/a-propos` (`AProposContent.tsx`)

- Suppression mention « salarié ».
- Nettoyage du tiret/barre dans la bio dirigeant.
- Correction chiffre **5 ans → 6 ans**.

---

## Lot 3 — Bug critique : signature devis + emails

### Signature devis (`DevisAcceptationStep.tsx` + `devis-acceptation.functions.ts`)

- Audit du flow actuel : SignatureCanvas → upload storage bucket `devis-acceptes` → `acceptDevis` server fn → PDF figé.
- Correction des points de rupture : politique RLS bucket, normalisation chemin user, intégration PDF dans `factures` une fois signé.
- Propagation : après signature, statut devis = `accepte` + `locked_at`, trigger `auto_create_trajet_from_devis` déjà existant produit livraison (+ restitution si AR). Vérifier que la mission remonte bien dans dashboard chauffeur / client / admin (cause des « devis perdus » signalés).

### Emails (refaire directement)

- Scaffold des templates manquants : **devis signé** (existe), **mission démarrée**, **incident**, **livraison terminée**, **nouveau devis admin**.
- Branchement systématique : trigger `notifyAdmin` + `sendTransactionalEmail` à chaque transition de statut critique (devis créé, devis signé, mission attribuée, mission démarrée, incident, mission terminée, facture émise).
- Vérification queue `email_send_log` + cron `process-email-queue` opérationnels.
- Notifications push (`push_subscriptions`) : envoi parallèle pour driver (nouvelle mission, mission modifiée).

---

## Lot 4 — Dashboards (Admin / Client / Driver) + GPS + design

### Design tokens (`src/styles.css`)

- Ajout token `--accent-electric: oklch(...)` (bleu électrique premium).
- Variantes : `.btn-electric`, `.badge-live`, `.gps-pulse`, `.focus-electric`.
- **Aucune modification des tokens navy/or existants** — uniquement ajout.
- Passe d'audit contraste (`text-cream/40` sur `bg-cream`, `text-white` sur fonds clairs, etc.) → remplacement par tokens sémantiques. Fichiers ciblés : dashboards, sidebars, cards admin.

### Admin (`/admin/*`)

- Renommage UI **« Organisation » → « Société / Partenaire »** (clé DB inchangée).
- `admin.devis.tsx` : édition devis avec historique modifications (table `activity_logs` existe déjà — UI timeline ajoutée).
- `admin.missions.$missionId.tsx` : édition adresse / heure / prix en cours de mission (server fn dédiée `updateMissionInFlight` qui propage vers trajet + notifie driver + client).
- `admin.attributions.tsx` : amélioration UI catalogue/assignation, ajout colonne enchères convoyeur.
- **Système d'enchères convoyeur** : nouvelle table `mission_enchere_proposals` (driver propose prix +X €, admin valide/refuse). Migration dédiée.
- Pages détaillées clients (`admin.clients.$clientId.tsx`) : onglets missions / devis / factures / documents / EDL — l'existant est complété, pas remplacé.
- Pages détaillées convoyeurs (`admin.convoyeurs.$convoyeurId.tsx`) : onglets documents / missions / EDL / paiements.

### Client (`/dashboard-client/*`)

- Signature devis (corrigée lot 3) accessible depuis `dashboard-client.devis.tsx`.
- Vue **GPS live** sur `dashboard-client.missions.$missionId.tsx` (composant `<MissionLiveTracker />` existant).
- Picker adresses favorites dans nouvelle réservation.
- Refonte sidebar : accès direct devis / missions / factures / documents.

### Driver PWA (`/convoyeur/*`)

- Catalogue missions (`convoyeur.disponibles.tsx`) : style Uber Eats, cards avec prix, distance, durée estimée, bouton accepter/refuser large.
- Onglets missions : en cours / validées / archivées (`convoyeur.missions.tsx` + `convoyeur.historique.tsx`).
- Compteur revenus mensuels sur `convoyeur.index.tsx` (somme `attributions` du mois).
- Scan documents (déjà présent via `DocumentScanner.tsx`) — vérification accès rapide depuis workflow.
- Signature mobile + tampon digital sur EDL final (`EdlPremiumFlow.tsx`) — vérif fonctionnel.
- Gate formation : nouveau champ `convoyeurs.formation_validee_at`, missions inaccessibles tant que NULL.

### GPS / Tracking

- `useGpsTracking.ts` : vérif émission position toutes les 30 s en mission, persisté dans `mission_locations` (table existe).
- Realtime channel sur `mission_locations` côté admin + client.
- Carte fluide (`GpsMapView.tsx`) avec marqueur animé + ETA.

---

## Détails techniques transverses

### Migrations DB (par lot)

- **Lot 1** : ajout colonnes `numero_commande_client`, `prestation_type`, options dans `devis` / `demandes_convoyage` / `trajets`. Pas de backfill.
- **Lot 3** : table `mission_enchere_proposals` (id, mission_id, convoyeur_id, prix_propose, statut, created_at) + RLS + grants standard.
- **Lot 4** : colonne `convoyeurs.formation_validee_at timestamptz`.

Toutes migrations respectent le contrat GRANT obligatoire (SELECT/INSERT/UPDATE/DELETE TO authenticated + ALL TO service_role).

### Auth (`/login`, `/reset-password`)

- Renommage UI **« Espace Pro » → « Espace Driver »**.
- Page « Mot de passe oublié » : libellé corrigé.
- Page validation compte : route existe (`/auth/email-confirmation`) — vérif copie + design cohérent.
- Appareil de confiance : badge "Cet appareil" via `localStorage` + UA hash.

### Factures / Devis PDF

- `devis-pdf.ts` + `facture-pdf.ts` : logo automatique depuis `app_settings.logo_url`, structure pro (en-tête société, mentions légales, signature en pied), affichage `numero_commande_client` si présent.
- Synchronisation totale : édition admin → trigger `devis_bump_version_on_change` (existe) → invalidation queries dashboards.

### Cohérence des données

- Toute édition admin de prix / adresse / heure passe par une **server fn unique** qui : 1) update DB, 2) log dans `activity_logs`, 3) notifie admin/client/driver concernés. Pas d'`update` direct depuis composants.

---

## Ordre d'exécution suggéré

1. **Lot 1** (estimateur + tarifs) — débloque la cohérence prix immédiatement.
2. **Lot 3** (signature + emails) — débloque la chaîne devis→mission→facture.
3. **Lot 2** (vitrine) — corrections rapides, indépendant.
4. **Lot 4** (dashboards + GPS + design) — le plus gros, fait en dernier sur fondations stabilisées.

Je propose d'enchaîner Lot 1 dès validation. Les lots suivants seront re-cadrés au moment de leur démarrage pour intégrer ce qu'on aura appris du précédent.