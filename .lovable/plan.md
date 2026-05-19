
## Objectif

Réparer l'estimateur (espace client / partenaire) et l'affichage des estimations dans le dashboard admin **sans rien casser** (devis, missions, comptes, dashboard actuel).

## Diagnostic

J'ai vérifié les 5 dernières demandes en base :

```
depart       arrivee      prix_estime  distance_km
Tours        Angers       (null)       (null)
Strasbourg   Châteauroux  (null)       (null)
...
```

→ Toutes les anciennes demandes ont `prix_estime` et `distance_km` **NULL**, même si le devis affiche 132 €. L'admin retombe alors sur le calcul auto (`quoteFromDemande`) qui échoue dès que l'adresse vient de Google Places (rue + CP + ville → la regex `extractCity` ne matche pas), d'où le message "Distance non calculable, devis manuel requis".

Le correctif appliqué dans le tour précédent insère bien `prix_estime`/`distance_km` pour les **nouvelles** demandes, mais :
- aucun fallback pour les demandes historiques (le prix est seulement dans la string `options`),
- libellé "Aller-retour" partout au lieu de "Livraison + restitution",
- pas de label clair sur le champ "Heure" (heure de livraison souhaitée).

## Changements

### 1. Admin — affichage robuste du prix (`src/routes/_authenticated/admin.demandes.tsx`)

- Ajouter une fonction `extractFromOptions(options)` qui parse `"Estimation: 132€ | Distance: 110km"` pour récupérer prix et km en fallback quand `prix_estime`/`distance_km` sont `NULL`.
- Ordre de priorité dans `PriceBlock` : `demande.prix_estime` → valeur extraite de `options` → `quoteFromDemande`.
- Idem pour la colonne "TTC" du tableau et l'affichage de la distance dans le drawer.

### 2. Backfill ponctuel des demandes existantes

Exécuter une migration data unique qui parse `options` et remplit `prix_estime` / `distance_km` pour les lignes où ils sont `NULL` mais où la string contient `Estimation:` / `Distance:`. Aucun changement de schéma, aucun impact sur les nouvelles demandes.

### 3. Estimateur desktop (`src/components/DevisGenerator.tsx`)

- Renommer le bouton et tous les libellés visibles :
  - "Aller-retour" → **"Livraison + restitution"** (carte de choix, sous-titre, récap, options string)
  - Garder la valeur interne `"aller-retour"` (côté DB / pricing) pour ne rien casser.
- Champ heure : libellé "Heure" → **"Heure de livraison souhaitée"** dans la barre principale ET dans l'étape 1.
- Forcer la saisie de l'heure avant le passage à l'étape suivante (validation soft : message d'aide, pas de blocage dur si vide pour rester tolérant).
- Vérifier que `heure_souhaitee` est bien passé à l'insert (déjà OK) et inclus dans le mail/PDF.

### 4. Estimateur mobile (`src/components/mobile/MobileDevisGenerator.tsx`)

- Mêmes renommages visibles "Aller-retour" → "Livraison + restitution" (bouton "A/R" devient "Restitution").
- Même libellé "Heure de livraison souhaitée".

### 5. Restitution (déjà en place, vérification)

- Section "Restitution" (départ/arrivée retour + 2ᵉ plaque + VIN) déjà présente sur desktop. Vérifier qu'elle apparaît bien dès qu'on choisit "Livraison + restitution" et que la 2ᵉ plaque arrive dans `immatriculation_retour` en base + dans le devis admin.

## Hors scope (pour ne rien casser)

- Pas de refonte de l'estimateur, des cartes prix ou du tunnel.
- Pas de modif des règles tarifaires (`reservation-pricing.ts`, `pricing-departments.ts`).
- Pas de modif du système de devis PDF, des missions, des comptes ni des RLS.
- Pas de modif de `TunnelReservation` (chemin séparé non concerné par la plainte).

## Vérifications post-changement

- Créer une nouvelle estimation (adresse Google Places type "12 rue X, 37000 Tours") → prix visible immédiatement dans le bandeau live.
- Vérifier en base : `prix_estime`, `distance_km`, `heure_souhaitee`, `immatriculation_retour` remplis.
- Dans `/admin/demandes` : prix TTC affiché dans la colonne et dans le drawer pour les nouvelles ET les anciennes demandes (via backfill).
- Choisir "Livraison + restitution" → bloc restitution s'affiche, 2 plaques séparées, infos retour visibles dans le drawer admin.
