## Phase 2 — Espace Pro/Client : suite de la refonte

Suite logique de la phase 1 (DB + QuickMissionForm + tarifs perso). Quatre chantiers indépendants à dérouler dans cet ordre.

### 1. Vue Driver — contacts opérationnels
**Fichier :** `src/components/mission/MissionCockpit.tsx` (et composants associés si besoin)

- Ajouter un bloc "Contacts sur place" dans les étapes Départ et Arrivée
- Afficher `contact_depart_nom/tel/note` et `contact_arrivee_nom/tel/note` depuis `missions`/`trajets`/`attributions`
- Boutons d'action mobile :
  - `<a href="tel:...">` pour appeler
  - `<a href="sms:...">` pour SMS
- Masquer les blocs si aucun contact n'est renseigné (rétro-compat missions existantes)

### 2. Admin — fiche client enrichie
**Fichier :** `src/routes/_authenticated/admin.clients.$clientId.tsx`

- Section "Configuration tarifaire et fiscale" :
  - Select `pricing_display_mode` : TTC (défaut particulier) / HT (défaut pro) / Exonéré TVA
  - Textarea `tva_exemption_note` (visible uniquement si mode = exempt) — ex. "TVA non applicable, art. 293 B du CGI"
  - Textarea `facture_mention_legale` (override par client, vide = utilise la mention globale)
- Section "Règles tarifaires personnalisées" :
  - Liste des `client_pricing_rules` existantes pour ce client
  - CRUD inline : ajouter/éditer/supprimer une règle (depart, arrivee, trip_type, prix_ht, prix_ttc, actif)
  - Matching automatique par `user_id` ou `email`

### 3. Paramètres globaux — mention légale facture
**Fichier :** `src/routes/_authenticated/admin.parametres.tsx` (créer la section si nécessaire)

- Lire/écrire dans `app_settings` (clé `facture_mention_default`)
- Textarea pour la mention par défaut appliquée à toutes les factures sans override client
- Toggle global `facture_mention_active` (afficher ou non la mention)

### 4. PDF Facture — mention conditionnelle
**Fichier :** `src/lib/facture-pdf.ts`

- Charger en amont : `profile.facture_mention_legale` du client + `app_settings.facture_mention_default`
- Priorité : mention client > mention globale > rien
- Afficher la mention en pied de facture (sous totaux, avant footer légal)
- Gérer le mode `exempt` : remplacer le bloc TVA par `tva_exemption_note` ("TVA non applicable, art. 293 B du CGI")
- Vérifier que le calcul HT/TTC respecte `pricing_display_mode` du client

### Détails techniques

**Resolver mention légale** (nouveau helper dans `src/lib/invoice-settings.ts`) :
```ts
resolveInvoiceMention({ userId }) → { mention: string | null, exemptionNote: string | null }
```
Lit profile + app_settings, retourne la mention à imprimer.

**Pas de nouvelle migration SQL** — toutes les colonnes nécessaires ont été créées en phase 1.

**Tests à valider :**
- Mission avec contacts → driver voit les boutons tel/SMS sur mobile
- Client CAT France configuré en HT → estimateur affiche HT, facture affiche HT
- Client particulier en exempt → facture sans ligne TVA, avec note 293 B
- Mention globale modifiée → toutes les factures futures l'affichent
- Override client → prime sur la mention globale

### Ce qui n'est PAS dans cette phase

- Refonte visuelle du `DevisGenerator` (audit lisibilité) — à faire en phase 3 si besoin
- Page "Mes demandes" côté client avec statut visible — à faire en phase 3
- Migration des anciennes missions sans contacts opérationnels (rétro-compat assurée par nullable)
