## Refonte Dispatch Premium — Trajets / Attribution / Publication / Missions

Objectif : transformer la gestion admin en vraie plateforme de dispatch automatisée, sans casser les flux backend existants (webhooks Stripe, RLS, séquences MIS-TLG).

---

### 1. Modèle de données (migration ciblée, non destructive)

Ajouts sur `trajets` :
- `devis_id` (uuid, nullable) — lien direct devis source
- `prix_client` (numeric) — repris auto du devis
- `mode_attribution` (text: `prix_fixe` | `enchere`) — défaut `prix_fixe`
- `commission_convoyeur_pct` (numeric, défaut 65)
- `prix_convoyeur` (numeric, calculé)
- `prix_societe` (numeric, calculé)
- `statut_publication` (text: `brouillon` | `pret_publier` | `publie` | `attribue` | `en_cours` | `termine`)
- `published_at` (timestamptz)

Trigger DB :
- `calc_prix_trajet` : au INSERT/UPDATE recalcule `prix_convoyeur = prix_client * pct/100` et `prix_societe = prix_client - prix_convoyeur`.
- `auto_create_trajet_from_devis` : quand `devis.paid_at` passe non-null, créer trajet en `brouillon` avec `prix_client = devis.prix_estime`.

Aucune suppression de colonne existante — compat ascendante garantie.

---

### 2. Automatisation Devis payé → Trajet

Dans `src/routes/api/public/devis/webhook.ts` (déjà en place) : à la réception du `checkout.session.completed`, après update du devis, créer automatiquement un trajet lié (`statut_publication = brouillon`, mode par défaut `prix_fixe`).

---

### 3. Logique d'attribution

**Prix fixe** :
- Publication → visible immédiatement chez tous les convoyeurs validés.
- Premier qui accepte → INSERT `attributions` (statut `accepte`) + UPDATE `trajets.statut_publication = attribue` en transaction.
- Pas de validation admin.

**Enchère** :
- Convoyeurs créent des `mission_offres` (table déjà existante).
- Admin compare, valide → crée l'attribution manuellement.

Server function `acceptMissionFixe(trajet_id)` avec `requireSupabaseAuth` + lock SQL (`SELECT … FOR UPDATE`) pour éviter race conditions.

---

### 4. UI Admin — Page Trajets refondue

Remplacer la page `admin.trajets.tsx` actuelle :
- Liste avec colonnes : N°, Client, Devis, Trajet, Prix client, Mode, Statut publication, Convoyeur attribué.
- Filtres par statut, mode.
- Click ligne → **Drawer latéral** (pas de modal) avec blocs :
  - Bloc Client (nom, email, tel)
  - Bloc Devis (numéro, montant, lien)
  - Bloc Prix (input pct convoyeur, calcul live, lecture seule prix_client)
  - Bloc Attribution (radio prix fixe / enchère, bouton Publier)
  - Bloc Convoyeur (assigné ou liste offres si enchère)
  - Bloc Statut / Timeline (devis → trajet → publié → attribué → en cours → terminé)
  - Bloc Paiement (statut Stripe)

Suppression du bouton œil → toute la fiche dans le drawer.

---

### 5. UI Driver — Missions disponibles

`convoyeur.disponibles.tsx` :
- Affiche tous les trajets `statut_publication = publie` ET convoyeur non encore attribué.
- Badge `Prix fixe` (vert) ou `Enchère` (or).
- Bouton **Accepter** (prix fixe, attribution instantanée) ou **Proposer** (enchère, ouvre modal offre).
- Realtime via Supabase channel sur `trajets`.

Sur accueil driver (`convoyeur.index.tsx`) : widget "Nouvelle mission disponible" si au moins une.

---

### 6. Statuts unifiés

```
Devis     : envoye → accepte → paye
Trajet    : brouillon → pret_publier → publie → attribue → en_cours → termine
Offre     : en_attente → accepte → refuse
```

Badges centralisés dans `StatusBadge.tsx` (déjà existant) — étendre avec mappings `trajetStatutKind` et `modeAttributionKind`.

---

### 7. Découpage en étapes livrables

1. **Migration DB** (colonnes + triggers) — étape isolée à valider
2. **Webhook devis** : auto-create trajet
3. **Page admin trajets** refonte (drawer + bloc prix auto)
4. **Server fn** `acceptMissionFixe` + RLS adjustments
5. **UI driver** missions disponibles + realtime
6. **Polish** : badges, timeline, accueil driver

Chaque étape testable indépendamment, rien ne casse l'existant tant que les anciens champs (`prix`, `statut`) restent peuplés.

---

### Périmètre exclu (pour cette PR)

- Pas de modification du flow paiement Stripe actuel
- Pas de changement RLS sauf ajout policy pour `acceptMissionFixe`
- Pas de refonte des autres pages admin (factures, clients, etc.)

---

**Question avant de commencer** : je lance la migration DB (étape 1) en premier — ok ? Ou tu préfères que je découpe encore plus finement (ex : commencer juste par le drawer admin sur l'existant, sans migration) ?
