## Diagnostic du test

Test effectué en direct sur `https://transportsligneo.fr/_serverFn/...` (server function `lookupPlate`) avec la plaque `GR698YE` :

```
HTTP 500
{"message":"Seroval Error (step: 3)"}
```

Même résultat avec une plaque invalide (`"X"`) → l'erreur est masquée par une erreur de sérialisation TanStack/seroval. La vraie cause ne remonte ni au client ni aux logs (`stack_modern--server-function-logs` n'affiche que le message générique).

**Causes probables identifiées dans `src/lib/plate.functions.ts` :**

1. **`ZodError` non sérialisable** : `inputValidator((data) => z.object({...}).parse(data))` lance une `ZodError` quand la plaque est invalide. TanStack tente de sérialiser cette erreur avec seroval qui ne supporte pas ses références internes → "Seroval Error (step: 3)".
2. **Erreur fetch non encapsulée correctement** : si l'appel RapidAPI lève une erreur dont l'objet contient des références non sérialisables (Response, Request, etc., spécifiques au runtime Worker), même `console.error(e)` puis `return {ok:false}` ne suffit pas si l'erreur s'échappe avant le catch.
3. **Endpoint OK** : tu m'as confirmé `GET /{plaque}` → la construction d'URL `https://${HOST}/${plate}` est correcte.

## Plan de correction

### 1. Durcir `src/lib/plate.functions.ts`

- Remplacer `.inputValidator((data) => Schema.parse(data))` par une version qui **catche `ZodError`** et retourne `{ ok: false, error: "Plaque invalide" }` au lieu de throw. On ne laisse jamais TanStack sérialiser un objet d'erreur Zod.
- Englober **tout** le `.handler` dans un `try/catch` racine qui retourne toujours un objet plain JSON `{ ok, error?, data? }`. Aucune throw n'échappe.
- Logger explicitement à chaque étape (`console.log("[SIV] start", plate)`, `console.log("[SIV] status", res.status)`, `console.log("[SIV] body keys", Object.keys(root||{}))`) pour pouvoir diagnostiquer via `server-function-logs`.
- S'assurer que `RAPIDAPI_KEY` est lu **dans** le handler (déjà le cas).

### 2. Vérifier le mapping de la réponse

Une fois les logs activés, on saura quelle est la structure réelle renvoyée par cette API SIV pour `GR698YE`. Si les clés ne correspondent pas à la liste actuelle (`marque`, `modele`, `vin`, etc.), on étend `pick()` avec les vraies clés retournées.

### 3. Tests de validation

Après déploiement :
- Plaque valide `GR698YE` → réponse `{ ok:true, data:{ marque, modele, ... } }`
- Plaque invalide `"X"` → réponse `{ ok:false, error:"Plaque invalide" }` (HTTP 200, pas 500)
- Vérifier dans les logs serveur que les `console.log` apparaissent

### Fichiers modifiés

- `src/lib/plate.functions.ts` (uniquement)

Aucun changement UI nécessaire — `DevisGenerator.tsx` consomme déjà `{ok, error, data}`.
