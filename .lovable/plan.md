# Système d'attribution des missions – Catalogue & Acceptation Convoyeur

## Contexte

Le système actuel force l'admin à assigner puis "valider" — incohérent. Objectif : donner le pouvoir d'acceptation au convoyeur, et introduire un vrai catalogue public de missions avec candidatures et contre-offres.

Bonne nouvelle : la base de données possède déjà **80% de la plomberie nécessaire** :
- `trajets.pricing_mode` = `fixe` / `enchere`
- `trajets.statut_publication` = `brouillon` / `publie` / `attribue` / `termine` / `annule` / `archive`
- `attributions.statut` = `propose` / `accepte` / `refusee` / `en_cours` / `en_attente_validation` / `termine`
- Table `mission_offres` pour les candidatures / contre-offres (avec `is_winning`)
- RPC `accept_mission_fixe(_trajet_id)` déjà en place pour le mode "fixe" catalogue
- Trigger `protect_mission_offre_admin_fields` protège `is_winning` (seul l'admin peut désigner le gagnant)

Il faut donc surtout : ajouter le **mode "attribution directe"** manquant, harmoniser les statuts côté UI, et construire les 3 écrans clés (Catalogue convoyeur, Candidatures admin, Choix du mode à la création).

## Livraison en 4 lots (une seule passe, séquentielle)

### Lot 1 — Fondations DB & RPC

Migration Supabase :
- Ajouter `trajets.attribution_mode` enum : `direct` (par défaut, mission déjà attribuée à un convoyeur ciblé) / `catalogue` (visible par tous) / `mixte` (les deux).
- Ajouter `trajets.allow_counter_offer` boolean (défaut `true`) — active/désactive les contre-offres.
- Ajouter `trajets.expires_at` timestamptz (délai d'acceptation, défaut +48h).
- Nouveau RPC `admin_propose_mission_to_convoyeur(_trajet_id, _convoyeur_id, _expires_in_hours)` — crée une attribution `statut='propose'` et notifie le convoyeur.
- Nouveau RPC `driver_respond_to_proposal(_attribution_id, _accept boolean, _reason text)` — bascule `propose` → `accepte` ou `refusee`, met à jour `trajets.statut_publication`, notifie admin.
- Nouveau RPC `driver_apply_to_mission(_trajet_id, _proposed_price, _message)` — insère dans `mission_offres` (candidature ou contre-offre selon `allow_counter_offer`).
- Nouveau RPC `admin_award_offer(_offre_id)` — désigne l'offre gagnante, crée l'attribution, retire du catalogue, notifie tous les autres candidats.
- Nouveau RPC `admin_publish_to_catalogue(_trajet_id)` — bascule `attribution_mode='catalogue'` + `statut_publication='publie'`.
- Cron : expiration auto des propositions dépassées → retour au catalogue si `mixte`, sinon notif admin.

### Lot 2 — Harmonisation des statuts (côté UI/labels)

Créer `src/lib/mission-status.ts` (source unique de vérité) :

```text
proposé (en attente du convoyeur)     → orange, animé
accepté par le convoyeur              → vert
refusé par le convoyeur               → rouge, alerte admin
publié au catalogue                   → bleu, badge "🔥 Disponible"
candidature reçue                     → violet
contre-offre reçue                    → violet + $
attribué (offre acceptée par admin)   → vert foncé
expiré                                → gris
```

- Remplacer partout `admin.trajets.tsx`, `admin.attributions.tsx`, `client.missions*.tsx`, `convoyeur.missions*.tsx` les libellés incohérents ("En attente de validation admin" → "En attente de réponse du convoyeur").
- Composant `<MissionStatusBadge status={...} />` réutilisable (glassmorphism, néon bleu).

### Lot 3 — Espace Convoyeur : catalogue + boutons Accepter/Refuser

**Route existante `/convoyeur/missions/*`** : ajouter un onglet **Catalogue**.
- Composant `CatalogueMissions.tsx` : grille de cartes glassmorphism (départ, arrivée, distance, durée, tarif, badges Premium/AR/Urgent/Longue distance, photos si dispo).
- Filtres : distance max, région, prix min, date, type véhicule, urgence.
- Tri : rémunération / distance / date.
- Recherche instantanée (client-side).
- Bouton **"Je souhaite réaliser cette mission"** → modal :
  - Si `allow_counter_offer=false` : bouton unique "Accepter le tarif"
  - Sinon : champ prix (pré-rempli au tarif proposé) + slider suggestions (+5€, +10€, +20€) + message facultatif.

**Missions déjà proposées** (Mode 1) : bandeau en haut du dashboard convoyeur "📌 Nouvelle mission proposée" avec ✅ / ❌ inline + raison si refus.

### Lot 4 — Espace Admin : mode d'attribution + vue candidatures + dashboard

**À la création/édition d'une mission** (`admin.missions.tsx` + drawer) :
- Sélecteur radio "Mode d'attribution" : Directe / Catalogue / Les deux.
- Si Directe/Mixte : autocomplete convoyeur.
- Toggle "Autoriser les contre-offres".
- Datepicker "Expiration" (défaut +48h).

**Nouvelle route `admin.candidatures.tsx`** : vue des candidatures groupée par mission.
- Ligne convoyeur : nom, note (⭐), missions réalisées, distance depuis le départ, dispo, montant, date/temps de réponse.
- Actions : ✅ Attribuer / ❌ Refuser / 💬 Contre-proposer (modal montant + message).

**Widget dashboard admin** (`admin.tsx`) : cartes KPI
- Missions au catalogue
- Total candidatures reçues
- Convoyeurs actifs sur catalogue
- Temps moyen d'acceptation
- Missions sans candidat > 24h (alerte)
- Missions urgentes en attente

**Écran mission → catalogue** : bouton "Publier au catalogue" quand statut = `refusee` ou `brouillon`.

## Notifications

Réutilise l'infra existante (`create_user_notification`, `create_admin_notification`, `enqueue_email`) + templates email :
- `mission-proposee` (→ convoyeur)
- `mission-acceptee-par-convoyeur` (→ admin + client)
- `mission-refusee-par-convoyeur` (→ admin)
- `nouvelle-candidature` (→ admin)
- `contre-offre-recue` (→ admin)
- `candidature-acceptee` / `candidature-refusee` (→ convoyeur)
- `mission-publiee-catalogue` (→ tous convoyeurs validés, batched)
- `mission-expiree` (→ admin)

Push : via `push_subscriptions` déjà en place, envoi opportuniste.

## Détails techniques

- Routes ajoutées : `/_authenticated/admin.candidatures.tsx`, onglet dans `/_authenticated/convoyeur.missions.tsx`
- Server functions dans `src/lib/attribution.functions.ts` (RPC wrappers, `requireSupabaseAuth`)
- Realtime déjà actif sur `attributions`, `mission_offres`, `trajets` — ajouter subscription dans le catalogue pour "Nouvelle mission" badge live.
- Zéro breaking change : les missions existantes conservent leur mode courant ; `attribution_mode` par défaut = `direct`.

## Ordre de mise en œuvre

Lot 1 (migration DB + RPC) → validation → Lots 2/3/4 en parallèle (frontend uniquement).

Je démarre par **Lot 1** (migration Supabase) et j'attends ton feu vert avant d'enchaîner le frontend.
