
# Lots 3 + 4 + 5 — Plan de livraison

Le socle (Lot 1 + Lot 2) est en place : `mission_group_id`, `leg_type`, `leg_index`, tables `vehicles`, `vehicle_movements`, `organization_sites`, recherche universelle VIN/plaque. On enchaîne les 3 lots métier dans cet ordre logique (Aller/Retour → Flotte → Exploitation).

> Volume important : ~15-20 fichiers / lot. Je livre **lot par lot**, chaque lot testable seul. Tu valides puis on passe au suivant.

---

## Lot 3 — Aller / Retour comme 2 missions liées

### Base de données (migration)
- Ajout `trajets.bidding_enabled boolean default false`
- Vérification trigger `auto_create_trajet_from_devis` : génère bien `mission_group_id` partagé entre Aller et Retour (Lot 1 a posé les colonnes, on branche le trigger)
- Ajout colonnes `mission_offres.is_winning boolean`, `mission_offres.bid_round int` (système enchères léger)

### UI Convoyeur
- `convoyeur.disponibles.tsx` : badge « Aller-Retour #XXX » sur les legs groupés + lien vers le leg jumeau
- `MissionCard` : affichage `leg_type` (icône A/R) sur les missions attribuées
- `convoyeur.missions.tsx` : section « Mission jumelle » dans le détail si `mission_group_id` non null
- Si `bidding_enabled = true` : remplacer bouton « Accepter au prix fixe » par formulaire offre prix (passe par `mission_offres` existant)

### UI Admin
- Fiche admin trajet : toggle « Activer les enchères »
- Liste admin trajets : badge groupe A/R + filtre `mission_group_id`

### UI Client
- `dashboard-client.missions.$missionId` + `dashboard-pro.missions.$missionId` : bandeau lien vers mission jumelle

**Risque** : Moyen (touche workflow paiement). Aucune mission existante ne sera cassée — `leg_type='simple'` reste le comportement par défaut.

---

## Lot 4 — Module Gestion de flotte (client pro)

### Nouvelle route : `/dashboard-pro/flotte`
Sous-onglets via routes imbriquées :
- `dashboard-pro.flotte.index.tsx` — Dashboard KPI
- `dashboard-pro.flotte.vehicules.tsx` — CRUD `vehicles` + import CSV
- `dashboard-pro.flotte.sites.tsx` — CRUD `organization_sites`
- `dashboard-pro.flotte.membres.tsx` — UI sur `organization_members` (déjà existant)
- `dashboard-pro.flotte.mouvements.tsx` — Timeline sur `vehicle_movements`

### Composants
- `<FleetKPICards />` : véhicules totaux, missions (réalisées/en cours/en attente), km totaux (`SUM(missions.distance_km)`), taux réussite, délai moyen
- `<FleetVehiclesTable />` : table paginée VIN/plaque/marque/modèle/statut + recherche
- `<VehicleCSVImport />` : parse CSV client-side (Papa Parse déjà dispo ? sinon `bun add papaparse`), preview, validation, insert batch via server fn
- `<VehicleMovementsTimeline />` : groupé par véhicule, livraison/restitution/transfert

### Server functions
- `src/lib/fleet.functions.ts` : `listFleetVehicles`, `upsertVehicle`, `deleteVehicle`, `importVehiclesCSV`, `listFleetSites`, `upsertSite`, `getFleetKPI` — toutes scopées RLS par `organization_id`

### Sidebar
- Ajout entrée « Flotte » dans `ProSidebar`

**Risque** : Faible (nouveau module additif).

---

## Lot 5 — Géolocalisation admin + Centre d'exploitation

### Nouvelle route : `/admin/exploitation`
- Carte Leaflet plein écran (`react-leaflet` déjà utilisé pour `GpsMapView`)
- Markers temps réel sur `mission_locations` via Supabase Realtime
- 3 panneaux latéraux pliables :
  - Missions en attente (`statut='en_attente_attribution'`)
  - Missions en cours (avec position GPS dernière)
  - Convoyeurs dispo (`disponibilites_convoyeurs` actives aujourd'hui)
- Filtres : département (extrait du CP), statut, convoyeur, client
- Click marker → drawer fiche mission (position, vitesse calculée, ETA via dernier point GPS)

### Migration Realtime
- `ALTER PUBLICATION supabase_realtime ADD TABLE mission_locations;` (si pas déjà fait)

### Sidebar
- Ajout entrée « Centre d'exploitation » dans `AdminSidebar` groupe « Opérations »

**Risque** : Faible (lecture seule, additif).

---

## Ordre & livraison

1. **Lot 3** (migration + UI A/R) — je commence par ça
2. **Lot 4** (module flotte) — après ta validation du Lot 3
3. **Lot 5** (centre d'exploitation) — après validation du Lot 4

Chaque lot = 1 batch de modifications, build vérifié, puis je te livre un récap court avec les fichiers touchés.

**Je lance le Lot 3 dès ta validation de ce plan.**
