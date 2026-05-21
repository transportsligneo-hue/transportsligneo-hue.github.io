## Objectif
Centraliser la gestion des **prix personnalisés** et des **adresses favorites** d'un client Partner directement dans la fiche **Organisation** de l'admin, et supprimer l'entrée séparée "Clients" qui dédoublait l'information.

## Changements

### 1. Fiche Organisation (`admin.organisations.$orgId.tsx`)
Ajouter deux nouveaux onglets dans le `Tabs` existant :
- **Tarification** → rend `<ClientPricingRulesBlock clientUserId={ownerUserId} />`
- **Adresses** → rend `<ClientDefaultAddressesBlock clientUserId={ownerUserId} clientEmail={ownerEmail} />`

Le `ownerUserId` est résolu depuis `organization_members` : on prend le membre avec `member_role = 'owner'` (fallback : 1er membre actif). Si l'organisation n'a aucun membre rattaché → afficher un message "Aucun utilisateur rattaché à cette organisation, impossible de configurer les prix/adresses" + bouton "Inviter un membre".

Charger en plus `profiles(email)` du owner pour passer `clientEmail` au bloc adresses.

### 2. Sidebar admin (`_authenticated/admin.tsx`)
- **Garder** l'entrée "Organisations" (point d'entrée unique)
- Ne PAS ajouter d'entrée "Clients" séparée
- Optionnel : ajouter un filtre rapide "Partners only" sur la page `/admin/organisations` (filtre `role = client_b2b OR flotte_partenaire`)

### 3. Page `/admin/clients` existante
- La conserver fonctionnelle (pas de suppression) pour ne pas casser les liens existants
- Ajouter en haut un bandeau d'info : "Cette page est dépréciée. Gérez désormais vos clients depuis Organisations →"

## Hors scope
- Pas de migration BDD (les blocs prix/adresses restent indexés par `user_id`)
- Pas de modification de `ClientPricingRulesBlock` ni `ClientDefaultAddressesBlock` (juste réutilisation)
- Pas de changement du formulaire client "Nouvelle mission"
- Pas de fusion des données existantes

## Fichiers touchés
- `src/routes/_authenticated/admin.organisations.$orgId.tsx` (ajout 2 onglets + fetch owner)
- `src/routes/_authenticated/admin.clients.tsx` (ajout bandeau dépréciation)