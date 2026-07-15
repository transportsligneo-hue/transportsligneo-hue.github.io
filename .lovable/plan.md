
## Objectif

Remplacer le rendu visuel actuel du cockpit convoyeur (blanc/vert, `MissionCockpit.tsx` + `MissionWorkflow.tsx` + `PremiumMissionHero.tsx`) par la copie conforme du mockup `mission-app-ligneo-v3.jsx` : thème sombre bleu nuit + accents cyan/bleu néon, hero avec anneau de progression et "road path" animé, 3 onglets (Action / Informations / Documents), cartes glass, chips d'étapes, timeline verticale, carte véhicule "identité" avec scan-line, carte client avec route mini.

**Contrainte clé** : le CTA de progression **ne doit plus dire "Valider cette étape"** — il doit afficher directement le libellé de l'action à faire (ex. "Arrivé au lieu d'enlèvement", "Commencer l'état des lieux d'enlèvement", "Démarrer le trajet", "Envoyer à l'admin"). Au clic, il exécute exactement la logique métier actuelle de cette étape (ouverture EDL, selfie, signatures, transitions statut).

**Aucune modification** : logique DB, `MissionWorkflow` métier interne, `useMissionGates`, `DriverSelfieCapture`, `IncidentReportSheet`, `ArriveeSignatureSheet`, inspections EDL, MissionContactsBlock, PV digitaux, tracking GPS, réalisation des étapes. Uniquement le rendu.

## Périmètre fichiers

- **Réécriture visuelle** de `src/components/convoyeur/MissionCockpit.tsx` : nouvelle structure JSX (hero + tabs + panes) mais réutilise les mêmes hooks/effects, les mêmes callbacks (`onStartInspection`, `onMacroStatusChange`, `onUpdated`, `runAction`) et le même state actuel (`currentStep`, `selfie modal`, `signature sheet`, `incident sheet`). Les 3 panes appellent les blocs existants (`MissionContactsBlock`, etc.) via composition.
- **Réécriture visuelle** de `src/components/convoyeur/PremiumMissionHero.tsx` → devient le hero sombre du mockup (ProgressRing, RoadPath, live-pill, badges). Mêmes props que celles déjà consommées par `convoyeur.missions.tsx`.
- `src/routes/_authenticated/convoyeur.missions.tsx` : ajuster le fond (dark) autour de la carte mission active + supprimer les fonds clairs qui entourent le cockpit. Pas de refactor logique.
- Ajout d'un fichier CSS scoped `src/components/convoyeur/mission-v3.css` (importé par MissionCockpit) contenant les classes du mockup (`.glass-card`, `.hero`, `.tab-pill`, `.step-advance-btn`, `.chip`, `.vehicle-card`, `.timeline`, `.copy-field`, keyframes `roadFlow`, `shine`, `pulseDot`, `riseIn`…). Fonts Space Grotesk + JetBrains Mono chargées via `<link>` dans `src/routes/__root.tsx` (Inter est déjà présent).
- `MissionWorkflow.tsx` : **inchangé** — reste utilisable ailleurs (fallback / autre écran). Non affiché dans le nouveau cockpit.

## Mapping étapes → CTA (remplace "Valider cette étape")

Le mockup a un `handleAdvance` générique. On garde la liste `STEPS` existante de `MissionCockpit` (déjà correcte), mais le bouton principal affiche **`step.cta`** (déjà le libellé de l'action) et déclenche la même `runAction(step.key)` déjà implémentée :

| Étape                  | Libellé bouton (déjà présent dans STEPS)           | Action existante                         |
| ---------------------- | -------------------------------------------------- | ---------------------------------------- |
| `demarrer`             | En route pour récupérer le véhicule                | persistEtape + status en_cours           |
| `arrive_depart`        | Arrivé au lieu d'enlèvement                        | persistEtape + ouvre selfie              |
| `selfie`               | Prendre mon selfie convoyeur                       | ouvre DriverSelfieCapture                |
| `edl_depart`           | Commencer l'état des lieux d'enlèvement            | onStartInspection("depart")              |
| `demarrer_livraison`   | Démarrer le trajet                                 | persistEtape en_livraison                |
| `arrive_livraison`     | Arrivé au lieu de livraison                        | persistEtape arrive_destination          |
| `edl_arrivee`          | Commencer l'état des lieux d'arrivée               | onStartInspection("arrivee")             |
| `signature_arrivee`    | Signer la livraison                                | ouvre ArriveeSignatureSheet              |
| `selfie_final`         | Prendre le selfie final                            | ouvre DriverSelfieCapture (final)        |
| `cloturer`             | Envoyer à l'admin                                  | onMacroStatusChange en_attente_validation|
| `done`                 | Mission envoyée (bouton disabled, style "done")    | —                                        |

Aucun changement fonctionnel : on remplace uniquement le texte "Valider cette étape" par `step.cta` dans le rendu du bouton principal + un style disabled/done identique au mockup.

## Structure UI (copie conforme mockup)

```text
┌─ TopBar  (crest Ligneo + Bell + Menu)          ─┐   (déjà en dehors, garder l'existant)
├─ Hero    ProgressRing + RoadPath + live-pill    │
├─ TabBar  [Action] [Informations] [Documents]    │
│                                                 │
│ Action pane :                                   │
│   ├─ glass-card "À faire" (checklist énergie)   │  ← branchée sur vehicule.energie
│   ├─ next-card :                                │
│   │    ├─ ProgressBadgeRing + Étape N/total     │
│   │    ├─ next-icon + titre + hint              │
│   │    ├─ step-advance-btn = step.cta           │  ← plus de "Valider cette étape"
│   │    ├─ StepDots                              │
│   │    └─ chip-row (short labels)               │
│   └─ bouton discret "Signaler un incident"      │
│                                                 │
│ Informations pane :                             │
│   ├─ vehicle-card (identité + VIN + copy)       │
│   ├─ client-card (avatar + phone + route mini)  │
│   ├─ quick-grid (Ouvrir GPS / Appels / Aide)    │
│   └─ timeline verticale des étapes              │
│                                                 │
│ Documents pane :                                │
│   ├─ docs-summary (progress bar + doc-list)     │  ← branche sur mission_documents réels
│   └─ ajout document (dropzone + catégories)     │  ← délègue à handler existant
└─────────────────────────────────────────────────┘
```

Sources de données réelles à brancher (pas de fake) :
- `VEHICLE` → `attribution.vehicule` déjà passé en prop.
- `CLIENT` → depuis `MissionContactsBlock` data (nom, tel, adresses pickup/delivery, instructions).
- `STEPS`/progression → `currentEtape` réel.
- `DOCUMENTS` → requête `mission_documents` existante.

## Guardrails

- **Aucune modification** des tables Supabase, RLS, hooks métier, ni `MissionWorkflow.tsx`.
- **Framer-motion interdit** (rappel memory). Toutes animations en CSS/SVG (déjà le cas dans le mockup).
- Le cockpit sombre s'affiche **uniquement dans le contexte mission convoyeur** ; ne pas propager le thème sombre au reste de l'espace convoyeur (le fond parent reste géré par `convoyeur.missions.tsx`).
- Fonts : ajouter `Space Grotesk` et `JetBrains Mono` via `<link>` dans `__root.tsx` (jamais `@import` dans styles.css — rule tanstack).
- Icône du bouton : petit `ArrowUpRight` à droite du libellé (comme mockup), `Check` quand étape terminée.
- Accessibilité : garder `aria-label`, focus visibles, tap targets ≥ 44px.
- Toutes les actions gate-lockées (selfie obligatoire, EDL, etc.) restent respectées : bouton disabled + bandeau `Lock` déjà présent, réutilisé tel quel avec le style sombre du mockup.

## Livrable

Une seule PR d'intégration visuelle. Après implémentation :
- ouvrir une mission convoyeur → doit être **pixel-proche** du mockup v3
- cliquer sur le CTA principal doit exécuter l'action de l'étape courante (pas un "valider" générique)
- EDL, selfie, signatures, incident, envoi admin : comportements strictement identiques à aujourd'hui.
