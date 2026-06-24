
# Évolution Enterprise Ligneo — Plan de livraison par lots

Ce chantier représente plusieurs semaines de développement. Pour ne **rien casser** de l'existant (workflows convoyeur, paiements Stripe, EDL, signatures, GPS client, archivage 30j…), je propose de livrer en **8 lots indépendants et testables**, chacun déployable seul. Tu valides lot par lot.

---

## Lot 1 — Fondations data & sécurité (socle des autres lots)

**Migration BDD** (tout en une seule migration approuvée) :

- `missions.mission_group_id` (uuid) + `missions.leg_type` (`aller` / `retour` / `simple`) + `missions.leg_index`
- `trajets.mission_group_id` (uuid) — déjà partiellement géré via `parent_trajet_id`, on ajoute la notion de groupe
- Table `vehicles` (catalogue véhicules flotte) : `id, organization_id, vin, immatriculation, marque, modele, energie, statut (actif/archive), notes, created_at, updated_at`
- Table `vehicle_movements` (historique mouvements) : `vehicle_id, mission_id, type (livraison/restitution/transfert), from_address, to_address, occurred_at`
- Table `audit_logs` étendue (déjà `activity_logs`) → ajout colonnes `old_value jsonb`, `new_value jsonb`, `ip`, `user_agent`
- **Index critiques** :
  - `CREATE INDEX ON missions USING gin (vin gin_trgm_ops)` (extension `pg_trgm`)
  - `CREATE INDEX ON missions USING gin (immatriculation gin_trgm_ops)`
  - Idem sur `trajets`, `vehicles`, `demandes_convoyage`
  - Index composés sur `(organization_id, statut, date_prise_en_charge)`
- RLS + GRANT sur toutes les nouvelles tables (`authenticated` + `service_role`, jamais `anon`)
- Trigger `auto_split_aller_retour` : à la création d'un trajet `type_mission='livraison'` avec retour, créer **2 trajets liés** partageant `mission_group_id` (remplace la logique actuelle qui les crée déjà séparés mais sans groupe explicite)

**Aucun changement UI dans ce lot.** Toutes les vues existantes continuent à fonctionner.

---

## Lot 2 — Recherche universelle VIN / plaque

- Server function `searchVehiclesAndMissions({ query, scope, limit, cursor })` avec `requireSupabaseAuth`
  - Scope filtré selon rôle : admin = global, client = ses orgs, convoyeur = ses missions
  - Recherche trigram (LIKE `%query%`) sur VIN + plaque, missions, trajets, vehicles
  - Pagination cursor-based
- Composant `<UniversalSearch />` (cmd+K style) injecté dans :
  - `AdminSidebar` (barre globale)
  - `ProSidebar` / `ConvoyeurSidebar`
- Hook `useUniversalSearch` avec debounce 250ms + React Query

---

## Lot 3 — Aller / Retour comme 2 missions liées

- Refactor `auto_create_trajet_from_devis` : générer `mission_group_id` partagé
- UI client (`ClientMissionDetailView`) : afficher bandeau « Mission Aller » / « Mission Retour » + lien vers la mission jumelle
- UI convoyeur (`convoyeur.missions.tsx`) : filtre `mission_group_id IS NOT NULL` invisible — un convoyeur ne voit que les legs qui lui sont attribués (déjà le cas via RLS, à confirmer)
- Catalogue convoyeur (`convoyeur.disponibles.tsx`) : afficher les 2 legs séparément avec badge « Aller-Retour groupe #XXX »
- Système d'enchères activable par admin : ajout `trajets.bidding_enabled boolean` + toggle dans fiche admin trajet ; quand actif, les offres convoyeur passent par `mission_offres` (déjà existant) au lieu de `accept_mission_fixe`

---

## Lot 4 — Module Gestion de flotte (client pro)

Nouveau espace `/dashboard-pro/flotte` :

- **Sous-onglets** : Véhicules · Sites · Utilisateurs · Mouvements · Statistiques
- CRUD véhicules avec import CSV (VIN, plaque, marque, modèle)
- CRUD sites (`organization_sites` nouvelle table : nom, adresse, contact)
- Gestion membres (existant `organization_members`, on ajoute UI)
- Tableau de bord KPI : véhicules totaux, missions réalisées/en cours/en attente, km parcourus (somme `missions.distance_km`), taux de réussite (livrée / total), délai moyen (`date_livraison - date_prise_en_charge`)
- Composants : `<FleetKPICards />`, `<FleetVehiclesTable />`, `<VehicleMovementsTimeline />`

---

## Lot 5 — Géolocalisation admin + Centre d'exploitation

- Route `/admin/exploitation` : carte Leaflet plein écran
- Réutilise `mission_locations` (déjà alimenté par convoyeur GPS)
- Markers temps réel via Supabase Realtime sur `mission_locations`
- Panneaux latéraux : missions en attente, urgentes, convoyeurs dispo (depuis `disponibilites_convoyeurs`), convoyeurs en mission
- Filtres : région (département depuis CP), statut, convoyeur, client
- Fiche véhicule depuis la carte : position actuelle, historique trajet, vitesse, ETA (calcul Google Maps Distance Matrix existant)

---

## Lot 6 — Audit trail enrichi

- Trigger générique `log_changes()` sur `missions`, `trajets`, `attributions`, `vehicles`, `organization_members`
- Stocke `old_value` / `new_value` JSONB + `actor_user_id` + `ip` (depuis JWT claims)
- UI admin `/admin/historique` (déjà existant) : ajout filtres entité + diff visuel JSON

---

## Lot 7 — Performance & Architecture Enterprise

- Pagination serveur sur toutes les tables admin (>50 lignes) : `admin.missions`, `admin.trajets`, `admin.devis`, `admin.factures`, `admin.utilisateurs`
- Lazy loading photos EDL via `loading="lazy"` + signed URLs à la demande
- React Query : `staleTime: 30s` par défaut, invalidations ciblées
- Index SQL supplémentaires identifiés par `supabase--slow_queries`
- Cache Cloudflare sur routes publiques (`/api/public/*` GET)

---

## Lot 8 — QA & rapport final

- Tests Playwright des parcours critiques : login, création devis, paiement, attribution, mission complète, EDL, recherche universelle, aller-retour
- Vérification permissions par rôle (admin, super_admin, manager, convoyeur, client, sous_traitant, flotte)
- Rapport markdown : tables ajoutées, routes nouvelles, composants nouveaux, migrations, points de vigilance

---

## Estimation

| Lot | Complexité | Risque régression |
|-----|------------|---|
| 1   | Élevée (BDD) | Faible (additif) |
| 2   | Moyenne | Très faible |
| 3   | Élevée | **Moyen** (touche workflow paiement) |
| 4   | Élevée | Faible (nouveau module) |
| 5   | Moyenne | Faible |
| 6   | Faible | Très faible |
| 7   | Moyenne | Faible |
| 8   | Faible | — |

---

## Ma recommandation

**Démarrer par Lot 1 + Lot 2** (socle data + recherche universelle) : ils débloquent tout le reste, sont 100% additifs (zéro risque sur l'existant), et apportent une valeur immédiate visible. Puis enchaîner Lot 3 ou Lot 4 selon ta priorité business.

**Questions avant de lancer le Lot 1 :**

1. **Priorité business** : flotte client (Lot 4) ou centre d'exploitation admin (Lot 5) en premier après le socle ?
2. **Enchères** (Lot 3) : on garde le système actuel `mission_offres` existant et on ajoute juste le toggle admin, ou tu veux une refonte enchère temps réel (timer, surenchère) ?
3. **Import véhicules flotte** (Lot 4) : CSV suffit, ou tu veux aussi une API publique pour les gros clients ?
