# Nouvelle mission (Simple / Groupée) + thème clair Flotte/B2B

Référence visuelle : `nouvelle-mission-flotte.html`. L'espace Flotte est déjà fusionné dans `/dashboard-pro` (routes `/flotte/*` redirigent) — j'agis donc sur `dashboard-pro`.

## 1. Écran de choix "Nouvelle mission"

- Nouvelle route `dashboard-pro.nouvelle-mission.tsx` : deux cartes (Simple / Groupée), reprend la maquette.
- Le lien "Nouvelle mission" de la sidebar pointe désormais sur cette route.
- L'ancien formulaire `dashboard-pro.nouvelle-demande.tsx` **n'est pas modifié** — il est simplement atteint via le bouton "Mission simple". Un bandeau "← Retour au choix" est ajouté en tête.

## 2. Mission groupée (nouveau flux réel)

Nouvelle route `dashboard-pro.nouvelle-mission.groupee.tsx` avec 4 étapes (stepper client, un seul écran, pas de sous-routes).

### Étape 1 — Sélection véhicules
- Source : table `vehicles` filtrée par `organization_id` du user courant (via `useCurrentOrgAccountType`).
- Colonnes affichées : modèle, plaque, site (`organization_sites`), statut.
- Statut dérivé : véhicules avec mission active (`missions` en `attribue`/`en_cours`) → grisés non sélectionnables. Statut `maintenance` sur `vehicles` → grisé.
- Recherche (modèle/plaque/site) + filtre puce par site.
- Barre sticky bas : compteur + bouton Continuer.

### Étape 2 — Trajet & planning
- Adresse d'enlèvement commune, pré-remplie depuis `organizations.address` / `organization_sites` principale.
- Toggle "Destinations différentes par véhicule" : si off → un seul input ; si on → un input par véhicule sélectionné.
- Date (shadcn DatePicker) + créneau (matin/après-midi/journée) en radio.

### Étape 3 — Récapitulatif
- Pour chaque véhicule : appelle le server fn existant `resolvePersonalizedPrice` (même moteur que Mission simple) avec le trajet correspondant.
- Total consolidé TTC affiché en or.
- Champ message facultatif.
- "Confirmer la mission groupée" :
  - Génère une référence `GRP-TLG-YYYY-XXX` (server fn nouveau).
  - Crée N lignes dans `demandes_convoyage` (une par véhicule), avec un champ `group_reference` renseigné, en réutilisant exactement le pipeline actuel (les triggers existants créent le devis/mission).

### Étape 4 — Confirmation & suivi
- Écran de succès : référence groupe + liste des véhicules avec statut initial (récupéré via realtime sur `demandes_convoyage`/`missions` filtrés par `group_reference`).
- Chaque carte véhicule cliquable → détail mission individuelle.
- Sur `dashboard-pro.missions.index.tsx` : regroupement visuel des missions partageant une même `group_reference` (accordéon "Mission groupée GRP-…"). Non destructif : les missions non groupées s'affichent comme avant.

### Détails techniques

- **Migration DB** : ajouter `group_reference text` sur `demandes_convoyage` et `missions` (nullable, indexé). Trigger existant qui copie les champs demande→mission propagera automatiquement si on ajoute la colonne aux deux et met à jour le trigger, ou plus simplement on repasse un UPDATE après création côté server fn.
- **Server fn** `createGroupedMission` (`src/lib/grouped-mission.functions.ts`) sous `requireSupabaseAuth` : valide entrée Zod, calcule prix par trajet via l'engine existant, insère N demandes avec `group_reference`, renvoie la référence + IDs.
- Aucune modification du moteur de prix, ni de la logique d'attribution, ni de l'app convoyeur.

## 3. Thème clair Flotte + B2B (dashboards uniquement)

Le layout `dashboard-pro.tsx` monte déjà `[data-org-theme]`. J'ajoute un mode `theme="light"` scopé aux dashboards Flotte/B2B via un wrapper `dashboard-shell-light` sur ces layouts uniquement.

Nouveau bloc CSS dans `src/styles.css` (namespace `.dashboard-shell-light`) :
- `--bg: #f6f8fc`, `--surface: #ffffff`, `--border: #e7ebf3`, texte `#0f1526`/`#6b7590`.
- Accents : bleu `#2f5fff` (primary), or `#b8862a` (montants), violet `#7c5cff` (badges Flotte / groupée).
- Padding généreux sur `.card`, `.section`.
- Typos inchangées (Poppins/Inter/Space Grotesk déjà chargées).

Appliqué sur :
- `src/routes/_authenticated/dashboard-pro.tsx` (layout Flotte/B2B fusionné).
- Aucun impact sur : site public, app convoyeur (`convoyeur.*`), admin, dashboard-client.

## 4. Ordre d'exécution

1. Migration DB (`group_reference`).
2. Server fn `createGroupedMission`.
3. Route de choix + redirect sidebar.
4. Route mission groupée (4 étapes) + bandeau retour sur mission simple.
5. Regroupement visuel dans `dashboard-pro.missions.index.tsx`.
6. Thème clair sur layout dashboard-pro.
7. Test manuel Playwright (compte flotte de test) sur preview.

## Décisions à confirmer

- **Créneau horaire** (matin/après-midi/journée) : je stocke la valeur en clair dans le champ `commentaires` de `demandes_convoyage` (pas de colonne dédiée aujourd'hui), OU je crée une colonne `time_slot`. Je pars sur la **colonne dédiée** pour rester propre.
- **`group_reference`** : format `GRP-TLG-YYYY-XXX` avec XXX = compteur annuel via séquence PG.
- **Adresse enlèvement pré-remplie** : je prends `organizations.address` en priorité, sinon le premier `organization_sites` marqué principal.

Dis-moi si l'un de ces points doit changer, sinon je lance dans l'ordre indiqué.
