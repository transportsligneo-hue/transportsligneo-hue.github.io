# Devis groupés : types mélangés et validation par lots

## 1. Ce qui existe aujourd'hui (vérifié)

- Un devis groupé = **une seule ligne** dans la table des devis, avec une liste `vehicules` (plaque, modèle, arrivée, type de trajet, prix). Il est relié aux demandes de chaque véhicule par un identifiant de groupe commun.
- Le type par véhicule existe déjà (livraison simple, livraison + restitution, recharge uniquement), mais il est seulement noté : à la conversion, un devis à plusieurs véhicules est **forcé en aller simple** (la restitution n'est pas générée).
- Le modèle "Livraison et restitution" existant : deux missions liées par le même identifiant de groupe, numérotées `.1` (livraison) et `.2` (restitution), prix séparé aller / retour. Je réutilise exactement ce modèle par ligne.
- Signature : une signature (et OTP) par devis, qui verrouille tout le devis. Paiement : immédiat ou non selon le réglage du compte client (`paiement_immediat`), sur le montant total. La conversion en missions se fait en une fois pour le devis entier (après paiement ou validation admin).
- Facturation : une facture par mission ou facture groupée par lot de missions (fonction existante).
- Remise de volume : **aucune remise de volume ni grille dégressive par quantité appliquée aux devis groupés aujourd'hui.** Il existe seulement des paliers au kilomètre et des tarifs personnalisés client, appliqués par véhicule. Ils restent donc appliqués ligne par ligne, identiques en devis global ou par lot. Rien n'est modifié.

## 2. Proposition par lot (à valider)

```text
Devis groupé (inchangé, porte le numéro DEV-...)
 ├─ Lignes (nouvelle table, une par véhicule) : type, adresses, dates, prix figé, statut
 └─ Lots (nouvelle table) : nom, lignes, total HT/TTC, signature, paiement, facture
```

- **Signature** : chaque lot est signé avec le module de signature existant (même OTP, même écran), sur le récapitulatif du lot seulement. Le devis global n'est plus verrouillé entièrement : seules les lignes du lot le sont.
- **Paiement** : même règle du compte. Paiement immédiat : le paiement existant est ouvert sur le montant du lot. Sinon : lot validé à la signature, payé ensuite sur facture.
- **Missions** : à la validation, une mission par aller simple / livraison simple, deux missions liées (.1 et .2) par livraison et restitution, numérotées à partir du numéro du devis, rattachées au lot.
- **Facture** : une facture par lot (via la facture groupée existante), avec mention du devis d'origine. Bon de commande et récapitulatif PDF par lot avec le modèle existant (logo, SIREN 753 320 001).
- **Compatibilité** : un devis groupé sans lots continue de suivre le circuit actuel (une signature, une validation). Les devis et missions existants ne sont pas touchés.
- **Annulation d'un lot** : autorisée tant qu'aucune mission n'a démarré ; missions annulées par la fonction d'annulation existante, lignes repassées "À valider".
- **Droits** : validation réservée au titulaire du compte et aux membres de l'organisation autorisés à commander, avec contrôle par site si utilisé.

## 3. Écrans

- Client pro / flotte : tableau des lignes (cartes empilées sur mobile), cases à cocher, filtres, actions en lot, barre fixe marine à bord bleu lumineux, résumé "X sur Y validées" avec barre de progression, onglet Lots, enregistrement automatique.
- Admin : même devis en lecture, lots et statuts, notification à chaque lot validé, filtre par devis groupé et par lot dans la liste des missions.
- Charte : marine #061238, bleus #2f5fff / #5b83ff / #5de0ff, Poppins, Inter, IBM Plex Mono pour plaques et références, icônes fines, aucun doré.

## 4. Points à confirmer

1. "Aller simple" et "Livraison simple" : génèrent-ils exactement la même mission (seul le libellé change) ? Sinon, quelle différence ?
2. "Recharge uniquement" existe déjà : je la garde comme 4e type ?
3. Le prix du retour d'une livraison et restitution : calcul existant sur le trajet retour (aller + retour calculés séparément), ou partage actuel du prix aller-retour ?
4. Importation en masse de lignes : je n'en ai pas trouvé pour les devis groupés. Faut-il la créer (collage / fichier) ou l'ignorer ?

## 5. Tests prévus

Devis de 6 lignes (2 aller simple, 2 livraison simple, 2 livraison et restitution) ; lot 1 de 3 lignes, lot 2 de 2 lignes, ajout d'une ligne, lot 3. À chaque étape : totaux, statuts, missions (dont paires .1/.2), factures et PDF, puis rendu mobile et ordinateur.

## Détails techniques

- Tables `devis_lignes` et `devis_lots` (RLS propriétaire + organisation, admin en lecture), prix figé à la validation.
- Fonction sécurisée `validate_devis_lot(devis_id, ligne_ids, nom)` : contrôles (lot vide, champs manquants, droits), crée les missions en réutilisant la logique de `admin_convert_devis_to_missions`, notification admin.
- Fonction `cancel_devis_lot` réutilisant `admin_cancel_mission`.
- Brouillon : lignes persistées en base, sélection en cours en stockage local.
