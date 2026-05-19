## Objectif
Réorganiser l'étape "Informations véhicule" pour mettre la **plaque en premier** et ajouter un champ **VIN optionnel** visible, sans toucher au calcul des tarifs, à la logique du tunnel ni au design (couleurs, typographie, cartes).

## Scope strict
- Fichiers modifiés : `src/components/DevisGenerator.tsx` (Step 2 — desktop) et `src/components/mobile/MobileDevisGenerator.tsx` (étape véhicule — mobile).
- Aucun changement de state, de validation `isComplete`, de payload Supabase, de pricing, de hooks ou d'imports métier.
- Aucun changement de couleurs ni de classes design system (réutilisation de `inputCard`, `selectCard`, `inputCls`, tokens `cream`, `#e7c76a`, `#5fb6ff`).

## Desktop — `DevisGenerator.tsx` Step 2

Nouvel ordre du JSX (le state existant reste identique) :

1. **Bloc Plaque** (en haut, pleine largeur)
   - Champ plaque + bouton "Rechercher" — version actuelle déjà fonctionnelle, juste **déplacée en tête**.
   - Bouton "Rechercher" rendu plus visible : padding accru, icône `Search`/`Sparkles` conservée, contraste gold renforcé sur le style déjà existant (pas de nouvelle couleur).
   - États : `sivLoading` (spinner), `sivMsg` ok/err (déjà géré).
   - Checkbox "Je ne connais pas encore la plaque" → reste en dessous.
2. **Bloc VIN (optionnel)** — nouveau champ visible
   - Label : "VIN (optionnel)".
   - Input contrôlé par `vin` / `setVin` (state déjà présent).
   - Auto-rempli par `handleSivLookup` (déjà câblé).
   - Helper text discret : "Renseigné automatiquement si trouvé via la plaque."
   - Jamais requis, ne bloque rien.
3. **Bloc Infos auto-remplies** : carte récap actuelle (`annee`, `puissance`, `finition`) déplacée juste sous le VIN, retirée du bloc plaque.
4. **Marque / Modèle** : champs existants conservés (auto-remplis par l'API).
5. **Type de véhicule** (select).
6. **Carburant** (select, auto-rempli si l'API renvoie `carburant`).
7. **État du véhicule** (Roulant / Non roulant) — reste en dernier.

Pas de modification de `handleSivLookup`, ni de `isComplete`, ni de la soumission.

## Mobile — `MobileDevisGenerator.tsx` étape véhicule

État actuel : pas de lookup plaque côté mobile. À ajouter pour parité.

1. Ajouter les states locaux : `immatriculation`, `vin`, `annee`, `puissance`, `finition`, `sivLoading`, `sivMsg` (mêmes noms et types que desktop).
2. Importer `lookupPlate` + `useServerFn` et reproduire `handleSivLookup` à l'identique (copie de la fonction desktop).
3. Réordonner l'étape véhicule pour matcher le desktop :
   1. Plaque + bouton "Rechercher" (full width, bouton visible)
   2. VIN (optionnel)
   3. Carte infos auto (année / puissance / finition) si remplie
   4. Marque, Modèle
   5. Type de véhicule
   6. Carburant
   7. État du véhicule (si présent ; sinon laisser inchangé)
4. Mettre à jour le payload existant : `immatriculation: immatriculation` au lieu de `""` (ligne 228) pour propager la plaque saisie.
5. Garder les classes `inputCls` et la grille responsive existantes (1 col mobile).

## Garanties de non-régression
- `isComplete`, validation `step === 2`, calculs `pricing`/`distance`, payloads Supabase et email : non touchés.
- Pas de framer-motion (rappel mémoire projet) — uniquement CSS/Tailwind.
- Pas de nouvelle couleur, pas de nouveau token. Réutilisation stricte du design system.
- Le champ VIN optionnel n'apparaît dans aucune validation bloquante.

## Tests manuels post-implémentation
1. Desktop : saisir plaque test `GR698YE` → cliquer Rechercher → vérifier auto-fill VIN, marque, modèle, année, carburant, finition.
2. Desktop : cocher "Je ne connais pas encore la plaque" → bouton Rechercher disabled, parcours continue.
3. Desktop : aller jusqu'au paiement, vérifier prix inchangé sur un trajet de référence.
4. Mobile (viewport 390) : même séquence ; vérifier que l'étape véhicule respecte le nouvel ordre et que le bouton Rechercher est tap-friendly.
5. Vérifier que VIN saisi manuellement est bien envoyé dans le payload.
