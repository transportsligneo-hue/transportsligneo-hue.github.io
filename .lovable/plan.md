## Objectif
Corriger uniquement le bug global du parcours photo existant dans les inspections / états des lieux : après une photo, l’étape courante doit être marquée complétée immédiatement et le bouton « Photo suivante » doit devenir actif sans refresh navigateur, tout en laissant l’utilisateur cliquer lui-même pour avancer.

## Ce que je vais modifier
1. Identifier et corriger la logique commune utilisée par toutes les étapes photo dans `src/components/inspection/EdlPremiumFlow.tsx`.
2. Fiabiliser le flux post-upload pour que, dès que l’upload + l’enregistrement backend réussissent, l’état local de l’étape courante soit mis à jour de façon immuable avec une nouvelle référence React.
3. Recalculer immédiatement la condition qui pilote le bouton « Photo suivante » (`canAdvance` / `currentState.status`) à partir de cet état local mis à jour, sans attendre un rechargement global de l’inspection.
4. Empêcher qu’une logique commune de réhydratation / réconciliation / reprise locale n’écrase l’état fraîchement mis à jour après upload.
5. Conserver strictement le comportement manuel : aucun passage automatique à l’étape suivante.

## Contraintes respectées
- Aucun rebuild du parcours.
- Aucun changement de noms d’étapes.
- Aucun changement de design global.
- Aucun changement PDF / signatures.
- Pas de modification de base de données sauf nécessité absolue.
- La première étape à cocher reste intacte.

## Détails techniques
- **Fichier ciblé** : `src/components/inspection/EdlPremiumFlow.tsx`
- **Zones à sécuriser** :
  - `processPhotoFile(...)`
  - `canAdvance()`
  - la mise à jour de `states`
  - la réhydratation distante / reprise locale
  - la logique de réconciliation des étapes photo
  - le reset de l’input fichier
- **But concret** : faire en sorte que toutes les étapes `photo` / `scan` lisent la même source de vérité réactive juste après un upload réussi, au lieu d’attendre des données du premier rendu ou une relance de page.

## Validation prévue
1. Ouvrir une inspection.
2. Vérifier que la première étape à cocher fonctionne toujours.
3. Aller à la première étape photo.
4. Prendre une photo.
5. Vérifier que « Photo suivante » s’active sans refresh.
6. Cliquer manuellement sur « Photo suivante ».
7. Refaire le test sur plusieurs étapes photo à la suite.
8. Vérifier qu’aucune actualisation navigateur n’est nécessaire.
9. Vérifier qu’il n’y a jamais d’auto-avance après prise de photo.