# Vidéo de démonstration — Parcours complet d'une mission

Objectif : une vidéo motion-design (MP4) qui raconte le parcours d'une mission Transports Ligneo, du devis client jusqu'à la livraison et la facturation.

## Format

- 1920x1080, 30 images/seconde, environ 25 secondes
- Sans voix off, avec titres à l'écran en français
- Identité Ligneo : bleu nuit, blanc cassé, accents dorés, titres Playfair Display, textes en sans-serif
- Fichier final téléchargeable en MP4

## Scénario (6 séquences)

1. **Ouverture** — logo et signature « Votre logistique automobile sur toute la ligne », fond bleu nuit animé.
2. **La demande** — le client remplit l'estimateur : adresses de départ/arrivée, véhicule, prix estimé qui s'affiche, devis généré.
3. **Côté administration** — la demande apparaît dans le tableau de bord, statut qui passe à « Attribuée », convoyeur sélectionné.
4. **L'application Driver** — écran mobile : prise en charge, état des lieux photo par photo, signature.
5. **Le trajet** — carte animée avec tracé du parcours, suivi en direct, temps estimé.
6. **Livraison et clôture** — signature client, PV de livraison, facture, puis carte finale avec le logo et le contact.

Chaque écran est une reconstitution soignée de l'interface (cadres, badges, cartes), pas une capture d'écran : rendu net et lisible à toute taille.

## Détails techniques

- Vidéo construite avec Remotion (React), sources versionnées dans `remotion/` du projet, pour pouvoir la modifier ou la re-générer plus tard
- Scènes séparées dans `remotion/src/scenes/`, enchaînées avec `TransitionSeries`
- Rendu via un script de rendu programmatique, export dans `/mnt/documents/parcours-mission-ligneo.mp4`
- Aucune modification du site ou de l'application : ajout d'un dossier isolé uniquement

## Points à confirmer si besoin

- Version verticale 9:16 (réseaux sociaux) en plus du format paysage : réalisable dans un second temps
- Ajout d'une musique de fond : à fournir, sinon la vidéo sera muette
