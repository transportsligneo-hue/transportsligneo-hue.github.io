## Phase 3 — Finitions Espace Pro/Client

Suite de la phase 2. Trois chantiers ciblés, sans toucher au reste.

### 1. Page "Mes demandes" côté Pro avec statut visible
**Fichier :** `src/routes/_authenticated/dashboard-pro.missions.tsx` (audit + ajout d'un onglet "Demandes")

- Ajouter une vue unifiée listant `demandes_convoyage` + `devis` + `missions` du user connecté
- Colonnes : N°, date, trajet (départ → arrivée), véhicule, prix, **statut clair** (En attente / Devis envoyé / Payé / En cours / Terminé / Annulé)
- Badges colorés cohérents avec le design system (midnight + gold)
- Filtres : statut + période
- Lien vers le détail mission existant quand applicable

### 2. Audit visuel du recap mission (QuickMissionForm)
**Fichier :** `src/components/dashboard-pro/QuickMissionForm.tsx`

- Améliorer le bloc "Récapitulatif & prix" : hiérarchie claire (prix dominant, détails secondaires)
- Mode HT/TTC/Exempt affiché de manière explicite (badge + libellé)
- Contacts opérationnels regroupés dans une carte dédiée
- Bouton de soumission collant en bas sur mobile

### 3. Page "Mes demandes" côté Client particulier
**Fichier :** `src/routes/_authenticated/dashboard-client.missions.tsx`

- Même logique que pour le Pro mais adaptée au particulier
- Affichage simplifié (pas de notion HT/TTC, juste TTC)
- Statuts en langage naturel ("Votre devis est prêt", "Convoyeur en route", etc.)

### Hors scope
- Pas de nouvelle migration SQL
- Pas de refonte du flow paiement
- Pas de changement sur l'admin

### Tests
- Pro voit toutes ses demandes, peu importe leur état (brouillon → terminée)
- Statuts cohérents et lisibles
- Récap mission lisible sur mobile et desktop
- Client particulier voit ses demandes avec wording adapté