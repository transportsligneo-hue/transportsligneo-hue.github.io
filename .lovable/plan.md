## Objectif

Corriger 3 problèmes de l'écran « État des lieux » côté convoyeur (mobile) dans `src/components/inspection/EdlPremiumFlow.tsx` :

1. Le bouton **« Photo suivante »** (footer sticky) est coupé sous la barre Chrome Android — il faut le voir sans scroller.
2. Après une prise photo, la page **avance toute seule** (auto-advance 600 ms). Le convoyeur doit pouvoir relire son cadrage et **appuyer lui-même** sur « Photo suivante ».
3. Pendant l'upload (`status: "uploading"`), afficher un **loader premium avec le logo Ligneo** plutôt qu'un simple spinner sur la photo.

Aucune autre route, ni le flow Selfie / Signature / Validation n'est touché en logique.

---

## Changements détaillés

### 1. Bouton footer toujours visible (mobile-first)

Dans `EdlPremiumFlow.tsx`, le shell est déjà `flex flex-col h-100dvh` avec footer `shrink-0`, mais le contenu de l'étape est trop haut sur petits écrans → le footer passe sous l'URL bar / la barre gestes Android.

- Réduire la hauteur de la zone visuelle sur mobile :
  - **PhotoOrScanArea** : passer l'image exemple de `aspect-[3/2]` à `aspect-[4/3] sm:aspect-[3/2]` et limiter sa hauteur (`max-h-[38dvh] sm:max-h-none object-cover`).
  - Bouton CTA inline « Prendre la photo » : `h-14` au lieu de `h-16` sur mobile.
  - Card titre étape (`edl-glass p-5`) : `p-4` sur mobile, masquer les chips secondaires non essentielles (`Bypass admin`, OCR détaillé) sur très petits écrans en gardant uniquement l'état clé.
- Footer : forcer `position: sticky; bottom: 0` en plus du flex pour fallback iOS Safari, et augmenter le contraste du bouton désactivé (rester cliquable visible mais grisé).
- Le `<main>` reste scrollable (`overflow-y-auto`) — c'est l'exemple+CTA qui rétrécit, pas le footer.

### 2. Suppression de l'auto-advance après prise photo

Dans `handlePhotoFile` (lignes ~540-551), retirer le bloc :
```
if (currentStep.kind === "photo") {
  setTimeout(() => setStepIndex(...), 600);
}
```
La photo est uploadée en arrière-plan, l'aperçu reste affiché, le footer « Photo suivante » devient actif (`canAdvance() === true` car `status === "success"`), et c'est le convoyeur qui appuie pour passer à l'étape suivante. Identique pour les scans (déjà manuel).

### 3. Loader premium avec logo Ligneo

Créer un petit composant local `BrandLoader` (dans le même fichier, sous les sub-components) :
- Cercle pulsant doré + cyan autour du logo `logoLigneo`.
- Anneau conique en rotation CSS pure (pas de framer-motion — interdit par la mémoire projet).
- Texte « Envoi sécurisé… ».

Intégration :
- Dans `PhotoOrScanArea`, quand `state.status === "uploading"`, superposer `<BrandLoader />` en absolute au-dessus de l'aperçu (au lieu du chip « Envoi… »).
- Dans `SelfieArea`, même superposition sur le cercle selfie.

Animations en CSS seulement (ajouter 2 keyframes dans `src/styles.css` : `edl-ring-spin` et `edl-logo-pulse`).

---

## Fichiers touchés

- `src/components/inspection/EdlPremiumFlow.tsx` (retrait auto-advance, ajustements responsive, intégration `BrandLoader`)
- `src/styles.css` (keyframes `edl-ring-spin`, `edl-logo-pulse`)

Aucune migration DB. Aucun changement de logique métier.
