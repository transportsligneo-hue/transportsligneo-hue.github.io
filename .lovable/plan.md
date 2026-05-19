## Plan d'amélioration de l'estimateur

### 1. Refonte UX/UI premium (sans casser la logique)

**Desktop (`DevisGenerator.tsx`)**
- Élargir le conteneur de l'estimateur (`max-w-3xl` → `max-w-5xl`) pour donner plus d'air.
- Restructurer en deux blocs distincts **Départ** et **Arrivée** :
  - chacun dans une carte interne (fond `#0b1026/40`, bord doré subtil, coins `rounded-2xl`)
  - icône or (pin de départ / drapeau d'arrivée) + label sobre en majuscules dorées
  - champ adresse pleine largeur à l'intérieur du bloc
- Séparateur élégant entre les deux blocs : ligne verticale dorée + petit cercle central (icône flèche) façon Uber.
- Champs plus hauts (`h-14`), padding généreux, focus ring doré.
- Bouton « Obtenir mon prix » : plus large, ombre dorée plus prononcée, micro-animation `hover:scale-[1.02]` CSS pure.
- Ombres premium : `shadow-[0_20px_60px_-20px_rgba(212,175,55,0.25)]` sur la carte principale.

**Dropdown Google Places (correctif clé)**
- Le dropdown passe en `position: absolute` + `w-full` calé sur le champ parent.
- `z-index: 70` (au-dessus de tout le reste).
- Le parent du champ reçoit `min-h` fixe pour qu'aucun rétrécissement ne se produise quand les suggestions apparaissent.
- Les blocs Départ/Arrivée ne sont plus dans une grille à hauteur égale → le dropdown n'écrase plus l'autre bloc.

**Mobile (`MobileDevisGenerator.tsx`)**
- Conservation de la bottom-sheet existante.
- Mêmes blocs Départ/Arrivée empilés verticalement avec séparateur doré.
- Champs `h-14`, bouton CTA pleine largeur or.

**Garde-fous**
- Aucun changement aux fonctions `calculatePrice`, `extractCity`, `getGoogleDistanceKm`.
- Aucun changement aux IDs/handlers existants.
- Couleurs : uniquement `#0b1026`, `#d4af37`, `#e7c76a` (chartes mémorisées).

---

### 2. Tarifs locaux — extension aux 10 métropoles

Extension des tables existantes (sans toucher au reste de `calculatePrice`) :

```text
Dept  Ville              Code intra   Code hors
37    Tours              37-intra     37-hors
69    Lyon               69-intra     69-hors
13    Marseille          13-intra     13-hors
33    Bordeaux           33-intra     33-hors
31    Toulouse           31-intra     31-hors
44    Nantes             44-intra     44-hors
75    Paris              75-intra     75-hors
59    Lille              59-intra     59-hors
67    Strasbourg         67-intra     67-hors
06    Nice               06-intra     06-hors
```

Tarifs (HT) :
- `*-intra` (agglomération) : **79 € aller simple / 129 € A/R**
- `*-hors` (même département, > 30 km de la ville principale) : **99 € / 129 €**

**Détection « intra vs hors agglo »** dans le même département :
- Si Google Places renvoie `lat/lng` → calcul Haversine depuis la grande ville (table de coordonnées des 10 villes). `≤ 30 km` = intra, sinon = hors.
- Fallback (pas de coords) : on garde le mapping ville → code existant (Tours = intra, Châteauroux = hors, etc.), extensible.

**Priorité conservée** :
1. Si un tarif spécifique existe déjà dans `FIXED_TARIFFS` pour la paire → il gagne.
2. Sinon, même département → règle locale ci-dessus.
3. Sinon → calcul kilométrique existant **inchangé**.

---

### 3. Google Places — amélioration légère

Le composant `PlacesInput` existe déjà. Ajouts :
- Retour de l'objet complet sélectionné : `{ address, city, postalCode, lat, lng }` via un nouveau callback `onPlaceSelect` (l'ancien `onChange(string)` reste pour compatibilité).
- Stockage des coords dans l'état du `DevisGenerator` pour alimenter (a) Haversine intra/hors, (b) Distance Matrix.
- États visuels : skeleton pendant la résolution de distance, message d'erreur sobre + fallback manuel (déjà en place).

---

### 4. Plaque SIV — préparation, branchement en attente

Vous avez choisi « Autre provider RapidAPI » sans préciser lequel. Je vais :
1. Préparer la structure côté code :
   - server function `lookupPlate` (`src/lib/plate.functions.ts`) qui lit `RAPIDAPI_KEY` + `RAPIDAPI_SIV_HOST` depuis `process.env`.
   - champ « Plaque d'immatriculation » dans le formulaire véhicule avec bouton « Récupérer ».
   - mapping de la réponse → champs marque/modèle/année/carburant/puissance/VIN.
2. **Bloquer l'appel réel** tant que vous ne m'avez pas confirmé :
   - le host RapidAPI exact (ex: `car-data.p.rapidapi.com`)
   - le chemin d'endpoint
   - le format de réponse
3. Une fois confirmé, je demanderai les secrets `RAPIDAPI_KEY` + `RAPIDAPI_SIV_HOST` via le formulaire sécurisé (jamais en dur).

---

### Détails techniques

**Fichiers modifiés**
- `src/components/DevisGenerator.tsx` — refonte visuelle + extension tables tarifs + coords
- `src/components/mobile/MobileDevisGenerator.tsx` — refonte visuelle + mêmes règles tarifs
- `src/components/PlacesInput.tsx` — callback `onPlaceSelect` + z-index dropdown
- `src/lib/google-places.ts` — exposer `lat/lng/postalCode` depuis Places Details
- `src/lib/pricing-departments.ts` *(nouveau)* — tables villes/coords/codes + helper `resolveLocalTariff(from, to)`
- `src/lib/plate.functions.ts` *(nouveau, prêt mais inerte)* — server fn SIV

**Non touché**
- Toute la logique kilométrique longue distance existante
- Tarifs `FIXED_TARIFFS` déjà configurés (Tours)
- Composants hors estimateur

**Risques & mitigations**
- Hydration mismatch déjà présent (lien CSS) : non lié à ce chantier, sera ignoré.
- Performance Places : debounce 250 ms déjà en place, conservé.
- Quota Google : Distance Matrix appelée uniquement après sélection complète des deux adresses.

---

### Question restée en suspens

Pour activer réellement la plaque SIV, j'ai besoin **du nom du host RapidAPI et de l'endpoint** (ou un exemple de réponse JSON). Je peux livrer les points 1, 2, 3 immédiatement et brancher le SIV dès que vous me donnez ces infos.