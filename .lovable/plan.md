# Corriger le bug “La Riche → Tours = 6 €”

## Objectif
Faire en sorte que l’estimateur applique bien le forfait local même quand l’utilisateur saisit une commune de l’agglomération sans code postal, par exemple `La Riche → Tours`.

## Ce que je vais changer

### 1. Rendre la détection locale plus robuste
Aujourd’hui, le forfait local dépend surtout du code postal présent dans l’adresse. Si l’utilisateur tape seulement `La Riche`, le système ne trouve pas le CP `37520` et tombe sur le calcul kilométrique.

Je vais donc compléter la logique locale pour reconnaître aussi :
- les **noms de communes**,
- les **variantes courantes d’écriture**,
- puis utiliser le **code postal si présent** en priorité.

Exemples à couvrir :
- `La Riche → Tours` = 79 €
- `Joué-lès-Tours → Tours` = 79 €
- `Chambray-lès-Tours → Saint-Cyr-sur-Loire` = 79 €
- `Tours → Loches` = 99 €

### 2. Appliquer cette logique dans les deux estimateurs
Je vais brancher la même résolution locale dans :
- `src/components/DevisGenerator.tsx`
- `src/components/mobile/MobileDevisGenerator.tsx`

But : éviter qu’un estimateur marche et l’autre non.

### 3. Supprimer le fallback qui laisse passer des mini-prix incohérents
Quand la zone locale n’est pas reconnue, l’interface bascule aujourd’hui sur un petit calcul au km, d’où les prix aberrants comme `6 €`.

Je vais ajuster la priorité de calcul pour que :
1. le forfait agglo soit tenté d’abord,
2. puis le forfait même département,
3. puis seulement le calcul kilométrique.

## Détails techniques
- Étendre `src/lib/pricing-departments.ts` avec une table par département contenant :
  - `city`
  - `cps`
  - `aliases` / `communes` reconnues textuellement
- Ajouter une normalisation des libellés (`saint`/`st`, accents, tirets, casse)
- Faire évoluer `resolveLocalDeptTariff(...)` pour détecter une zone agglo via :
  - CP explicite si présent
  - sinon correspondance commune/alias
- Conserver le calcul km actuel pour les vrais trajets hors zone locale

## Vérifications prévues
Je validerai au minimum ces cas :
- `La Riche → Tours` = 79 €
- `La Riche 37520 → Tours 37000` = 79 €
- `Tours → Loches` = 99 €
- `Villeurbanne → Lyon` = 79 €
- `Tours → Paris` = calcul km inchangé

## Résultat attendu
L’estimateur n’exigera plus que l’utilisateur tape un code postal complet pour obtenir le bon forfait local.