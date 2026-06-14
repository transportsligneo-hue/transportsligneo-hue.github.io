# Plan

## Objectif
Rendre chaque mission cliquable avec un vrai détail complet côté client, et rétablir une vue live GPS exploitable côté admin, avec tous les justificatifs attendus.

## Ce que je vais corriger

### 1. Réparer le chaînage mission → attribution → trajet
- Fiabiliser la résolution de l’attribution liée à une mission client.
- Arrêter de dépendre uniquement de correspondances fragiles quand les données historiques ne sont pas parfaitement liées.
- Ajouter des fallbacks robustes pour retrouver la bonne mission opérationnelle même si le numéro ou le trajet ne matchent pas exactement.

### 2. Réparer le détail mission côté client
- Faire apparaître systématiquement le bloc de suivi en temps réel quand une attribution existe.
- Afficher clairement les états de mission, l’avancement, la carte et l’ETA quand des positions existent.
- Ajouter la récupération visible côté client des éléments attendus:
  - carte grise
  - PV de livraison / restitution
  - signatures
  - photos d’inspection
  - PDF final / EDL quand partagé
  - autres documents mission visibles client

### 3. Corriger les droits d’accès backend des clients
- Ajuster les règles d’accès pour que les clients voient bien les pièces de leur propre mission, y compris pour les dossiers issus de devis et pas seulement certains flux.
- Corriger les règles sur les tables de preuves mission qui bloquent aujourd’hui l’affichage:
  - signatures
  - selfies / photos selon le cas
  - éléments d’inspection liés à la livraison
- Vérifier que les règles restent privées et limitées au propriétaire de la mission.

### 4. Réparer la vue admin GPS “style dispatch live”
- Corriger le chargement admin pour qu’il utilise bien l’identifiant d’attribution quand on ouvre une mission opérationnelle.
- Réafficher le flux GPS, les étapes temps réel et l’activité live dans le détail admin.
- Vérifier la cohérence entre la liste des attributions et le détail mission admin.

### 5. Compléter la surface documentaire dans les vues
- Harmoniser ce qui est visible dans le détail client et dans le détail admin.
- S’assurer que les documents de livraison/restitution et les pièces essentielles sont réellement consultables, pas seulement stockés.
- Garder la séparation entre documents internes et documents partageables client.

### 6. Validation
- Vérifier qu’un clic sur mission client ouvre bien une vue utile avec suivi et pièces.
- Vérifier qu’un admin voit bien une carte GPS active sur une mission en cours.
- Vérifier qu’une mission sans GPS n’affiche pas un écran vide mais un état métier propre.

## Détails techniques
- Frontend: correction des routes/detail pages client + admin, fallback de résolution des relations, affichage documentaire.
- Backend: ajustement des politiques d’accès sur les tables mission concernées pour les clients authentifiés propriétaires.
- Données: pas de refonte fonctionnelle globale, uniquement les liaisons et accès nécessaires pour que l’existant fonctionne vraiment.

## Résultat attendu
- Un client clique sur une mission et voit enfin:
  - suivi GPS live si disponible
  - étapes mission
  - photos
  - signatures
  - PV / CG / documents
  - PDF final partagé
- Un admin ouvre une mission et voit une vraie vue de dispatch avec la position live et les preuves associées.