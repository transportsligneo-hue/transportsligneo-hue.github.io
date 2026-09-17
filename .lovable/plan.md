# Nouvelle page de paiement de facture (maquette fournie)

La page de règlement de facture existe déjà et fonctionne avec la carte bancaire.
Cette évolution reprend fidèlement la maquette envoyée : fond clair, panneau
bleu nuit à gauche avec le récapitulatif, panneau blanc à droite avec le
formulaire, et écran de confirmation avec la coche verte animée.

## Ce qui change visuellement

- Bandeau haut : logo Transports Ligneo, mention « Paiement sécurisé » et
  pastille blanche « Connexion chiffrée SSL ».
- Panneau gauche (bleu nuit, coins arrondis) : numéro de facture, client,
  véhicule et plaque, date de convoyage, trajet départ → arrivée avec les
  points cyan/bleu, détail HT / TVA / Total à régler, mentions de confiance.
- Panneau droit (blanc) : titre « Détails de paiement », pastille bleue du
  montant, choix du moyen de paiement, champs de saisie au style de la
  maquette (Poppins, bordures bleues au focus), bouton « Payer XX,XX € » en
  dégradé bleu avec effet de brillance, mentions Stripe en bas.
- Écran de confirmation : reprise exacte de l'overlay de la maquette (coche
  verte animée, anneau pulsé, récapitulatif facture / mission / montant,
  boutons « Télécharger la facture » et « Retour à l'espace »).
- Typographie Poppins + IBM Plex Mono pour les montants, chargées proprement
  dans l'en-tête du site.

## Moyens de paiement

- Carte bancaire (et Apple Pay / Google Pay) : inchangé, déjà en place.
- Revolut Pay : ajout d'un second bouton. La commande Revolut est créée côté
  serveur (la clé reste privée) et le client est redirigé vers Revolut ; le
  retour de paiement est confirmé par le webhook Revolut déjà existant, qui
  marque la facture payée et déclenche l'envoi du reçu.

## Données réelles

Le récapitulatif affiche les vraies informations de la facture : numéro,
client/société, véhicule et plaque (repris de la mission liée), date de
convoyage, trajet, montants HT/TVA/TTC. La confirmation vérifie toujours le
statut réel en base, jamais le simple retour d'URL.

## Détails techniques

- `src/routes/paiement.facture.$factureId.tsx` : nouvelle structure (topbar,
  summary, pay-panel) ; `src/components/facture/FactureNeonPayment.tsx` passe
  en thème clair Stripe (`theme: "stripe"`) et gagne le sélecteur de moyen de
  paiement.
- `src/styles.css` : remplacement du bloc `.pn-*` par le jeu de styles clair
  de la maquette (variables `--blue #2f5fff`, `--navy`, `--ok`), plus les
  styles de l'overlay de succès.
- `src/routes/api/facture/payment-intent.ts` : ajout au récapitulatif du
  véhicule, de la plaque et de la date de mission (jointure mission/trajet).
- Nouveau `src/routes/api/facture/revolut-order.ts` : crée la commande
  Revolut via `src/lib/revolut-server.ts`, renvoie l'URL de paiement,
  enregistre le lien pour que le webhook existant retrouve la facture.
- `src/routes/paiement.confirmation.tsx` : mise au format de l'écran de
  confirmation de la maquette, avec l'indication du moyen utilisé.
- Les pages de devis, missions et le site public ne sont pas touchés.
