## Objectif
Remettre le workflow convoyeur en cohérence avec le parcours demandé, corriger le blocage selfie en priorité, et faire en sorte que le bouton bleu principal reflète toujours la prochaine action réelle sans faux 100% ni blocage définitif.

## Ce que je vais corriger

### 1. Recalcul complet de l’étape courante dans le cockpit mission
- Refaire la logique de `MissionCockpit.tsx` pour que le premier CTA soit exactement `En route pour récupérer le véhicule`.
- Recaler ensuite les CTA dans cet ordre :
  1. En route pour récupérer le véhicule
  2. Arrivé au lieu d’enlèvement
  3. Selfie convoyeur enlèvement
  4. Commencer l’état des lieux d’enlèvement
  5. Démarrer le trajet
  6. Arrivé au lieu de livraison
  7. Commencer l’état des lieux d’arrivée
  8. Selfie convoyeur final
  9. Envoyer à l’admin
- Empêcher tout bypass des étapes obligatoires : selfie, EDL départ, signatures départ, EDL arrivée, signatures arrivée, selfie final.
- Garder `Signaler un incident` disponible à tout moment sans casser l’avancement.

### 2. Corriger le composant selfie avec un vrai flow caméra
- Remplacer le fonctionnement actuel basé uniquement sur `input capture` par un vrai composant de capture robuste dans `DriverSelfieCapture.tsx` :
  - demande de permission caméra explicite
  - message clair si permission refusée
  - aperçu caméra temps réel via `getUserMedia`
  - capture réelle vers canvas/blob/file
  - aperçu de la photo capturée
  - actions `Reprendre`, `Valider`, `Réessayer`
- Conserver un fallback fichier si la caméra n’est pas disponible sur l’appareil.
- Ajouter une machine d’état claire : `idle`, `requesting_permission`, `camera_ready`, `captured`, `uploading`, `success`, `error`, `timeout`, `pending_upload`.

### 3. Supprimer le blocage selfie infini
- Encadrer l’upload selfie avec un timeout explicite.
- Si l’upload échoue ou dépasse le timeout :
  - sortir immédiatement du loader
  - afficher exactement `Erreur lors de l’envoi du selfie. Réessayez.`
  - proposer `Réessayer`
- Sauvegarder temporairement le selfie en local pour reprise si réseau faible.
- Réhydrater cet état au retour sur la mission pour reprendre l’envoi sans refaire la photo.
- Désactiver les doubles clics pendant capture/validation/upload.

### 4. Recaler l’avancement et la barre de progression sur l’état réel
- Corriger le calcul du pourcentage dans `MissionCockpit.tsx` et la timeline de `convoyeur.missions.tsx` pour qu’aucune étape incomplète n’affiche 100%.
- Baser la progression sur les jalons réellement validés, pas seulement sur l’index visuel courant.
- Faire revenir automatiquement à la page mission après chaque succès : selfie, inspection, signatures, envoi final.

### 5. Réorganiser l’EDL pour coller au workflow demandé
- Adapter `EdlPremiumFlow.tsx` et `edl-premium-sequence.ts` pour séparer proprement :
  - EDL enlèvement = photos + scans + signatures enlèvement
  - EDL arrivée = photos + signatures arrivée uniquement
- Inverser l’ordre des signatures si nécessaire pour respecter la demande : client puis convoyeur.
- Retirer de l’EDL arrivée l’envoi automatique en validation admin actuellement présent.
- Déplacer le selfie final hors de l’EDL pour qu’il s’ouvre automatiquement après signatures arrivée, puis retour mission, puis CTA `Envoyer à l’admin`.

### 6. Stabiliser les uploads photo EDL
- Garder le flux `Blob/File` et la compression client, déjà présents, mais fiabiliser les transitions d’état.
- Ajouter timeout/retry cohérents aux uploads photo comme au selfie.
- Conserver la reprise locale des étapes déjà faites sans regonfler la mémoire.
- Continuer à libérer les `blob:` inutiles pour éviter les erreurs mémoire sur mobile.
- Vérifier qu’aucune promesse en cours ne laisse l’UI coincée en `uploading`.

### 7. Corriger l’envoi final admin
- Faire du CTA final `Envoyer à l’admin` la seule étape qui fait passer la mission en validation admin.
- Vérifier avant l’envoi final que tout le dossier requis est présent : selfies, EDL, signatures, GPS, incidents éventuels.
- Si une pièce manque, afficher une erreur claire et renvoyer vers l’étape manquante au lieu de bloquer silencieusement.

### 8. Vérification navigateur après implémentation
- Tester le flow complet dans le navigateur :
  - En route pour récupérer le véhicule
  - Arrivé au lieu d’enlèvement
  - ouverture auto du selfie
  - capture + upload + retour mission
  - ouverture EDL enlèvement
  - signatures enlèvement
  - démarrer le trajet
  - arrivé livraison
  - EDL arrivée
  - signatures arrivée
  - selfie final auto
  - envoi admin final
- Vérifier aussi les cas erreur : permission refusée, upload selfie en échec, retry, reprise locale, absence de refresh manuel.

## Fichiers ciblés
- `src/components/convoyeur/MissionCockpit.tsx`
- `src/components/mission/DriverSelfieCapture.tsx`
- `src/components/inspection/EdlPremiumFlow.tsx`
- `src/components/inspection/edl-premium-sequence.ts`
- `src/routes/_authenticated/convoyeur.missions.tsx`
- possiblement `src/hooks/useMissionGates.ts` si un état selfie final distinct doit être exposé proprement

## Détails techniques
- Le blocage principal vient du fait que le selfie actuel ne gère pas un vrai cycle caméra/permission/timeout/retry et repose sur `input capture`, qui peut ne rien renvoyer ou ne pas reprendre correctement sur mobile.
- Le workflow actuel mélange encore des responsabilités : l’EDL arrivée pousse déjà la mission vers la validation admin, ce qui contredit le besoin de selfie final puis envoi admin explicite.
- La progression actuelle peut atteindre artificiellement 100% avant la fin car elle est dérivée de l’étape visuelle active au lieu d’un ensemble d’étapes réellement complétées.
- Je resterai sur une correction ciblée, sans refaire l’application ni casser le design existant.