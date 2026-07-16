
## Diagnostic

Trois problèmes distincts, tous localisés dans l'administration.

### 1. Bug — la mission "disparaît" quand on la publie au catalogue

Racine identifiée : `src/routes/_authenticated/admin.attributions.tsx`, ligne 333-335.

```ts
const assignableTrajets = trajets.filter(
  (t) => !(t.statut_publication === "publie" && ["catalogue", "mixte"].includes(t.attribution_mode ?? "")),
);
```

Dès que `admin_publish_to_catalogue` bascule un trajet en `statut_publication='publie'` + `attribution_mode='catalogue'`, ce filtre le retire de la colonne "Trajets à attribuer". Le trajet existe toujours en base mais n'apparaît plus dans la vue Attributions (et il n'est pas non plus listé dans la table du haut, qui ne montre que les attributions déjà créées). Résultat : impression de disparition.

La page `admin.trajets` conserve elle le trajet — il est juste marqué "Publié". Le bug est donc bien un problème d'affichage sur `admin.attributions`.

### 2. Ergonomie — deux étapes séparées "Trajets" + "Attributions"

Aujourd'hui l'admin doit :
1. aller sur `/admin/trajets`, ouvrir un trajet, éventuellement le publier ou définir le prix ;
2. puis aller sur `/admin/attributions` pour cliquer "Assigner" et choisir un convoyeur.

Beaucoup d'aller-retour pour une seule mission.

### 3. Outil manquant — pas de moyen simple de tester le pipeline sans polluer les stats

## Corrections proposées

### A. Fix bug d'affichage (chirurgical, aucun changement métier)

Dans `admin.attributions.tsx`, remplacer le filtre "exclusion catalogue" par un **marqueur visuel** :
- garder le trajet visible dans "Trajets à attribuer",
- ajouter un badge "Au catalogue" à côté,
- l'action "Assigner un convoyeur" reste possible (mode mixte / reprise en main admin).

Aucune RPC, aucune policy, aucun workflow modifié.

### B. Fusion Trajet + Attribution — mode "cockpit unifié"

Objectif : **zéro rupture existante**. On ne fusionne pas les tables ni les pages elles-mêmes (elles restent accessibles pour tout usage avancé). On ajoute une action fluide.

Concrètement :
- Sur la ligne d'un trajet (dans `/admin/trajets` **et** dans la carte "À attribuer" de `/admin/attributions`), un bouton **"Traiter"** ouvre une modale unique en 3 sections empilées :
  1. **Trajet** — édition inline des champs essentiels (départ, arrivée, date, véhicule, prix client, tarif convoyeur, notes) ;
  2. **Publication** — choix "Attribution directe / Publier au catalogue" (radio) avec les options existantes ;
  3. **Assignation** — si "Attribution directe" : réutilise le composant existant `AssignDriverDialog` inline (liste convoyeurs + score + flottes).
- Un seul clic "Enregistrer & attribuer" applique tout dans l'ordre : `UPDATE trajets` → `admin_publish_to_catalogue` (si choisi) OU création de l'`attribution` (si convoyeur choisi).
- Les pages `/admin/trajets` et `/admin/attributions` continuent d'exister à l'identique pour la compatibilité (aucune régression sur les usages avancés — offres, contre-offres, historique, etc.).

Composant nouveau : `src/components/admin/MissionDispatchDialog.tsx` — réutilise `PricingModeBlock`, `PublishToCatalogueButton` (logique interne), et `AssignDriverDialog` (liste convoyeurs).

### C. Outil "Créer une mission test"

- Nouvelle colonne booléenne `trajets.is_test_data` (default false), indexée.
- Toutes les vues publiques existantes (`trajets_publies_safe`, RPC catalogue convoyeur, listes client/convoyeur/entreprise) filtrent `WHERE is_test_data = false`. Les stats et exports filtrent pareil.
- Dans l'admin : header `/admin/trajets` gagne un bouton discret **"Créer mission test"** (icône flask). Génère un trajet fictif préfixé `TEST — Paris → Lyon` avec véhicule, prix et statut réalistes.
- Badge visuel `TEST` (jaune) sur toutes les lignes admin où `is_test_data = true`.
- Bouton "Supprimer" en un clic (cascade sur attributions, offres, historique liés).

Politique RLS admin inchangée : les admins voient tout ; le filtre "is_test_data" est appliqué **uniquement dans les vues et RPC lues par les non-admin**, garantissant que les missions test n'apparaissent jamais côté client/convoyeur/rapport.

## Livraisons

### Migration SQL
- `ALTER TABLE trajets ADD COLUMN is_test_data boolean NOT NULL DEFAULT false`
- Index partiel `WHERE is_test_data = true`
- Mise à jour de `trajets_publies_safe` et des RPC catalogue pour exclure les tests
- Fonction `admin_create_test_mission()` (SECURITY DEFINER, réservée admin) qui insère un trajet test cohérent
- Fonction `admin_delete_test_mission(uuid)` qui supprime le trajet + cascade manuelle (attributions, offres, historique) — restreinte à `is_test_data = true` pour éviter les accidents

### Code
- **Fix** `src/routes/_authenticated/admin.attributions.tsx` : suppression du filtre exclusif catalogue + ajout badge "Au catalogue"
- **Nouveau** `src/components/admin/MissionDispatchDialog.tsx` (cockpit unifié Trajet + Publication + Assignation)
- **Nouveau** `src/components/admin/TestMissionActions.tsx` (bouton créer + supprimer + badge TEST)
- **Édits légers** `admin.trajets.tsx` (bouton "Traiter", bouton "Créer mission test", badge TEST) et `admin.attributions.tsx` (bouton "Traiter" en remplacement du "Assigner", badge TEST)
- Aucun changement dans `admin.exploitation`, `admin.demandes`, dashboards client/convoyeur/pro, RPC existantes, edge functions.

## Ce qui reste intouché

- Formulaires publics de demande / réservation client
- Espace client, espace convoyeur, espace pro, espace flotte
- Toutes les RPC existantes (`admin_publish_to_catalogue`, `admin_convert_demande_to_missions`, etc.)
- Toutes les policies RLS existantes (on ajoute uniquement un filtre `is_test_data` dans les vues publiques)
- Pages `admin.trajets` et `admin.attributions` (elles restent accessibles avec toutes leurs fonctionnalités actuelles ; on ajoute juste un bouton "Traiter" et le badge TEST)
- Le module Formation, les tarifs, l'exploitation live, les paiements
