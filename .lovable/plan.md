## Objectif

Un seul système d'affichage détail dans tout l'admin : le **drawer latéral bleu premium** (`AdminDetailDrawer`) déjà utilisé sur la page Utilisateurs. Plus aucune page séparée `/$id`, plus aucune modale. Et : remplir correctement le drawer Utilisateurs avec les vraies données.

---

## Périmètre

### Pages à convertir au drawer (suppression des routes `$id`)
- `admin/devis` → drawer Devis (supprime `admin.devis.$devisId.tsx`)
- `admin/missions` (via attributions) → drawer Mission (supprime `admin.missions.$missionId.tsx` côté admin)
- `admin/clients` → drawer Client (supprime `admin.clients.$clientId.tsx`)
- `admin/factures` → drawer Facture (supprime `admin.factures.$factureId.tsx`)
- `admin/demandes` → drawer Demande (supprime `admin.demandes.$demandeId.tsx`)
- `admin/convoyeurs` → drawer Convoyeur (supprime `admin.convoyeurs.$convoyeurId.tsx`)
- `admin/trajets`, `admin/paiements`, `admin/attributions` → drawer dédié

Tous les `<Link to="/admin/.../$id">` et `navigate({ to: ... })` remplacés par `setSelected(row)` qui ouvre le drawer. Les boutons œil et lignes cliquables déclenchent le même drawer.

### Drawer Utilisateurs — bug données vides

Cause racine identifiée :
1. `devis / factures / demandes` filtrés uniquement par `email` exact (sensible casse, NULL ignorés).
2. Téléphone et adresse parfois absents en base (formulaires d'inscription ne demandent pas l'adresse).
3. `paiements` ne récupèrent que ceux des `devis` (pas les `b2b_transport_requests` ni `factures`).
4. `logs` filtrés sur `entity_id = user_id` uniquement → invisible pour entités liées (devis, missions).

Corrections :
- Requêtes par `lower(email) = lower(?)` + fallback `user_id` quand présent (`devis.user_id`, `demandes_convoyage.user_id`).
- Récupérer paiements depuis `devis.paid_at`, `factures.statut='payee'`, `b2b_transport_requests.payment_status='paid'`.
- Récupérer `logs` par `actor_user_id = user_id OR entity_id = user_id`.
- Ajouter section **Inscription** avec date, source (formulaire utilisé), métadonnées.
- Charger `auth.users.user_metadata` via edge function `admin-user-actions` (action `get_user_full`) pour récupérer téléphone/adresse stockés en metadata si absents du profil.

### Inscription — champs manquants en base
- Ajouter champ **adresse** (optionnel) aux 4 formulaires (`inscription-client/pro/flotte/convoyeur`).
- Passer `adresse` dans `raw_user_meta_data` au `signUp`.
- Migration : étendre `handle_new_user()` pour copier `adresse` dans `profiles.adresse`.
- Téléphone : déjà obligatoire, vérifier mapping dans le trigger (OK).

---

## Architecture cible

```text
Liste admin (table)
  └── clic ligne / œil / 3 points
        └── setSelected(row)
              └── <XxxDetailDrawer xxx={selected} onClose={...} onChanged={refresh} />
                    └── AdminDetailDrawer (Sheet bleu, déjà existant)
                          ├── Header (titre + sous-titre + badges)
                          ├── Tabs (Détails / Historique / Documents / Logs)
                          └── Footer (actions : modifier, supprimer, statut, etc.)
```

Toutes les vues détail héritent du même `AdminDetailDrawer` + `DrawerSection` + `DrawerField` + `DrawerGrid` + `DrawerBadge` (déjà dispo dans `src/components/admin/AdminDetailDrawer.tsx`).

---

## Étapes d'implémentation

1. **Fix drawer Utilisateurs (priorité 1)**
   - Patch `UserDetailDrawer` : requêtes case-insensitive + fallback `user_id`, agrégation paiements multi-source, logs élargis.
   - Édition du téléphone/adresse depuis le drawer (action `update_profile`).

2. **Drawers métier** (un fichier par entité dans `src/components/admin/drawers/`)
   - `DevisDrawer.tsx`, `MissionDrawer.tsx`, `ClientDrawer.tsx`, `FactureDrawer.tsx`, `DemandeDrawer.tsx`, `ConvoyeurDrawer.tsx`, `TrajetDrawer.tsx`, `PaiementDrawer.tsx`.
   - Chaque drawer : props `{ id, open, onClose, onChanged }`, charge ses données, affiche en sections + footer d'actions.

3. **Conversion des pages liste**
   - Pour chaque `admin.<entity>.tsx` : supprimer les `<Link>` détail, ajouter `useState<XxxRow|null>(null)`, monter le drawer en bas du composant.
   - `admin.attributions.tsx`, `admin.index.tsx` : remplacer les liens vers `/$id` par ouverture drawer (état levé ou navigation contrôlée).

4. **Suppression des routes détail**
   - Supprimer les 6 fichiers `admin.<entity>.$id.tsx` côté admin (le routeTree se régénère).
   - Garder les routes détail côté client/convoyeur (hors admin).

5. **Migration & inscription**
   - Migration SQL : `handle_new_user()` ajoute `adresse` depuis metadata.
   - Ajouter input adresse aux 4 formulaires d'inscription + envoi dans `data:` du `signUp`.

6. **Edge function**
   - Étendre `admin-user-actions` avec action `get_user_full` (lit auth.users + profile + convoyeur, fusionne).

---

## Détails techniques

- **Bleu électrique** : déjà dans `AdminDetailDrawer` (gradient `#0b1026 → #0d1430`, accents `bg-blue-500/15`).
- **Largeur** : `width="2xl"` pour drawers riches (mission/client), `xl` par défaut.
- **Animations** : héritées du `Sheet` shadcn (slide-in droit, 300ms).
- **Fermeture** : clic en dehors, touche Échap, croix.
- **Scroll interne** : `overflow-y-auto` sur le body, header/footer fixes.
- **Deep-linking optionnel** : on garde l'URL inchangée (drawer = état UI), pas de routing. Si besoin partage URL plus tard : query param `?selected=<id>` géré par chaque page liste.

---

## Hors périmètre
- Refonte des pages côté client/convoyeur (uniquement admin).
- Changement de thème global hors drawer.
- Migration des modales d'action (AlertDialog confirmations restent inline).
