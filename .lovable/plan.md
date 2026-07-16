
# Refonte Catalogue des Missions (espace convoyeur)

Objectif : transformer le catalogue en place de marché pro type Uber Driver / Bolt / Amazon Flex, tout en gardant l'identité Ligneo (bleu nuit + doré, glassmorphism). Zéro régression sur les workflows / API / RPC existants.

## 1. Suppression de l'ancienne page "Disponibles"

- Supprimer `src/routes/_authenticated/convoyeur.disponibles.tsx`.
- Ajouter `src/routes/_authenticated/convoyeur.disponibles.tsx` en simple **redirect** vers `/convoyeur/catalogue` (loader `throw redirect`), pour ne casser aucun lien externe / notification / email existant.
- Mettre à jour la sidebar (`convoyeur.tsx`) → l'onglet "Catalogue missions" pointe désormais sur `/convoyeur/catalogue`.
- Grep global des liens vers `/convoyeur/disponibles` (notifications, emails, redirections auth) et les faire pointer vers `/convoyeur/catalogue`.

## 2. Refonte visuelle du Catalogue (`convoyeur.catalogue.tsx`)

Design : reprend la palette navy premium déjà en place sur l'espace convoyeur (fond `radial-gradient` navy + halos, cartes en verre fumé, accents dorés Ligneo, boutons `.btn-onyx` / bleu neon). Cartes glassmorphism, animations CSS uniquement (pas de framer-motion).

### 2.1 En-tête & barre de filtres sticky
- Titre + statut temps réel (déjà présent).
- Nouveau **bouton géoloc** ("Autour de moi") avec icône `Navigation` : demande `navigator.geolocation`, mémorise la position en state + `sessionStorage`, active un tri "proximité".
- Sélecteur de **rayon** : 10 / 25 / 50 / 100 / 150 / 200 / 500 km / France entière.
- Filtres additionnels :
  - Recherche texte (ville, marque, modèle) — existant.
  - Ville / Département / Région (autocomplete simple sur le texte du champ, on parse ville/CP côté client).
  - Date (jour précis ou plage).
  - Type mission : Aller simple / Aller-retour / Tous.
  - Urgentes uniquement (switch).
  - Véhicule électrique (switch, filtre sur `type_carburant`/`marque` si dispo dans la vue publique — sinon filtre par mots-clés).
  - Distance max, prix min (existants).
  - Tri : proximité (si geoloc), plus récentes, prix ↓, distance ↑.
- Filtres appliqués instantanément (useMemo), aucun reload.

### 2.2 Cartes premium
Chaque carte affiche sans clic :
- Villes départ → arrivée (nœuds route stylés).
- Distance (km) + durée estimée (min → h/min).
- Prix net convoyeur (grand chiffre doré).
- Badge type mission : "Aller simple" / "Aller-retour" (leg_type).
- Date + heure.
- Véhicule (marque + modèle + électrique si applicable).
- Niveau requis (Débutant / Confirmé / Expert) — dérivé de `distance_km` + urgence par défaut si le champ n'existe pas côté BDD (règle métier locale : <200 km = Débutant, 200-600 = Confirmé, >600 ou urgent = Expert).
- Badge Urgent si `urgence in ('urgent','immediat')`.
- Badge Nouvelle (< 24h) — existant.
- **Compte à rebours** avant expiration (`proposal_expires_at`) mis à jour toutes les 30 s.
- Si distance depuis moi connue : chip "à X km de vous".
- Statut de mon offre si déjà candidaté (`MissionStatusBadge`).
- Bouton "Voir la mission" ouvre la fiche détaillée (drawer/sheet). Bouton rapide "Postuler" reste accessible.

Cartes : glass navy + bordure dorée légère au hover, animation `translateY(-2px)` + halo, `transition-all`, aucun framer-motion.

### 2.3 Fiche détaillée (drawer plein écran mobile, side-sheet desktop)
- Ouvre sans quitter le catalogue (état local `openId`), fermeture par clic backdrop / bouton / touche Escape.
- Sections :
  - Header : villes, badges (urgent, AR, niveau), prix, expiration.
  - Trajet : distance, durée, adresses complètes départ/arrivée (si dispo dans la vue publique — sinon villes uniquement, aucune fuite d'infos privées).
  - Véhicule : marque, modèle, kilométrage estimé, type carburant, photos (si publiées).
  - Remarques du client (champ public `remarques_publiques` si dispo, sinon on cache la section — pas de leak).
  - Informations utiles / documents nécessaires (contenu statique métier : permis B en cours de validité, pièce d'identité, attestation assurance, tel chargé — bloc réutilisable).
  - **Trajet conseillé** : bouton "Ouvrir dans Google Maps" (URL `https://www.google.com/maps/dir/?api=1&origin=...&destination=...`).
  - **Aide au retour** (uniquement si `leg_type === 'simple'`) : trois CTA modernes pré-remplis avec **arrivée → départ** :
    - 🚆 **SNCF Connect** : `https://www.sncf-connect.com/app/home/search?origin={arrivee}&destination={depart}`
    - 🚌 **Moovit** : `https://moovitapp.com/tripplan/?from={arrivee}&to={depart}`
    - 🌍 **Rome2Rio** : `https://www.rome2rio.com/map/{arrivee}/{depart}`
  - Actions : Accepter (au tarif) / Faire une offre (si `allow_counter_offer` ou pricing enchère) / Fermer.
  - Réutilise les RPC existantes (`driver_apply_to_mission` / `accept_mission_fixe`) — **aucune modification de logique métier**.

### 2.4 Géolocalisation
- Composant `GeolocationButton` : demande la position, stocke `{lat,lng}` en state + `sessionStorage("convoyeur_geo")`.
- Distance carte ↔ position : Haversine côté client à partir de coordonnées trajet si présentes dans la vue publique (`depart_lat/lng`) ; sinon on cache le chip "à X km" et le filtre rayon (fallback gracieux, aucun crash).
- Tri "proximité" activé automatiquement dès que la position est dispo.

## 3. Compatibilité & sécurité

- Aucune migration Supabase, aucune modification de RPC / RLS / vues.
- Uniquement lecture de `trajets_publies_safe` (déjà utilisée).
- Les nouveaux champs (coords, kilométrage, carburant, remarques publiques) sont lus de façon **optionnelle** : si absents, l'UI dégrade proprement.
- Aucun changement dans `mission_offres`, `attributions`, `driver_apply_to_mission`, `accept_mission_fixe`.
- La redirect `/convoyeur/disponibles` → `/convoyeur/catalogue` préserve tous les liens historiques (emails, notifs, favoris).

## 4. Livrables (fichiers)

Créés :
- `src/components/convoyeur/CatalogueFilters.tsx`
- `src/components/convoyeur/CatalogueMissionCard.tsx`
- `src/components/convoyeur/MissionDetailSheet.tsx`
- `src/components/convoyeur/ReturnTripHelper.tsx`
- `src/lib/geo/haversine.ts`
- `src/lib/geo/useGeolocation.ts`
- `src/lib/mission-level.ts` (règle Débutant/Confirmé/Expert)

Modifiés :
- `src/routes/_authenticated/convoyeur.catalogue.tsx` (refonte complète UI, mêmes données/RPC)
- `src/routes/_authenticated/convoyeur.tsx` (lien sidebar → `/convoyeur/catalogue`)
- `src/routes/_authenticated/convoyeur.disponibles.tsx` (remplacé par simple `redirect` loader)

## 5. Hors périmètre

- Aucun changement backend, aucune migration.
- Aucun changement au formulaire client de demande.
- Aucun changement au processus d'attribution / validation admin.
