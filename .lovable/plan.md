# Correction des tarifs locaux par département

## Problème
La règle actuelle « même département + distance ≤ 30 km = forfait intra 79 € » donne parfois de mauvais résultats parce que :
1. Elle dépend de la distance Google (variable, parfois absente).
2. Elle ne couvre que 10 départements alors qu'il en faut 20.
3. Elle ne distingue pas vraiment « agglo de la ville principale » et « hors agglo » dans le même département (ex. Amboise 37 à 25 km de Tours serait considéré comme agglo alors qu'il ne l'est pas).

## Nouvelle règle (validée)
Zone agglo = **liste explicite de codes postaux** autour de chaque ville principale.

- Départ ET arrivée dans la zone agglo de la même ville principale → **79 € HT / 129 € HT A/R**
- Départ et arrivée dans le même département, mais l'un des deux hors zone agglo → **99 € HT / 129 € HT A/R**
- Départements différents → on garde le calcul kilométrique existant (1,20 €/km < 200 km, 0,85 €/km au-delà).
- Tarifs déjà configurés (option « express » +20 %, etc.) inchangés.

## Détails techniques

### 1. `src/lib/pricing-departments.ts` — refonte
- Remplacer `DEPT_MAIN_CITIES` par une structure `DEPT_AGGLO_CP: Record<deptCode, { city: string, cps: Set<string> }>` couvrant les 20 départements demandés (37, 75, 69, 13, 31, 33, 44, 59, 67, 34, 06, 35, 76, 38, 21, 49, 51, 63, 64, 83).
- Pour le 37, inclure les CP : 37000, 37100, 37200, 37300 (Joué), 37170 (Chambray), 37270, 37520 (La Riche), 37540 (St-Cyr), 37700 (St-Pierre-des-Corps), 37550 (St-Avertin), 37230 (Fondettes), 37510 (Ballan-Miré), 37210 (Rochecorbon / Parçay-Meslay / Notre-Dame-d'Oé), 37250.
- Pour les autres grandes métropoles : CP de la ville principale + communes limitrophes (Paris 75001-75020 + petite couronne 92/93/94 traités séparément ou non — voir question ci-dessous), Lyon (69001-69009 + Villeurbanne 69100, Vénissieux 69200, etc.), Marseille (13001-13016 + Aubagne, La Ciotat ?), etc. Liste détaillée préparée sur la base des INSEE/CP officiels.
- Refactorer `resolveLocalDeptTariff` pour ignorer la distance et se baser uniquement sur CP départ / CP arrivée :
  - Extraire CP des deux adresses.
  - Si même département présent dans la table → renvoyer 79 (les deux CP dans la liste agglo) ou 99 (sinon).
  - Sinon `null` (fallback kilométrique).

### 2. `src/components/DevisGenerator.tsx` (et `MobileDevisGenerator.tsx`)
- Supprimer le shortcut `FIXED_TARIFFS[dept]` basé sur `CITY_DEPARTMENTS` (qui ne contient que Tours/Châteauroux et provoque des faux positifs).
- `calculatePrice` :
  1. Appeler `resolveLocalDeptTariff` en premier (CP-based, plus de paramètre distance).
  2. Si null et `distance <= 0` → garder le minimum local actuel (79/129) uniquement si CP départ = CP arrivée et appartient à une zone agglo connue ; sinon fallback kilométrique avec distance estimée.
  3. Sinon calcul kilométrique (inchangé).
- Aucune modification UI/visuelle, aucune modification de la logique express / aller-retour, aucune modification de la SIV ou de l'envoi de devis.

### 3. Tests manuels à valider après implémentation
- La Riche (37520) → Tours (37000) = 79 €
- La Riche → Chambray-lès-Tours (37170) = 79 €
- La Riche → Loches (37600) = 99 €
- Tours → Loches = 99 €
- Chambray → Saint-Cyr (37540) = 79 €
- Villeurbanne (69100) → Lyon (69003) = 79 €
- Lyon → Givors (69700, hors agglo) = 99 €
- Tours → Paris = calcul km inchangé

## Question avant implémentation
Pour **Paris (75)** : faut-il inclure la petite couronne (92, 93, 94) dans la zone « agglo Paris » ou se limiter strictement aux CP 750xx ? (les 92/93/94 sont des départements distincts → si oui, je ferai une exception spéciale pour la métropole parisienne).

## Hors scope (non touché)
- UI / identité visuelle (bleu foncé + or, Playfair) inchangée.
- SIV / RapidAPI inchangé.
- `FIXED_TARIFFS` express +20 %, aller-retour, multipliers inchangés.
- Calcul kilométrique longue distance inchangé.
