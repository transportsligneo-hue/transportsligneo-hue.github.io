# Espace de pilotage Flotte / Pro — plan par phases

## Constat rapide (existant à réutiliser, pas à reconstruire)
L'espace pro contient déjà : tableau de bord, flotte (véhicules), nouvelle mission simple et groupée, adresses, missions + détail, documents, société, conducteurs, devis instantané, TCO, API. Côté données : entreprises, membres, rôles, sites/filiales, véhicules et leurs documents, factures, préférences de notifications, journal d'activité, historique des étapes de mission, incidents, états des lieux et photos.
Le plan **complète et relie** ces briques au lieu d'en créer de nouvelles en double.

## Étape 0 — Audit ciblé (lecture seule, livré avant tout changement)
- Synchronisation des statuts admin / pro / convoyeur et contrôle des droits côté serveur (point 13 et vérification 5).
- Modèle entreprise : multi-utilisateurs déjà présent ? rôles existants à mapper sur Administrateur / Logistique / Comptabilité.
- Import CSV véhicules : existe-t-il déjà ? SMS : déjà en place (oui, utilisé pour « en route ») → réutilisé.
- Rapport court des écarts, puis on enchaîne.

## Phase 1 — Cœur quotidien
1. **Tableau de bord** : 4 indicateurs (véhicules en convoyage, missions en retard/à surveiller, dépenses du mois vs mois précédent, ponctualité 30 j), missions en cours avec pastilles de statut, raccourcis (Nouvelle demande, Demande groupée, Calendrier), flux de notifications.
2. **Parc** : tableau filtrable/triable, recherche plaque/VIN, ajout manuel, fiche véhicule (infos, dernier kilométrage relevé automatiquement aux états des lieux, statut, historique des missions avec accès EDL et factures, documents).
3. **Demandes** : choix du véhicule depuis le parc, adresses depuis le carnet, demande groupée avec récap (nombre, coût estimé, délai). **Reprise rapide** : saisie de plaque auto-complétée + bouton « Reprendre les adresses d'une mission similaire ».
4. **Suivi** : statut en temps réel, convoyeur (prénom + photo), horaires prévus/réels, **comparaison EDL départ/arrivée** avec mise en évidence des nouveaux dommages + alerte (notification + badge).
5. **Recherche & filtres combinables** (plaque, VIN, date, statut, filiale, convoyeur) avec puces de filtres retirables.

## Phase 2 — Structuration
6. Carnet d'adresses avec noms usuels, réutilisable partout.
7. Calendrier mois/semaine des missions.
8. Facturation : liste + PDF, export comptable CSV/Excel par période, récap mensuel ; **aucun paiement en ligne ajouté**.
9. Utilisateurs & rôles : invitations par e-mail, 3 rôles, droits vérifiés côté serveur.
10. Journal des actions par mission (qui, quand, quoi) en fil chronologique.

## Phase 3 — Valeur avancée
11. Rapports (coût moyen par mission / type / trajet, délai moyen, taux d'incident), filtres période/filiale, export PDF/Excel.
12. Alertes e-mail + SMS (acceptée, retard, anomalie, facture, document) avec choix par utilisateur.
13. Import CSV/Excel véhicules avec gabarit téléchargeable (si absent).
14. Multi-filiales : facturation séparée + vue consolidée direction.
15. Messagerie exploitation rattachée à la mission, historique conservé.
16. Bulles d'aide « ? » contextuelles (plaque, carnet, filtres, import, reprise rapide) : affichage auto une seule fois, puis au clic.
17. Accès démo par profil (flotte / concession / loueur) pour l'équipe commerciale.

## Règles respectées
- Client mono-site inchangé ; multi-sites visible seulement pour les organisations concernées.
- Convoyeur (Ligneo) ≠ conducteur (salarié client) ; aller-retour même convoyeur ; prix inchangés.
- Design : celui déjà en place pour l'espace pro (accents violet/rose électrique, clair/sombre) — pas de nouvelle identité. Les couleurs du document (Poppins, bleu #2f5fff) ne sont pas appliquées car elles contrediraient la charte validée.

## Détails techniques
- Tables existantes étendues par migrations additives (ex. carnet d'adresses nommé, alias de rôles, préférences par type d'alerte, vue de comparaison d'anomalies EDL) ; GRANT + RLS sur chaque nouvelle table, droits vérifiés par fonctions serveur authentifiées.
- Livraison phase par phase, avec vérification à l'écran sur un compte pro réel à la fin de chaque phase.
