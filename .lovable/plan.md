## Problèmes constatés

**1. Blocage à ~86% après "Arrivé au lieu de livraison"**
Dans `src/components/convoyeur/MissionCockpit.tsx` (`handleAdvance`, case `arrive_livraison`), après avoir validé l'arrivée, l'étape passe à `arrive_destination` mais le CTA suivant attend un nouveau clic pour lancer `onStartInspection("arrivee")`. Côté `convoyeur.missions.tsx`, la timeline reste donc bloquée à l'étape 4/6 (validation admin = 6, donc ~83-86% de la barre) et l'overlay `EdlPremiumFlow` ne s'ouvre jamais tout seul.

Le même schéma existe pour le départ : après `arrive_depart` (passage à `sur_place`), l'inspection départ ne s'ouvre pas automatiquement non plus, ce qui est incohérent et créera le même blocage.

**2. Inspection contournable**
Aujourd'hui la clôture passe par `cloturer` (`en_attente_validation`) dès que `inspectionArriveeDone` est vrai. Mais le selfie n'est verrouillé que jusqu'à `vehicule_recupere` (`currentKey` ligne 147). Entre `en_livraison` et `arrive_destination`, si pour une raison X le selfie n'a pas été pris (override retiré, race condition), il n'y a plus de garde. Idem si `inspectionDepart` est manquant après `edl_depart_fait`.

**3. Saturation mémoire pendant la séquence photos**
`EdlPremiumFlow.handlePhotoFile` crée `URL.createObjectURL(stableFile)` puis stocke ce `blob:` dans `states[stepId].previewUrl` et l'y laisse jusqu'à la fin du flow. Sur 20+ photos compressées (3-8 Mo chacune avant compression), les blobs restent référencés → OOM sur mobile. Idem `handleExtraPhotoFile` et `handleSelfieFile`. Les `File`/`ArrayBuffer` intermédiaires (`materializeCapturedFile` lit `arrayBuffer()` puis recrée un `File`) sont aussi conservés tant que le blob l'est.

---

## Correctifs

### A. Auto-ouverture de l'inspection (departure + arrival)

Fichier : `src/components/convoyeur/MissionCockpit.tsx`

1. Dans `handleAdvance`, après `case "arrive_livraison"` : enchaîner immédiatement `onStartInspection("arrivee")` une fois `persistEtape("arrive_destination")` résolu (et seulement si `!inspectionArriveeDone`).
2. Faire le même chaînage dans `case "arrive_depart"` → `onStartInspection("depart")` si `!inspectionDepartDone`.
3. Ajouter un `useEffect` qui ouvre automatiquement l'inspection si on arrive sur `arrive_destination` / `sur_place` sans inspection faite (cas du rafraîchissement page après validation). Garder un ref `autoOpenedRef` par phase pour éviter la boucle.

### B. Verrou anti-bypass jusqu'à la validation admin

Fichier : `src/components/convoyeur/MissionCockpit.tsx`

1. Étendre la liste des étapes qui exigent `selfieOK` à TOUTES les étapes terrain jusqu'à `en_attente_validation` (ajouter `en_route`, `en_livraison`, `arrive_destination`, `edl_depart_fait`, `edl_arrivee_fait`).
2. Bloquer `cloturer` tant que `inspectionArriveeDone && inspectionDepartDone && selfieOK` ne sont pas tous vrais. Si manquant, forcer le retour vers `edl_arrivee` (ou afficher un toast clair). Pas de bypass possible côté driver (les overrides admin via `useMissionGates` restent la seule porte de sortie).
3. Dans `EdlPremiumFlow.finalizeInspection` (phase `arrivee`), refuser de marquer `en_attente_validation` si une étape obligatoire (selfie, signatures, photos non bypassées) est `status !== "success"`. Aujourd'hui le `goNext` final accepte tout si `currentStep.kind === "validation"`.

### C. Libération mémoire après upload

Fichier : `src/components/inspection/EdlPremiumFlow.tsx`

1. Dans `handlePhotoFile` / `handleExtraPhotoFile` / `handleSelfieFile`, après `setState(... status: "success" ...)`, ré-évaluer une URL d'aperçu basse résolution :
   - Pour les photos déjà uploadées : remplacer le blob par un thumbnail data URL (canvas downscale ~256px JPEG q=0.5) ou simplement par `undefined` (l'aperçu n'est utile que pour la photo en cours) ; révoquer le `blob:` original via `revokeBlobUrl`.
   - Conserver le blob uniquement pour l'étape courante tant qu'on ne navigue pas.
2. Ajouter un `useEffect` qui, quand `safeIndex` change, parcourt toutes les autres entrées `states` et révoque les `blob:` non actifs.
3. Au démontage (`return cleanup`), révoquer toutes les `previewUrl` blob restantes.
4. Dans `prepareCapturedImage`, ne plus matérialiser via `arrayBuffer()` si l'input est déjà un `File` stable avec `size > 0` et un type image — évite la copie binaire complète en mémoire (gain x2 sur chaque prise).
5. Après `compressImage`, ne pas garder de référence locale au-delà du `await uploadWithRetry` (déjà le cas, mais s'assurer que `stableFile` sort du scope — pas de capture dans un closure long).

### D. Vérification end-to-end via Browser Tool

Après implémentation, scénario joué dans le sandbox :
1. Login convoyeur fixture (si comptes de test dispos) — sinon dérouler depuis l'état courant.
2. Avancer mission jusqu'à `arrive_destination` → confirmer ouverture auto de l'overlay `EdlPremiumFlow` avec barre bleue.
3. Tenter de skipper le selfie / une photo obligatoire → CTA "Terminer" doit rester bloqué.
4. Compléter toutes les étapes → vérifier passage à `en_attente_validation` sans refresh manuel et libération mémoire (via `performance.memory` si dispo dans le console).

---

## Détails techniques

Tables touchées : aucune. Pas de migration.

Hooks/composants modifiés :
- `src/components/convoyeur/MissionCockpit.tsx` — chaînage auto-ouverture, garde-fous selfie + EDL.
- `src/components/inspection/EdlPremiumFlow.tsx` — révocation blobs, downsample thumbnail, garde finalize.
- (Optionnel) `src/components/convoyeur/MissionWorkflow.tsx` — appliquer le même chaînage dans `advance()` pour rester cohérent si ce composant est encore monté ailleurs.

Risque de régression : la reprise via `localStorage` continue de fonctionner (les paths storage restent persistés). L'aperçu après reprise sera ré-hydraté via `createSignedUrl` (déjà en place ligne 306-320).
