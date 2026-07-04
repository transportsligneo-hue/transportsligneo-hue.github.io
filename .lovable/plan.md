# Plan — 3 chantiers

## 1. Aller-retour → 2 trajets côté admin
Quand un client crée une demande "aller-retour", générer automatiquement **2 lignes de trajet** dans l'admin (aller + retour inversé) au lieu d'un seul enregistrement marqué "AR".

- Détecter le flag `aller_retour` dans `demandes_convoyage` / `devis` / `missions` (à confirmer sur quelle table).
- À la validation admin (ou dès création selon flux actuel), insérer 2 entrées `trajets` :
  - Trajet 1 : départ → arrivée à la date aller
  - Trajet 2 : arrivée → départ à la date retour
- Lier les deux via `mission_parent_id` (ou champ existant) pour regroupement.
- Vues admin `admin.trajets` / `admin.missions` : afficher les deux lignes distinctes avec badge "Aller" / "Retour".

Fichiers probables : `src/routes/_authenticated/admin.demandes.tsx`, `admin.trajets.tsx`, logique de conversion demande→trajet.

## 2. Tapis de sol dans checklist EDL
Ajouter "Tapis de sol" dans les éléments cochables au début de l'état des lieux (avant photos), au même endroit que les autres accessoires (roue de secours, cric, etc.).

Fichier : composant checklist EDL dans `src/components/inspection/` ou `src/components/mission/`.

## 3. Système notifications complet (ADMIN / CLIENT / CONVOYEUR)

### 3.1 Infrastructure
- Table existante `user_notifications` (déjà en base) → utiliser comme historique unifié pour les 3 rôles.
- Table `admin_notifications` déjà en place → conserver pour admin.
- Ajouter colonnes si manquantes : `category` (mission/paiement/document/message/systeme), `priority`, `deep_link`.
- Ajouter table `notification_preferences` (user_id, channel, category, enabled) pour opt-in/out par canal + catégorie.

### 3.2 Helper unifié
Créer `src/lib/notifications/notify.ts` avec API unique :
```
notifyUser({ userId, role, category, title, message, link, email?: {template, data}, push?: bool })
```
- Écrit en DB (`user_notifications` ou `admin_notifications` selon rôle).
- Envoie push web (via `sendPushToUser` existant) si activé dans prefs.
- Enqueue email (via `sendTransactionalEmail`) si `email` fourni et activé.
- Déduplication : hash `(user_id, category, entity_id, event_key)` sur 5 min.

### 3.3 Événements à câbler
**Client** (18 events) : compte créé/validé, demande créée, mission confirmée, convoyeur attribué/en route/arrivé, EDL départ/arrivée, convoyage commencé, incident, retard, heure modifiée, véhicule livré, mission terminée, facture, paiement, annulation, message, document.

**Convoyeur** (24 events) : compte créé/validé, docs refusés/validés, profil incomplet, mission attribuée/modifiée/annulée, rappels J-1 / H-2 / heure départ, arrivée véhicule, EDL non commencé/incomplet/photos manquantes/signature, upload OK, départ oublié, arrivée proche, EDL arrivée, mission terminée, paiement, message, expirations permis/assurance/CNI.

**Admin** (25 events) : nouveaux inscrits, comptes/docs à valider, mission créée/sans convoyeur/urgente/modifiée/annulée/terminée, incident, réclamation, paiements OK/KO, facture, message, erreurs système, sécurité, maintenance, déploiement.

Chaque event = 1 appel `notifyUser(...)` placé au point de déclenchement (server fn ou trigger).

### 3.4 Rappels planifiés (J-1, H-2, expirations docs)
- Cron `pg_cron` (fonction SQL) qui scanne `missions` et `documents_convoyeurs` toutes les heures et enqueue les notifications correspondantes.

### 3.5 Centre de notifications UI
Créer route unique `/notifications` (adaptée par rôle) + widget cloche dans header :
- Compteur non-lues temps réel (Supabase Realtime sur `user_notifications`).
- Liste avec filtres : Toutes / Missions / Paiements / Documents / Messages / Système.
- Recherche texte.
- Actions : marquer lu, tout marquer, supprimer un, supprimer sélection.
- Clic → deep link vers l'écran concerné.
- Page admin `/admin/notifications` déjà existante → mettre à jour au même format + filtres catégories.

### 3.6 Préférences utilisateur
Ajouter section "Notifications" dans :
- `dashboard-client.profil.tsx`
- `convoyeur.profil.tsx`
- `admin.parametres.tsx`

Toggle par catégorie × canal (push/email). Stocké dans `notification_preferences`.

---

## Détails techniques
- **Migration** : ajout colonnes `user_notifications` (category, deep_link, priority, dedup_key), création `notification_preferences`, GRANTs + RLS, index sur (user_id, lu, created_at DESC).
- **RPC** `create_user_notification` SECURITY DEFINER pour insertion depuis server fns avec dedup.
- **Realtime** : `ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notifications` (si pas déjà fait).
- **Emails** : réutiliser templates existants dans `src/lib/email-templates/` (déjà 30+ templates). Ajouter les manquants au fur et à mesure.
- **Push** : `sendPushToUser` / `sendPushToRole` déjà en place.
- **Pas de framer-motion** (règle mémoire), animations CSS/Tailwind.

## Ordre d'exécution proposé
1. Chantier 1 (aller-retour) + chantier 2 (tapis) — petits, rapides.
2. Migration DB + helper `notifyUser` + centre de notifications UI (fondations).
3. Câblage progressif des events par rôle (client → convoyeur → admin).
4. Préférences utilisateur + rappels cron.

## Question avant de partir
Ce chantier notifications est **très gros** (50+ events, migration, UI, cron, prefs). Je propose de livrer en **plusieurs itérations** :
- **Itération A (ce tour)** : chantiers 1 + 2 + fondations notifications (migration, helper, centre UI cloche + page, realtime).
- **Itération B** : câblage events client + convoyeur.
- **Itération C** : câblage events admin + rappels cron + préférences.

OK pour ce découpage ? Ou tu veux que je tente tout d'un coup (risque plus élevé de bugs) ?
