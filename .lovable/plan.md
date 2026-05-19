# Plan

## Objectif
Corriger le parcours d’état des lieux pour que :
- la photo standard fasse bien avancer vers l’étape suivante sans actualiser,
- le bouton « Photo suivante » soit entièrement visible sur mobile,
- le bouton reste cliquable et cohérent avec l’état réel de l’étape.

## Ce que je vais modifier

### 1. Fiabiliser l’auto-avancement après une photo
- Remplacer la logique actuelle qui dépend d’un `safeIndex` capturé au moment de l’upload.
- Faire avancer l’étape à partir de l’état courant au moment où l’upload réussit, pour éviter les cas où le timer ne change rien.
- Vérifier que le passage à l’étape suivante fonctionne bien après une photo véhicule standard (avant, arrière, côtés, intérieur), sans refresh.

### 2. Rendre le bouton suivant toujours visible sur mobile
- Ajuster la structure verticale de `EdlPremiumFlow` pour réserver correctement la place du footer sticky.
- Corriger les espacements `pb` / `safe-area` pour que le bas du bouton ne soit plus coupé.
- Éviter d’obliger l’utilisateur à scroller juste pour voir le bouton en entier.

### 3. Corriger l’état interactif du bouton « Photo suivante »
- Revoir `canAdvance()` et le rendu du footer pour s’assurer que le bouton reflète immédiatement le succès de la photo.
- Si l’auto-avancement est en attente, garder une UX claire et réactive.
- Éviter les situations où la photo est bien prise mais le bouton reste inactif ou semble ne rien faire.

## Fichiers ciblés
- `src/components/inspection/EdlPremiumFlow.tsx`
- éventuellement `src/styles.css` si un ajustement global des classes EDL est nécessaire

## Résultat attendu
- Après chaque photo EDL standard, l’écran passe à la suivante sans rechargement.
- Le bouton suivant est bien positionné, entièrement visible, et fonctionne sur mobile.
- Le flux EDL redevient fluide sans scroll parasite ni blocage apparent.

## Détails techniques
- Suppression de la dépendance à une valeur d’index figée dans le callback différé.
- Ajustement du layout `fixed inset-0 / flex-col / overflow-y-auto / footer sticky` pour respecter la hauteur viewport mobile et les safe areas.
- Vérification que le champ file remounté continue de bien rouvrir l’appareil photo à chaque étape.