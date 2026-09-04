# Rendre les devis réellement modifiables

## Objectif
Permettre de modifier un devis directement depuis la liste Devis visible dans l’administration, sans devoir trouver une autre page.

## Changements
- Ajouter une action « Modifier » clairement visible sur chaque devis de la liste.
- Ajouter la même action dans l’aperçu latéral du devis.
- Ouvrir le formulaire complet existant : client, prix, véhicule, immatriculation, carburant, adresses, date, heure, trajet, distance et notes.
- Après enregistrement, actualiser immédiatement la liste et l’aperçu, conserver le même numéro, incrémenter la révision et régénérer le PDF avec la mention « Devis modifié ».
- Vérifier le fonctionnement sur l’écran Devis et contrôler qu’aucune erreur n’est introduite.

## Détails techniques
Le formulaire d’édition complet est déjà présent sur la fiche détaillée. Il sera réutilisé sur la liste afin d’éviter deux comportements différents et de garder une seule logique d’enregistrement.
