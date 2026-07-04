# Refonte module État des lieux — expérience native premium

Objectif : rendre la capture photo/scan instantanée, ajouter édition + galerie + mode hors-ligne, sans toucher au métier (API, workflows, statuts, PDF, notifications, permissions, calculs restent identiques).

## Principes

- Aucune modification de `src/lib/edl-final-pdf.ts`, des fonctions serveur, des tables Supabase, des statuts, ni des schémas de `inspections` / `inspection_photos` / `inspection_documents`.
- Tous les changements sont côté client (composants, hooks, workers, cache local IndexedDB).
- Fallback complet : si IndexedDB / caméra avancée / worker indisponible → comportement actuel préservé.

## 1. Pipeline capture ultra-fluide (photos EDL)

Cible : `EdlPremiumFlow.tsx`, `InspectionGuidee.tsx`.

- **Retour UI immédiat** : la miniature s'affiche depuis le `File` brut via `URL.createObjectURL` ; l'étape avance sans attendre.
- **Compression en Web Worker** (nouveau `src/lib/workers/image-worker.ts`) avec `OffscreenCanvas` quand dispo, fallback main-thread (queue existante conservée). Correction d'orientation EXIF via `createImageBitmap({ imageOrientation: 'from-image' })`.
- **Upload en tâche de fond** géré par une file persistante (voir §4). Le composant ne bloque jamais sur l'upload.
- **Anti-race** : chaque capture porte un `captureId` (déjà en place dans `EdlPremiumFlow`) — on l'étend à `InspectionGuidee`.
- **Indicateur discret** par vue : petit point "sync" au coin de la miniature (pas de spinner plein écran).

## 2. Galerie éditable inter-étapes

Nouveau composant `src/components/inspection/EdlGallery.tsx` accessible depuis un bouton "Galerie" présent en permanence dans le flow.

- Grille de toutes les vues (photos EDL + documents scannés) avec statut par vignette : `local` / `envoi` / `synchronisé` / `échec`.
- Actions par vignette : voir plein écran (zoom pinch), reprendre, remplacer, supprimer.
- Réutilise le `Dialog` shadcn + lecteur zoom (basé sur `react-zoom-pan-pinch` déjà présent ou implémentation CSS transform si absent — à vérifier au build).
- Aucune modification de l'ordre d'envoi ni du schéma de stockage : `upsert` sur `(inspection_id, vue_type)` inchangé.

## 3. Scanner documents professionnel

Refonte de `src/components/inspection/DocumentScanner.tsx` (déjà partiellement fait) pour atteindre le niveau Adobe Scan :

- **Détection de bords temps réel** : worker dédié (`src/lib/workers/edge-detect-worker.ts`) — downscale 320px, Sobel + Hough simplifié → 4 coins, overlay SVG animé.
- **Auto-capture** quand stabilité + netteté (variance Laplacien) + luminance OK pendant ~800ms. Toggle on/off persisté (`localStorage`).
- **Post-traitement** : perspective correction (homographie 4 points, déjà en place), auto-crop, contraste adaptatif, gamma, unsharp mask, sortie A4 1240×1754 JPEG q=0.92.
- **Écran de revue** : accepter / refaire / recadrer manuellement (poignées sur 4 coins) / pivoter 90°.
- **Torch + fallback natif** `<input capture>` conservés.
- **Hooks OCR-ready** : signature `onScanned(blob, meta)` où `meta = { corners, sharpness, brightness }` — pas d'OCR implémenté, mais structure prête.

## 4. Mode hors-ligne + file de synchro

Nouveau `src/lib/edl-offline-queue.ts` (IndexedDB via `idb-keyval` déjà utilisé ailleurs, sinon `bun add idb`).

- Chaque photo/document compressé est écrit dans IndexedDB **avant** tentative d'upload avec clé `{ inspectionId, vueType, captureId }`.
- File d'upload avec retry exponentiel (1s, 3s, 10s, 30s, 2min), reprise auto sur `online` + `visibilitychange`.
- Purge une fois l'`upsert` Supabase confirmé.
- Au montage du flow : rejoue la file pour l'`attributionId` courant → aucune perte même après fermeture.
- Badge global "N élément(s) en attente de synchronisation" discret dans le header du flow.
- Aucune modification de `sw.js` (juste consommation d'événements `online/offline`).

## 5. Chargements & perf

- Suppression des écrans blancs : squelettes courts + `LogoLoader` déjà présent réutilisé pour toute attente > 400ms.
- `React.lazy` sur `DocumentScanner`, `EdlGallery`, `SignatureCanvas` pour alléger le bundle initial du flow.
- Mémoïsation des vignettes (`memo` + `useMemo` des URLs blob).
- Préchargement de la caméra dès l'ouverture du flow (permission demandée en amont pour éviter la latence au premier scan).
- Nettoyage systématique des `blob:` URLs (déjà partiellement fait, on étend au scanner et à la galerie).

## 6. Compatibilité & garde-fous

- Toutes les nouvelles fonctions détectent `typeof window` / support API et retombent sur l'existant.
- Aucun changement des props d'entrée/sortie des composants exposés (`EdlPremiumFlow`, `InspectionGuidee`, `DocumentScanner`).
- Aucun changement SQL, aucune migration, aucun edge function.
- Tests manuels : 10 photos consécutives, scans CG/PV, coupure réseau au milieu du flow, réouverture app, iOS Safari + Android Chrome.

## Détails techniques

**Nouveaux fichiers**
- `src/lib/workers/image-worker.ts` — compression OffscreenCanvas
- `src/lib/workers/edge-detect-worker.ts` — détection contours temps réel
- `src/lib/edl-offline-queue.ts` — file IndexedDB + retry
- `src/components/inspection/EdlGallery.tsx` — galerie éditable
- `src/hooks/useOnlineStatus.ts` — hook online/offline

**Fichiers modifiés (UI/perf uniquement)**
- `src/components/inspection/EdlPremiumFlow.tsx` — intégration galerie + queue offline + worker
- `src/components/InspectionGuidee.tsx` — captureId + queue offline + indicateur par vignette
- `src/components/inspection/DocumentScanner.tsx` — détection bords worker + auto-capture affinée + recadrage manuel
- `src/lib/image-compression.ts` — route vers worker si dispo, fallback conservé
- `src/styles.css` — mini animations (fade vignette sync, contour scanner)

**Dépendances éventuelles** (`bun add`) : `idb` (petit, ~2ko gzip) si non présent. Rien d'autre.

**Non touché** : `edl-final-pdf.ts`, `edl-document-ocr` edge function, tous les emails, tous les statuts d'`inspections`, `attributions`, RLS, migrations.
