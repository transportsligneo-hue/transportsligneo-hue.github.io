## Objectif
Corriger uniquement le blocage sur l’étape « Selfie convoyeur » sans refaire le design global.

## Constats actuels
- Le backend semble disponible.
- Les règles d’accès permettent bien au convoyeur d’écrire et relire son selfie.
- J’ai confirmé qu’il existe au moins une mission avec un selfie déjà enregistré alors que la mission n’a pas avancé ensuite.
- Le blocage vient donc très probablement du flux frontend de validation/reprise d’état, pas d’un simple manque de permission.

## Problème identifié
Le déverrouillage de la mission dépend d’une relecture immédiate du selfie côté client (`gates.reload()` puis `fetchMissions()`), mais la validation ne met pas explicitement la mission dans un état “selfie terminé / prochaine étape prête”. Résultat possible :
- le selfie est bien sauvegardé,
- mais l’UI reste sur « Selfie convoyeur »,
- surtout sur mobile après retour caméra / reprise de session.

## Plan
### 1. Solidifier la validation du selfie
- Garder la preview actuelle.
- Remplacer la fin du flux par une validation déterministe :
  - upload image,
  - insertion du selfie,
  - confirmation locale immédiate que le selfie est acquis,
  - fermeture du modal seulement après confirmation complète.
- Empêcher le retour automatique vers l’état caméra si le fichier a déjà été capturé.

### 2. Décorréler l’avancement de mission d’une simple relecture fragile
- Ajouter un état optimiste côté mission pour considérer le selfie comme validé dès succès confirmé.
- Faire avancer explicitement le cockpit vers l’étape suivante au lieu de dépendre uniquement du `reload` asynchrone.
- Gérer le cas refresh : si un selfie existe déjà pour la mission, ne jamais rouvrir le bloc selfie.

### 3. Vérifier la persistance d’étape mission
- Contrôler le mapping entre `mission_selfies`, `attributions.etape_courante` et le calcul de l’étape courante dans `MissionCockpit`.
- Corriger le cas où la mission reste visuellement bloquée malgré un selfie existant.
- Si nécessaire, écrire explicitement l’étape suivante au moment du succès du selfie pour rendre le flux idempotent.

### 4. Sécuriser le cas mobile retour caméra
- Supprimer la dépendance aux délais arbitraires autour de la fermeture du modal.
- Stabiliser le flux de reprise (`sessionStorage` / `localStorage`) pour qu’il serve uniquement à reprendre une capture incomplète, jamais à re-bloquer une mission déjà validée.
- Ajouter une gestion d’erreur propre si la sauvegarde est incomplète.

### 5. Validation finale ciblée
- Tester le scénario exact : ouvrir mission, prendre selfie, voir preview, valider, constater passage à l’étape suivante.
- Vérifier qu’après refresh la mission ne revient plus sur selfie si un selfie existe déjà.
- Vérifier qu’un selfie sauvegardé reste visible côté admin via les preuves de mission.

## Fichiers ciblés
- `src/components/mission/DriverSelfieCapture.tsx`
- `src/components/convoyeur/MissionCockpit.tsx`
- `src/routes/_authenticated/convoyeur.missions.tsx`
- éventuellement `src/hooks/useMissionGates.ts` si la relecture doit être rendue plus robuste

## Détail technique
Je vais corriger le bug comme un problème d’état et de transition, pas comme un problème visuel :
- confirmation locale immédiate après succès réel,
- progression explicite vers l’étape suivante,
- reprise fiable après refresh,
- aucun redesign global.