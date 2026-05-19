## Constat (rapide)

- Recherche plaque : l’API renvoie bien les champs `AWN_VIN`, `AWN_marque`, `AWN_modele`, etc. (vu dans les logs serveur pour `GR452PE`). Le mapping `AWN_*` existe déjà dans le code, mais les logs montrent qu’il n’a pas encore pris effet en preview (pas de logs preview du tout). Il faut donc valider le mapping côté serveur réellement déployé et renforcer le parser (objets imbriqués + fallback générique).
- Demande / compte client : un devis fait sans compte n’est pas auto-rattaché quand le client se crée ensuite (rien ne fait le « backfill » des `devis.user_id` / `demandes_convoyage.user_id` au signup). Le dashboard client lit déjà les devis par email (RLS OK), mais l’écran « Mes missions » filtre uniquement par `user_id` → invisible tant que pas converti.
- Admin : pas d’édition directe des coordonnées (nom, email, société, etc.), pas d’invitation par email, juste « créer compte avec mot de passe ».

## Travail à faire

### 1) Recherche plaque — fiabiliser

Fichier : `src/lib/plate.functions.ts` uniquement.

- Étendre `pick()` pour traverser correctement les objets imbriqués retournés par l’API (certaines réponses arrivent sous `data.data.AWN_*` selon les plans RapidAPI).
- Ajouter une étape de « walk » récursif : si aucun champ trouvé au 1er niveau, scanner les sous-objets pour trouver les clés `AWN_*`.
- Ajouter un fallback final : si on a au moins `AWN_VIN` ou `AWN_marque`, on renvoie `ok: true` même partiel (au lieu de « aucune donnée »).
- Toujours logguer `[SIV] mapped` (résultat final) pour vérifier en prod après publish.

UI : ne pas toucher. Aucun changement de design.

### 2) Lien demande → compte → espace client

#### a) Backfill automatique au signup

Migration SQL (nouveau trigger `on_auth_user_created` complémentaire, non destructif) :

- Fonction `public.backfill_user_links()` SECURITY DEFINER qui, pour un `auth.users.id`, fait :
  - `UPDATE public.devis SET user_id = NEW.id WHERE user_id IS NULL AND lower(email) = lower(NEW.email)`
  - `UPDATE public.demandes_convoyage SET user_id = NEW.id WHERE user_id IS NULL AND lower(email) = lower(NEW.email)`
  - `UPDATE public.missions SET user_id = NEW.id WHERE user_id IS NULL AND lower(email) = lower(NEW.email)` (no-op aujourd’hui car NOT NULL, mais safe)
- Trigger AFTER INSERT sur `auth.users` qui appelle cette fonction.
- Re-trigger aussi après mise à jour d’email dans `auth.users` (cas admin change email).

Aucun changement de schéma sur les tables existantes.

#### b) RLS

Les politiques actuelles autorisent déjà la lecture des devis et demandes par email (`auth.jwt() ->> email`). On garde. On ajoute juste la même politique côté `missions` (SELECT par email) pour ne pas perdre l’historique si une mission a été créée avant l’existence du compte. Pas de DELETE/UPDATE ouvert.

#### c) Dashboard client

- `dashboard-client/missions.tsx` : remplacer le filtre `eq("user_id", user.id)` par `or(user_id.eq.<id>, email.eq.<email>)` (même pattern que la page Devis). Pas de changement visuel.
- `dashboard-client/index.tsx` : afficher aussi les **devis en cours non encore convertis** dans la zone existante « Mes devis » (déjà présent) + ajouter un compteur dans les stats du haut (« Devis »), à côté de « En cours / À venir / Terminées ».

Ne pas casser le design : on réutilise `StatCard` + `card-premium`.

### 3) Estimateur — création de compte optionnelle (sans casser)

Dans `DevisGenerator.tsx` :

- Le devis et la `demande_convoyage` sont déjà insérés. On garde.
- Rendre la création de compte **optionnelle** : si l’utilisateur ne met pas de mot de passe, on continue (devis simple sans compte). S’il met un mot de passe, on tente le `signUp` comme aujourd’hui. Le backfill SQL (1.a) rattachera plus tard quand il créera son compte.
- L’UI reste inchangée, juste le mot de passe devient optionnel.

Mobile : aucun changement (déjà sans compte).

### 4) Dashboard super admin — éditer la fiche client

Fichier : `src/routes/_authenticated/admin.clients.$clientId.tsx`.

- Édition **directe sur la page** (choix retenu) : transformer chaque `AdminField` (Coordonnées + bloc Société/Facturation) en input éditable. Champs : prenom, nom, email, telephone, societe, siret, adresse, type_client.
- Bouton « Enregistrer » par bloc, garde-fou : `has_role(admin|super_admin)` côté RLS profiles (déjà OK pour UPDATE via politique admin à ajouter — on ajoute une policy `Admins can update profiles`).
- Modification d’email : **modal de confirmation** obligatoire avant validation, plus appel à `admin-user-actions` (nouvelle action `change_email`) qui :
  1. Appelle `admin.auth.admin.updateUserById(user_id, { email })` (Supabase).
  2. Met à jour `profiles.email`.
  3. Met à jour `devis.email` et `demandes_convoyage.email` pour ne pas perdre le rattachement par email.
  4. Trace dans `activity_logs`.

Champs TVA / informations de facturation : on ajoute 2 colonnes dans `profiles` (`tva_intra text`, `adresse_facturation text`) via migration. Pas de breaking change (NULL).

### 5) Invitation par email (en plus de la création directe)

Choix retenu : **garder les deux**. On ne touche pas au formulaire existant `CreateAccountDialog`, on ajoute :

- Edge function `admin-invite-account` (nouveau) qui :
  - Vérifie le rôle admin/super_admin.
  - Appelle `admin.auth.admin.inviteUserByEmail(email, { redirectTo: <site>/reset-password, data: { role, type_client, ... } })`.
  - Insère un profil minimal vide si besoin (sinon créé par `handle_new_user` au moment où l’invité finalise).
  - Trace dans `activity_logs`.
- Template email d’invitation : le template `invite.tsx` existe déjà côté React Email, on le réutilise (Supabase Auth gère l’envoi via le hook auth-email).
- Sur la fiche client : 3 nouveaux boutons (réservés admin/super_admin) :
  - « Envoyer une invitation »
  - « Renvoyer l’invitation » (re-appelle la même edge function)
  - « Envoyer lien réinitialisation mot de passe » (utilise `admin-user-actions` action `reset_password` existante).
- Statut visible dans le bandeau : `invité` / `compte créé` / `email vérifié`, calculé via `auth.users.email_confirmed_at` (lu par l’edge function et renvoyé en lecture-only).

Quand le compte est finalisé, le trigger `backfill_user_links` (étape 2a) recolle automatiquement toutes les missions/devis/demandes existants au nouvel `user_id`.

### 6) Filets de sécurité

- Modification email : confirmation explicite (modale « Confirmez la modification de l’email »).
- Toutes les actions sensibles passent par les edge functions `admin-create-account` / `admin-user-actions` / `admin-invite-account` qui re-vérifient le rôle.
- Aucun script ne touche aux missions existantes en SUPPRESSION : uniquement des `UPDATE` ciblés par email.
- Pas de modification de `handle_new_user`, on ajoute un trigger séparé pour ne rien casser.

## Détails techniques

```text
SQL (migration, additive uniquement)
├─ ALTER TABLE profiles ADD COLUMN tva_intra text, adresse_facturation text
├─ CREATE POLICY "Admins can update profiles" ON profiles FOR UPDATE TO authenticated
│     USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'))
├─ CREATE POLICY "Admins/clients read missions by email" ON missions FOR SELECT TO authenticated
│     USING (auth.uid() = user_id OR lower(email) = lower(auth.jwt()->>'email')
│            OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'))
├─ CREATE FUNCTION backfill_user_links() ... SECURITY DEFINER
└─ CREATE TRIGGER trg_backfill_user_links AFTER INSERT OR UPDATE OF email ON auth.users
```

```text
Code
├─ src/lib/plate.functions.ts             # parser plus tolérant + log mapped
├─ src/components/DevisGenerator.tsx      # mot de passe optionnel (UI inchangée)
├─ src/routes/_authenticated/dashboard-client.missions.tsx       # filtre user_id OR email
├─ src/routes/_authenticated/dashboard-client.index.tsx          # stat « Devis » + bloc devis
├─ src/routes/_authenticated/admin.clients.$clientId.tsx         # édition directe + actions invitation
├─ supabase/functions/admin-invite-account/index.ts              # nouvelle edge function (invite)
└─ supabase/functions/admin-user-actions/index.ts                # ajouter action change_email
```

Aucune modification au tunnel de réservation, au calcul de prix, au flux Stripe, au webhook, aux missions actuelles, ni au design existant.
