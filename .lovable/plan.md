
# Refonte module GPS — style Uber/Bolt

## Périmètre strict

- Uniquement **visuel + UX** du suivi GPS.
- **Aucune modification** : tables Supabase, hooks `useMissionRealtime` / `useGpsTracking`, `mission_locations`, statuts métier, workflow convoyeur, calculs ETA (`computeEta`), géocodage.
- Conservation totale du flux temps réel actuel (Realtime Supabase).
- Affecté : Dashboard Admin (détail mission) + Dashboard Client (Particulier + Pro + Flotte, vue `ClientMissionDetailView`).
- **Non affecté** : app convoyeur, espace public, autres pages.

## Fichiers touchés

| Fichier | Action |
|---|---|
| `src/components/GpsMapView.tsx` | Refonte visuelle (tuiles claires premium, marqueurs modernes, voiture animée, polyline dégradée bleu/violet) |
| `src/components/mission/MissionLiveTracker.tsx` | Refonte layout : grande carte immersive + carte flottante glassmorphism ETA |
| `src/components/mission/ClientMissionDetailView.tsx` | Réorganisation : carte plein écran en tête + panneau infos client (chauffeur, véhicule, contact) + coordonnées d'arrivée visibles |
| `src/components/mission/UberStyleTrackingCard.tsx` | **Nouveau** — carte flottante glass (statut, ETA, distance, chauffeur, véhicule, bouton contact) |
| `src/components/mission/AnimatedVehicleMarker.tsx` | **Nouveau** — logique d'interpolation + rotation du marqueur voiture |
| `src/components/mission/MissionEventTimeline.tsx` | **Nouveau** — timeline événements/notifications côté Admin |
| `src/routes/_authenticated/admin.missions.$missionId.tsx` | Intégration nouvelle disposition (carte XL gauche + timeline droite) |
| `src/styles.css` | Tokens GPS premium (`--gps-route-start`, `--gps-route-end`, `--gps-glass-bg`, gradient bleu→violet, shadows) |

## Détails techniques

### Carte (GpsMapView)
- Tuiles : passage à **CartoDB Positron** (style clair épuré, type Uber) — gratuit, OSM-compatible, pas de clé.
- Polyline : remplacement du gold actuel par dégradé bleu `#2563eb` → violet `#7c3aed`, épaisseur 5, opacité 0.9, halo blanc derrière (effet « stroke ») pour lisibilité.
- Tracé projeté (position → destination) : pointillé violet `#a78bfa`.
- Marqueurs : départ vert pulsant, arrivée pin rouge moderne (SVG), voiture = SVG top-down dans `divIcon` qui tourne via `transform: rotate(bearing)`.
- Recentrage : auto-fit aux bounds avec padding ; bouton flottant « recenter » (icône `Navigation`).
- Zoom : auto selon distance restante (proche → zoom 15, loin → zoom 11).

### Voiture animée (AnimatedVehicleMarker)
- Interpolation linéaire entre dernière position connue et nouveau point GPS sur 1.2s via `requestAnimationFrame`.
- Bearing calculé à partir des 2 derniers points (atan2) → rotation appliquée à l'icône.
- Aucun changement aux données : on consomme `mission_locations` comme aujourd'hui.

### Carte flottante (UberStyleTrackingCard)
- Position : `absolute bottom-4 left-4 right-4` sur mobile, `bottom-6 left-6 max-w-md` desktop.
- Style : `backdrop-blur-xl bg-white/85 border border-white/60 rounded-3xl shadow-2xl` ; dark mode (espace Particulier) : `bg-slate-900/80 text-white`.
- Contenu : pastille statut animée, **ETA en gros (display font)**, distance restante, séparateur, ligne chauffeur (avatar + nom + véhicule + plaque), bouton « Contacter » (tel: + sms:).
- Apparition : `animate-in slide-in-from-bottom-4 fade-in duration-500`.

### Dashboard Client — coordonnées d'arrivée
- Ajout d'un bloc « Coordonnées d'arrivée » dans `ClientMissionDetailView` affichant nom contact arrivée + téléphone arrivée (champs déjà présents dans `demandes_convoyage`/`trajets` : `contact_arrivee_nom`, `contact_arrivee_telephone`). Lecture seule, pas de migration.

### Dashboard Admin — colonne droite
- Layout `lg:grid-cols-[1fr_360px]` : carte XL à gauche, panneau droite avec :
  - `MissionEventTimeline` (réutilise `mission_etape_history` déjà chargée).
  - Dernière position GPS (lat/lng + horodatage + précision).
  - Liste notifications liées (filtre `admin_notifications` par `mission_id` — lecture seule, aucune écriture).

### Animations & micro-interactions
- Pulsation marqueur position actuelle (CSS keyframes, déjà en place — conservée).
- Apparition progressive panneaux : `animate-in fade-in slide-in-from-right` via tailwindcss-animate (déjà installé).
- Hover boutons : `hover:scale-[1.02] transition`.
- **Aucune** dépendance framer-motion (interdit par mémoire projet).

### Palette
- Tokens ajoutés à `src/styles.css` :
  - `--gps-primary: #2563eb` (bleu profond)
  - `--gps-secondary: #7c3aed` (violet premium)
  - `--gps-start: #10b981` (vert départ)
  - `--gps-end: #ef4444` (rouge arrivée)
  - `--gps-glass: rgba(255,255,255,0.85)`
  - `--gps-glass-dark: rgba(15,23,42,0.8)`
  - Gradient `--gps-route: linear-gradient(90deg, var(--gps-primary), var(--gps-secondary))`

## Non-objectifs

- Pas de nouvelle dépendance (Mapbox, Google Maps JS, framer-motion).
- Pas de migration SQL.
- Pas de changement aux edge functions ni au tracking convoyeur.
- L'identité navy/doré globale est préservée ; le bleu/violet reste **circonscrit au module GPS** comme charte « métier opérationnel » (cohérent avec la mémoire « bleu électrique modules métier »).
