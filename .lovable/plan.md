# Plan — Tarifs personnalisés & adresses par défaut (consolidation)

## État actuel (déjà en place — ne pas casser)

- Table `client_pricing_rules` + bloc admin (création, toggle, suppression, prix aller / A-R / express, suppléments par option).
- Table `client_default_addresses` + bloc admin (création, toggle, défaut, suppression).
- `src/lib/client-pricing.ts` — resolver avec scoring (ville_depart/ville_arrivee/trip_type) et fallback `prix_ttc`.
- `QuickMissionForm` applique automatiquement le tarif personnalisé puis fallback `calculateBasePrice`.
- Favoris chargés + bouton « Utiliser cette adresse » qui préremplit départ + contact + notes.
- Bloc contacts driver (`MissionContactsBlock`) déjà affiché dans le cockpit.

## Ce qui manque vs. la demande

1. Pas d'édition inline des tarifs ni des adresses (uniquement créer/supprimer).
2. Adresses traitées comme « départ uniquement » — pas de notion `address_type` (départ / arrivée / les deux).
3. Pas de défaut séparé pour l'arrivée.
4. Pas de page « Mes adresses » côté Dashboard Client Partner (admin only aujourd'hui).
5. Pas de toggle « Utiliser mon adresse par défaut » avec préremplissage automatique au montage.
6. Champs adresse limités : pas de ville/CP/pays/email contact en colonne dédiée.
7. Priorité des tarifs — le scoring existant mélange `ville_depart` et `ville_arrivee` mais ne distingue pas clairement « trajet exact » > « ville/zone » > « tarif général ».

## Travail à faire

### 1. Migration BDD (additive, non-cassante)

- `client_default_addresses` :
  - Ajouter `address_type text NOT NULL DEFAULT 'depart'` avec check `IN ('depart','arrivee','both')`.
  - Ajouter `ville text`, `code_postal text`, `pays text DEFAULT 'France'`, `contact_email text`.
  - Backfill : `address_type = 'depart'` pour les lignes existantes.
  - Autoriser le client connecté à gérer (INSERT/UPDATE/DELETE) ses propres adresses (policies `client_user_id = auth.uid()` ou `client_email = email JWT`).
- `client_pricing_rules` : ajouter colonne `priority integer DEFAULT 0` pour permettre à l'admin de forcer un ordre si besoin (laissé à 0 par défaut, n'impacte rien sinon).
- Aucune modification de `demandes_convoyage`, `trajets`, `missions`, `factures` — leurs colonnes contact_*/options_meta sont déjà en place et suffisantes.

### 2. Resolver de prix (`src/lib/client-pricing.ts`)

- Refactor du scoring pour appliquer explicitement les 4 niveaux de priorité :
  - **P1** : `ville_depart` ET `ville_arrivee` matchent (trajet exact).
  - **P2** : `ville_depart` OU `ville_arrivee` match, ou `zone_label` non vide.
  - **P3** : règle générale du client (toutes colonnes ville vides).
  - **P4** : retour `null` → caller fait le fallback `calculateBasePrice`.
- Bonus mineur pour `trip_type` exact vs `any`, et pour `priority` admin.
- Pas de changement d'API publique → aucun appelant à toucher.

### 3. Composants admin (édition inline + types d'adresse)

- `ClientPricingRulesBlock` : mode édition d'une règle existante (mêmes champs que la création, bouton « Modifier » sur chaque carte).
- `ClientDefaultAddressesBlock` :
  - Sélecteur `address_type` (Départ / Arrivée / Les deux) à la création et à l'édition.
  - Champs supplémentaires : ville, code postal, pays, email contact.
  - Édition inline.
  - Filtre visuel des adresses par type (départ / arrivée).
  - Renommer le titre du bloc en « Adresses favorites » (départ + arrivée).

### 4. Côté Dashboard Client Partner

- Nouvelle route `dashboard-pro/adresses.tsx` (« Mes adresses ») : même composant que l'admin mais auto-scopé au client connecté (RLS le permettra grâce à la nouvelle policy). Ajouter une entrée dans la nav du dashboard pro.
- Préremplissage dans `QuickMissionForm` :
  - Au montage, identifier les `is_default` de type `depart` et `arrivee`.
  - Stocker deux toggles `useDefaultDepart` / `useDefaultArrivee` (par défaut **activés** si une adresse par défaut existe pour ce type).
  - Quand le toggle est activé : prérempli `depart` ou `arrivee` + contact + tel + notes correspondants.
  - Quand l'utilisateur désactive le toggle ou édite le champ manuellement : on n'écrase plus.
  - Liste compacte des autres favoris (par type) sous chaque champ adresse, comme aujourd'hui mais filtrée par `address_type`.

### 5. Driver — vérification (pas de code à écrire)

`MissionContactsBlock` affiche déjà nom + tel + bouton appel pour départ/arrivée. Les `contact_depart_note` / `contact_arrivee_note` (= notes d'accès) sont déjà propagés via `copy_demande_to_trajet` (trigger en place). On confirme juste l'affichage des notes dans le bloc contact, sinon micro-ajustement.

## Détails techniques

```text
client_default_addresses (modifié)
├── address_type  text  CHECK IN ('depart','arrivee','both')  DEFAULT 'depart'
├── ville         text
├── code_postal   text
├── pays          text  DEFAULT 'France'
└── contact_email text

client_pricing_rules (modifié)
└── priority      int   DEFAULT 0
```

```text
Priorité resolver (nouveau)
P1  ville_depart + ville_arrivee tous deux matchent  → score 100 + priority
P2  ville_depart OU ville_arrivee match, ou zone_label défini → score 50 + priority
P3  règle générale (toutes villes vides)              → score 10 + priority
P4  rien → fallback calculateBasePrice (logique inchangée)
+5 si trip_type exact (vs 'any')
```

## Hors scope (explicitement)

- Workflow demande → mission → facture : inchangé.
- Design global du formulaire « Nouvelle mission » : pas de refonte visuelle, juste l'ajout de 2 toggles discrets.
- Aucune modification de la logique de paiement, de génération PDF, ou de la facturation.
- Pas de migration de données existantes hors backfill `address_type = 'depart'`.

## Tests à valider après implémentation

- Client A et Client B avec tarifs Tours différents → chacun voit son prix.
- Tarif personnalisé ville_depart seule (P2) vs trajet exact (P1) → P1 gagne.
- Adresse défaut départ activée → préremplie. Toggle off → champ libre. Édition manuelle → conservée.
- Adresse défaut arrivée séparée de celle de départ → bien indépendantes.
- Création/édition/suppression d'une adresse depuis « Mes adresses » côté client → visible côté admin.
- Driver voit nom/tel/notes des deux contacts.
