# Audit et amélioration globale — Transports Ligneo

Méthode demandée : audit d'abord, puis améliorations par étapes validées. Rien de sensible (prix, devis, paiements, signatures, GPS, e-mails/SMS, base, rôles, app Android) n'est modifié sans votre accord explicite.

## Constats déjà vérifiés

- **Thème** : aujourd'hui le site démarre en sombre puis suit le réglage de l'appareil. Le mode clair n'est donc pas le défaut. Le bouton de thème existe sur le site public et dans l'espace convoyeur, mais **pas** dans les espaces client particulier, professionnel et administrateur.
- **Espaces** : environ 50 pages admin, 15 convoyeur, 10 particulier, 10+ professionnel. Toutes les fonctions demandées (multi-véhicules, recherche plaque/VIN, factures, incidents, historique, exploitation live) existent déjà : on améliore, on ne recrée pas.
- **Application Android** : c'est le même site, emballé. Le thème y suivra donc automatiquement, sans toucher au GPS ni aux notifications.
- **Points déjà corrigés récemment, à préserver** : scanner partagé, PDF mobile, OTP devis, tarifs Tours/Le Mans, couleurs Driver (bleu/vert) et Pro (violet/rose), vidéos, néons des notifications.

## Étape 1 — Rapport d'audit (aucune modification)

Livraison d'un document « Audit Ligneo » dans vos fichiers, page par page et espace par espace : lisibilité clair/sombre, textes illisibles, débordements mobile, boutons sans retour visuel, états vides, doublons. Classement **Critique / Important / Confort**, plus une liste « fonctionne, ne pas toucher ». Captures d'écran à l'appui pour les pages publiques ; pour les espaces connectés, je vous demanderai l'autorisation de me connecter avec un compte de test.

## Étape 2 — Mode clair par défaut partout (après validation)

- Clair par défaut pour tous les visiteurs ; sombre en option, choix mémorisé.
- Ajout du bouton de thème dans les espaces particulier, professionnel et admin (au même endroit que chez le convoyeur).
- Changement immédiat sans rechargement.
- Passage de chaque composant dans les deux modes : menus, tableaux, formulaires, fenêtres, notifications, cartes, graphiques.

## Étape 3 — Harmonisation et confort, module par module

Dans cet ordre, une validation par module : site public → espace particulier → espace professionnel → admin → convoyeur.
Pour chacun : boutons et icônes cohérents, titres, espacements, chargements, confirmations, messages d'erreur clairs, états vides utiles, protection contre le double clic, confirmation avant suppression, affichage mobile et tablette.

## Étape 4 — Statuts, e-mails et SMS (lecture seule d'abord)

Vérification que chaque statut affiché correspond aux e-mails/SMS envoyés et qu'aucun SMS ne part en double. Les anomalies trouvées vous sont présentées avant toute correction.

## Étape 5 — Tests et récapitulatif

Contrôle à l'écran après chaque module, vérification qu'aucune fonction existante n'est cassée, récapitulatif final avec les points restants.

## Détails techniques

- Thème : `useTheme` passe la valeur par défaut de `"system"`/`"dark"` à `"light"`, avec un script dans la racine pour éviter le flash sombre au chargement ; la classe `theme-light` / `theme-dark` reste le mécanisme unique.
- `ThemeToggle` réutilisé dans les barres latérales client, pro et admin.
- Les couleurs restent dans `src/styles.css` (tokens) ; les accents Driver/Pro et le splash gardent leurs tokens dédiés.
- Aucun changement de base de données, de prix, de paiement ou de déclencheur de notification dans ce plan.
