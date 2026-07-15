# Évolution majeure — Espace Convoyeur, Admin & Missions

Ce chantier est très large (12 blocs fonctionnels majeurs). Pour tenir la règle "ne rien casser" et livrer du solide, je propose de le découper en **lots livrables**, à valider un par un. Chaque lot est autonome, testable, rétrocompatible.

## Lot 1 — Inscription convoyeur premium (assistant multi-étapes)
- Nouveau parcours `/inscription-convoyeur` en assistant (stepper) : Infos perso → Coordonnées → Statut pro → Assurance → Permis → CNI → Kbis/SIRET (si indépendant) → RIB → Photo → Signature électronique → Contrat → Formation → Validation.
- Suppression totale du justificatif de domicile (front + back + doc requis).
- Sauvegarde automatique de la progression (reprise si fermeture).
- UX bancaire : drag & drop, upload instantané, compression, aperçu, rotation/recadrage/zoom, remplacement, reprise sur coupure réseau, messages d'erreur clairs.
- Composant scanner mobile : détection bords + correction perspective + amélioration luminosité (via `scanner`/wasm côté client).

## Lot 2 — Centre de validation admin
- En cours : `admin.convoyeurs.$convoyeurId` est structuré en onglets avec dossier complet, documents, missions, disponibilité, activité et formation.
- En cours : actions documentaires déjà disponibles dans le centre de validation ; ajout du suivi formation et du bypass manuel.
- À poursuivre : historique de versions documentaire avancé et comparaison visuelle.
- Sur validation : email + notif in-app + push + (SMS si activé).

## Lot 3 — Formation obligatoire
- Livré : tables `formation_modules`, `formation_progress`, `formation_quiz_attempts`.
- Livré : écran `/convoyeur/formation` avec modules et quiz à 80 % minimum.
- Livré : gate `has_completed_training` côté catalogue, enchères et fonctions d'acceptation.

## Lot 4 — Niveaux & avis clients
- Système Débutant/Confirmé/Expert calculé depuis missions, ponctualité, avis, incidents.
- Après mission validée : demande d'avis client automatique (mail + notif) → note globale + critères (ponctualité, pro, état, com, délais) + commentaire.
- Affichage niveau + note sur profil convoyeur.

## Lot 5 — Avis Google Business
- Réglage admin (URL GBP, activation, délai, message).
- Cron : envoi mail/SMS X heures après mission terminée avec lien direct.

## Lot 6 — Catalogue de missions & workflow admin
- Fix publication catalogue : depuis n'importe quelle mission, menu d'actions "Assigner / Publier catalogue / Ouvrir enchères / Dépublier / Retirer / Basculer / Modifier / Annuler / Dupliquer / Archiver".
- Aucune duplication de mission — changements d'état sur la même ligne.

## Lot 7 — Système d'enchères
- Choix admin : montant fixe / enchères / contre-offres.
- Côté convoyeur : voir mission + accepter / proposer / contre-proposer / retirer.
- Côté admin : tableau des offres, accepter/refuser en 1 clic, historique.

## Lot 8 — Polish app-native & robustesse
- Skeleton loaders, transitions, cache, messages d'erreur.
- Audit workflows (inscription, docs, missions, catalogue, enchères, notifs, mails, devis, factures, EDL, signatures, permissions).
- Journalisation actions dans `activity_logs`.

## Détails techniques
- DB : nouvelles tables `formation_modules`, `formation_progress`, `formation_quiz_attempts`, `mission_offers` (si absente ou étendue), `convoyeur_levels_snapshot`, `client_reviews`, `google_review_settings`. RLS + GRANT stricts.
- Signature électronique : composant canvas déjà présent (`mission_signatures`) réutilisé.
- Aucune modification des tables existantes autre qu'ajout de colonnes optionnelles (`niveau`, `note_moyenne`, `formation_status`).
- Pas de framer-motion (contrainte projet) — animations Tailwind uniquement.
- Design system : navy/cream/gold existant, tokens `.card-premium-light`, `.btn-onyx`, glass onyx.

## Question de séquencement
Ce chantier représente **plusieurs jours** de travail agent réparti sur des dizaines de fichiers et migrations. Je recommande de commencer par les lots les plus bloquants pour ton activité :

**Ordre proposé :**
1. **Lot 6 (Catalogue/workflow admin)** — tu m'as déjà signalé que la publication catalogue ne marche pas.
2. **Lot 1 (Inscription premium)** + **Lot 2 (Centre validation)** — parcours d'entrée.
3. **Lot 3 (Formation)** — gate obligatoire.
4. **Lot 7 (Enchères)**.
5. **Lot 4 + 5 (Avis + Google)**.
6. **Lot 8 (Polish + audit)**.

Confirme-moi cet ordre (ou dis-moi lequel prioriser), et j'attaque le premier lot immédiatement avec migrations + code livrés dans le même tour.
