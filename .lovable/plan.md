## Objectif

Traiter chaque demande aller-retour comme **deux missions distinctes et indépendantes** (Aller + Retour), reliées par un `mission_group_id` uniquement pour la navigation. Formulaire client public inchangé.

Bonne nouvelle : l'infrastructure DB partielle est déjà en place (`mission_group_id`, `leg_type`, `leg_index` existent sur `missions` **et** `trajets`, `demandes_convoyage` a déjà `depart_retour`, `date_retour`, `prix_aller`/`prix_retour` côté `devis`). Le travail consiste à propager la logique jusqu'aux **missions** (aujourd'hui seuls les `trajets` sont éclatés via `auto_create_trajet_from_devis`) et à exposer l'édition indépendante côté admin.

## Plan

### 1. Migration DB (schéma + logique serveur)

- **`missions`** : garantir que `leg_type` accepte `simple|aller|retour`, `leg_index` (1 = aller, 2 = retour), `mission_group_id uuid`. Ajouter `prix_locked boolean default false` pour figer un prix modifié manuellement.
- **Fonction `split_ar_prices(total numeric)`** : retourne `(aller, retour)` avec règle 2/3 – 1/3, aller arrondi au centime **supérieur**, retour = total − aller (garantit somme exacte).
- **RPC `admin_convert_demande_to_missions(_demande_id uuid)`** (SECURITY DEFINER, admin/super_admin) :
  - lit la demande, détecte AR (`options='aller_retour'` OU `depart_retour` non vide),
  - génère `mission_group_id`,
  - crée 1 mission simple **ou** 2 missions (Aller + Retour inverse pré-rempli, véhicule/adresses/contacts propres, prix éclatés via `split_ar_prices`),
  - retourne les IDs.
- **RPC `admin_unlink_mission_from_group(_mission_id)`** : met `mission_group_id = null`, `leg_type = 'simple'`.
- **RPC `admin_cancel_mission_leg(_mission_id)`** : marque annulée, laisse le jumeau intact.
- **RPC `admin_set_mission_prix(_mission_id, _prix)`** : set `prix_total`, `prix_locked = true`, **pas** de recalcul du jumeau.
- Suivre le pattern GRANT + RLS existant.

### 2. Réutilisation du flux devis payé

`auto_create_trajet_from_devis` continue de créer les trajets. Étendre pour créer aussi les **missions** correspondantes (aujourd'hui c'est manuel/absent) via la même logique de split, en respectant `prix_aller`/`prix_retour` s'ils sont saisis, sinon `split_ar_prices(prix_estime)`.

### 3. Admin UI

- **Liste missions** (`admin.missions` / `admin.exploitation`) : badge **"Aller"** / **"Retour"** + petit chip cliquable "↔ jumeau" ouvrant l'autre mission.
- **Détail mission admin** (`admin.missions.$missionId`) :
  - Bandeau AR : "Mission Aller de MIS-XXX ↔ voir Retour MIS-YYY", boutons **Dissocier** et **Annuler ce sens**.
  - Champ **prix** éditable inline (input €) → appelle `admin_set_mission_prix`, badge "prix figé manuellement" si `prix_locked`.
  - Édition indépendante véhicule / adresses / contacts / convoyeur (déjà en place).
- **Détail demande admin** (`admin.demandes`) : bouton **"Convertir en missions"** qui appelle la nouvelle RPC, redirige vers la 1ʳᵉ mission créée.

### 4. Espace client

- Liste missions client (dashboard-client + dashboard-pro + flotte) : badge Aller/Retour, lien "Voir la mission liée".
- Détail mission (`ClientMissionDetailView`) : encart "Mission jumelle" avec lien.

### 5. Tarification côté public (aligner l'estimateur)

Cas limite explicite du user : appliquer la même règle 2/3 – 1/3 avec arrondi centime supérieur sur l'aller dans `src/lib/reservation-pricing.ts` / `client-pricing.ts` / `pricing-engine.ts` pour que l'affichage tunnel/devis colle à la répartition serveur (aujourd'hui la répartition peut différer de quelques centimes).

### 6. Cas limites couverts

- Annulation d'un sens → l'autre reste actif (statut indépendant, aucune cascade).
- Édition prix/véhicule/adresse d'une mission → aucun trigger n'écrase le jumeau (`prix_locked` empêche tout recalcul auto).
- Dissociation totale → `mission_group_id` mis à `null` sur les deux, badges retirés.
- Total non divisible (100 €) → aller 66,67 € / retour 33,33 € (somme = 100,00 €).

## Détails techniques

- Migration unique groupant : ajout `prix_locked`, `split_ar_prices`, `admin_convert_demande_to_missions`, `admin_unlink_mission_from_group`, `admin_cancel_mission_leg`, `admin_set_mission_prix`, mise à jour de `auto_create_trajet_from_devis` pour créer aussi les missions AR.
- Composants front nouveaux : `MissionLegBadge`, `MissionTwinLink`, `AdminMissionPriceEditor`.
- Aucun changement dans `handle_new_user`, `client.ts`, formulaires publics.
- Build/typecheck après chaque étape.

## Non inclus

- Formulaire de demande client (inchangé, comme demandé).
- Refonte de la logique tarifaire globale : on aligne uniquement la répartition AR.
