## Diagnostic
L'appel API fonctionne (status 200) mais retourne des clés préfixées `AWN_` (ex : `AWN_VIN`, `AWN_carrosserie`, `AWN_annee_de_debut_modele`…). Notre `pick()` ne connaît pas ces noms → "Aucune donnée véhicule trouvée".

Les 20 premières clés loguées ne contiennent pas encore marque/modele/energie mais l'API en a manifestement davantage (préfixe AWN_ commun à cette source).

## Correction
Fichier : `src/lib/plate.functions.ts` uniquement.

1. **Étendre `pick()`** pour reconnaître les champs `AWN_*` :
   - vin : `AWN_VIN`
   - marque : `AWN_marque`
   - modele : `AWN_modele`, `AWN_modele_etendu`, `AWN_modele_commercial`
   - annee : `AWN_date_de_premiere_mise_en_circulation`, `AWN_annee_de_debut_modele`
   - carburant : `AWN_energie`, `AWN_energie_NGC`
   - puissance : `AWN_puissance_fiscale`, `AWN_puissance_din`, `AWN_puissance_kw`
   - finition : `AWN_version`, `AWN_serie`

2. **Améliorer le log de debug** : passer de 20 à 60 clés dans `[SIV] body keys` pour itérer rapidement si certains noms exacts diffèrent.

3. **Garder les anciens fallbacks** pour ne pas casser une éventuelle autre source.

## Test post-implémentation
- Rejouer `GR452PE` → vérifier auto-fill (VIN KNACT811FR5062356 attendu, Kia/Ceed Break 2022-2025).
- Si certains champs restent vides, lire les logs `[SIV] body keys` étendus et compléter le mapping.

## Non-régression
- Aucun changement d'UI, de tunnel, de contrat de retour `PlateLookupResult`.
