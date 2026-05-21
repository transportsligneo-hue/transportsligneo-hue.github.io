## Phase 4 — Factures côté Pro & Client

Les pros n'ont aucune vue sur leurs factures dans leur espace. Cette phase comble ce manque et harmonise l'affichage devis/factures côté client.

### 1. Page Factures côté Pro (nouveau)
**Fichier :** `src/routes/_authenticated/dashboard-pro.factures.tsx` (création)

- Liste des `factures` du user connecté (matching `user_id` ou `email`)
- Colonnes : N°, date, mission liée (n° + trajet), montant (HT/TTC/Exonéré selon `pricing_display_mode`), statut paiement
- Badge statut : Brouillon / Émise / Payée / En retard
- Bouton "Télécharger PDF" par ligne (appelle `facture-pdf.ts` existant)
- Filtre par année + statut
- Lien depuis le menu sidebar Pro

### 2. Sidebar Pro — entrée Factures
**Fichier :** sidebar pro existante (à localiser dans `src/components/dashboard-pro/` ou `dashboard-pro.tsx`)

- Ajouter l'entrée "Factures" entre "Missions" et "Documents"
- Icône `Receipt` (lucide)

### 3. Audit page Devis côté Client
**Fichier :** `src/routes/_authenticated/dashboard-client.devis.tsx`

- Vérifier lisibilité : statut clair, montant en évidence, action principale (payer / télécharger) bien visible
- Pas de refonte structurelle, juste polish visuel sur la liste

### Hors scope
- Pas de modification du PDF lui-même (déjà fait phase 2)
- Pas de gestion paiement Stripe côté pro (sera phase 5 si besoin)
- Pas de relances automatiques

### Tests
- Pro voit ses factures avec HT/TTC selon son mode fiscal
- Téléchargement PDF fonctionne
- Filtre année/statut OK
- Client voit ses devis avec actions claires