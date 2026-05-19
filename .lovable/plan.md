## Objectif
Remplacer l'API RapidAPI actuelle (`api-siv-systeme-d-immatriculation-des-vehicules`) par la nouvelle API `api-de-plaque-d-immatriculation-france.p.rapidapi.com` dans `src/lib/plate.functions.ts`, sans toucher au reste (UI, tunnel, validations).

## Scope
- Fichier modifié : `src/lib/plate.functions.ts` uniquement.
- Aucune modification de `DevisGenerator.tsx`, `MobileDevisGenerator.tsx` ni du contrat de retour `PlateLookupResult` (mêmes champs : `vin`, `marque`, `modele`, `annee`, `carburant`, `puissance`, `finition`).

## Changements techniques

1. **Nouveau host & URL**
   - `RAPIDAPI_HOST = "api-de-plaque-d-immatriculation-france.p.rapidapi.com"`
   - URL : `https://${RAPIDAPI_HOST}/?plaque=${encodeURIComponent(plate)}` (query param `?plaque=...` au lieu du path).
2. **Headers** inchangés (`x-rapidapi-key`, `x-rapidapi-host`) — la clé reste lue depuis `process.env.RAPIDAPI_KEY` (déjà configurée).
3. **Parsing de la réponse**
   - Conserver `pick()` avec des fallbacks larges : la nouvelle API peut renvoyer des champs avec des noms différents (ex. `immatriculation`, `marque`, `modele`, `date1erCir_fr`, `energie`, `puissance_fiscale`, `vin`, `version`, etc.).
   - Étendre la liste des clés candidates pour couvrir les variantes connues de cette API tout en gardant l'ancienne liste comme fallback.
   - Garder le déballage `json?.data ?? json?.result ?? json?.vehicule ?? json`.
4. **Gestion d'erreurs** : inchangée (401/403 → clé invalide, 404 → introuvable, parse fail → réponse invalide, hasAny=false → "Aucune donnée").
5. **Logs `[SIV]`** : conservés, utiles pour vérifier le format renvoyé après bascule.

## Clé API
- Ne pas hardcoder la clé donnée dans le message (`20f8ea0d...`). On réutilise `RAPIDAPI_KEY` existante. Si la nouvelle API exige une clé différente, je le préciserai après le premier test et on passera par `update_secret`.

## Test post-implémentation
- Plaque test : `GR698YE` et `FH-034-DD` via le tunnel desktop → vérifier auto-fill marque/modèle/année/VIN.
- Inspecter les logs serveur (`[SIV] body keys`) pour ajuster les noms de champs si nécessaire.

## Non-régression
- Pas de changement de signature côté front, pas de migration DB, pas de changement UI.
