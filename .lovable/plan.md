
# Refonte admin premium — ERP/CRM type grand groupe

Plan structuré pour transformer l'admin actuel en plateforme de pilotage complète, sans casser le backend existant. Découpé en 3 lots livrables.

---

## LOT 1 — Nettoyage, structure & contrôle utilisateurs

### 1.1 — Sidebar premium simplifiée
- Réorganiser `src/routes/_authenticated/admin.tsx` :
  - **Pilotage** : Tableau de bord, Notifications
  - **Comptes** : Utilisateurs, Organisations, Convoyeurs, Documents
  - **Activité** : Devis, Demandes, Messages
  - **Opérations** : Trajets, Attributions
  - **Finance** : Factures, Paiements
  - **Système** : Historique, Paramètres
- **Masquer** : Dispatch B2B + CRM Flotte (pas opérationnels) → flag `hidden`
- Typo plus claire, hiérarchie visuelle resserrée, dégrouper `Clients particuliers` (fusionné dans Utilisateurs)

### 1.2 — Utilisateurs : contrôle total
Refonte `admin.utilisateurs.tsx` avec **drawer détail** (pas modale) :
- Liste : avatar, nom, email, rôle, type, statut, date inscription, dernière connexion
- Filtres : rôle, type (particulier/pro/B2B/convoyeur/admin), statut
- Drawer détail (onglets) :
  - **Profil** : édition prenom/nom/téléphone/societe/siret/type_client
  - **Rôle & accès** : changer rôle (`user_roles`), suspendre/réactiver (`profiles.statut`), supprimer (soft delete)
  - **Sécurité** : envoyer reset password (admin API), forcer logout
  - **Historique** : devis liés, missions, paiements, documents (lecture seule, liens vers détails)
- Actions rapides en haut : Suspendre, Reset MDP, Supprimer

### 1.3 — Historique d'activité fonctionnel
- La table `activity_logs` existe mais est peu alimentée. Ajouter `log_activity()` aux points clés :
  - Création devis, paiement reçu, trajet publié, mission acceptée, inspection terminée, facture émise
- Refonte `admin.historique.tsx` : timeline chronologique avec icônes, filtre par entity_type/date/acteur, recherche
- Sur chaque page détail (devis, mission, facture) : section "Historique de ce dossier" filtrée

---

## LOT 2 — Finance premium (Factures + Paiements)

### 2.1 — Factures
Refonte `admin.factures.tsx` :
- Tableau : N°, Client, Type, Mission liée, Date, HT, TVA, TTC, Statut (badge couleur)
- Filtres : statut, type (particulier/B2B), période, recherche
- Stats en haut : total émis, payé, en attente, en retard
- Actions par ligne (menu …) : Voir, Télécharger PDF, Envoyer email, Marquer payée, Annuler, Dupliquer
- Drawer détail (réutilise `admin.factures.$factureId.tsx` en mode drawer)

### 2.2 — Paiements & facturation (dashboard finance)
Refonte `admin.paiements.tsx` en vrai cockpit :
- **KPI cards** : CA HT mois, TVA collectée, CA TTC, encours, échecs
- **Tabs** :
  - **Paiements Stripe** (particulier) : liste depuis `devis.paid_at` + `demandes_convoyage.paid_at`
  - **Paiements B2B** : depuis `b2b_transport_requests`
  - **Échecs & remboursements** : statuts `failed`/`refunded`
  - **Échéances** : factures non payées, regroupées par retard
- Graphique CA 12 derniers mois (recharts existant)
- Actions : marquer payée, relancer (email template), rembourser (manuel ref Stripe)

---

## LOT 3 — Trajets/Attribution + Paramètres + Polish

### 3.1 — Trajets : drawer premium
Refonte `admin.trajets.tsx` (déjà commencée) → drawer plein écran avec sections accordéon :
- **Source** : devis lié (numéro, date paiement, montant) — non éditable
- **Trajet** : départ/arrivée/date/véhicule — éditable
- **Prix** : prix client (auto du devis), input `commission_convoyeur_pct` avec preview live 3 colonnes (Client/Convoyeur/Société)
- **Attribution** : radio `prix_fixe` / `enchère`
- **Publication** : bouton "Publier" (statut → `publie`, déclenche `published_at`)
- **Convoyeur** : si attribué, fiche compacte + bouton désattribuer
- **Statut & timeline** : badges + historique étapes
- Suppression boutons œil, suppression modales legacy

### 3.2 — Paramètres & rôles
Refonte `admin.parametres.tsx` en tabs :
- **Entreprise** : logo, signature, coordonnées, mentions facture
- **Facturation** : TVA, numérotation (préfixes/year), conditions de paiement
- **Templates emails** : liste lecture, lien vers preview (`/lovable/email/...`)
- **Stripe** : statut connexion (sandbox/live), webhook URL
- **Rôles & permissions** : tableau matrice (rôle × action), édition par rôle via `user_roles` + table de permissions futures

### 3.3 — Design global admin
- Tokens `--pro-*` déjà en place, renforcer hiérarchie
- Card premium uniforme, badges statuts cohérents (extension `StatusBadge.tsx`)
- Drawer (sheet) systématique pour les détails, plus de modales agressives
- Mobile : refresh `AdminSidebar` drawer, tableaux scrollables, cards stack
- Suppression de tous les boutons œil sans page de destination

---

## Détails techniques

- **Aucune migration DB destructive** : on réutilise tables existantes (`profiles`, `user_roles`, `activity_logs`, `factures`, `devis`, `trajets`, `attributions`)
- **Nouvelle migration mineure** : ajouter quelques `log_activity()` triggers ou plutôt appels côté serveur (préféré, plus contrôlable)
- **Composants partagés** : créer `src/components/admin/AdminDrawer.tsx` (sheet plein écran) + `src/components/admin/KPICard.tsx` + extension `AdminUI.tsx`
- **RLS** : aucun changement, déjà OK pour admin role
- **Auth admin actions** (suspend/delete/reset password) : edge function `admin-user-actions` (admin-only via `has_role`)
- **Pas de framer-motion** (respecte la contrainte projet — CSS/Tailwind only)

---

## Livraison

Volume important — je propose de livrer en **3 messages séquentiels** :
1. **Lot 1** (sidebar + utilisateurs + historique) — la base contrôle
2. **Lot 2** (factures + paiements cockpit) — le finance
3. **Lot 3** (trajets drawer + paramètres + polish) — l'opérationnel

À chaque lot : build vérifié, pas de régression backend.

---

## Question

**Confirme-tu :**
1. Masquage CRM Dispatch B2B + Flotte (oui/non — ou les garder visibles mais marqués "bêta") ?
2. On démarre par le **Lot 1** maintenant ?
