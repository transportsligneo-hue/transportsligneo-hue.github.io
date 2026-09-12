# Organisations multi-sites (couche additive)

Objectif : permettre à un client comme CAT de regrouper plusieurs agences (Tours, Bourges, Marseille…) sans rien changer pour un client qui n'a qu'un seul site. Tout est additif : aucun écran existant n'est supprimé, aucun sélecteur de site n'apparaît tant qu'une organisation n'a pas au moins deux sites.

## Règle de non-régression

- CAT Tours (un seul site) : mêmes écrans, même navigation, aucune mention "organisation" ou "site".
- Les nouveaux éléments d'interface (sélecteur de site, vue consolidée, colonne "Site") s'affichent uniquement si l'organisation a 2 sites ou plus.
- Vérification du compte CAT après chaque étape.

## 1. Base de données

La table des sites existe déjà (`organization_sites`) mais n'est pas utilisée. On complète :

- `organization_sites` : ajout de `est_siege` (booléen, faux par défaut, jamais imposé) et `siret_etablissement`.
- Nouvelle table `site_contacts` : un ou deux contacts propres à chaque site (nom, prénom, téléphone, email, rôle principal/secondaire), rattachement obligatoire à un site — jamais à l'organisation.
- Ajout d'un `site_id` **optionnel** sur `missions`, `trajets` (via missions), `organization_members` et rappel de celui déjà présent sur `vehicles` et `conducteurs_flotte`.
- Nouvelle table `site_transfers` : historique d'audit (quoi, de quel site à quel site, par qui, quand).
- Organisation : champ `facturation_mode` (`consolidee` | `par_site`, défaut consolidée), `siret_siege` optionnel.
- Intégrité : un site appartient toujours à une organisation (clé étrangère non nulle) ; supprimer un site ne touche ni l'organisation ni les autres sites.
- Accès : les membres voient les données de leur(s) site(s) ; un "Administrateur organisation" voit tous les sites.

## 2. Reprise des données CAT

- L'organisation "CAT FRANCE" existe déjà : on la conserve telle quelle.
- Création du site "CAT Tours" rattaché à cette organisation, `est_siege = false`.
- Rattachement de l'existant (véhicules, missions, membres, historique) à ce site, sans perte.
- Le contact Morgane Landais est créé comme contact principal du site CAT Tours uniquement.
- Les identifiants de connexion actuels restent inchangés.

## 3. Administration des sites

Dans la fiche organisation de l'admin, un nouvel onglet "Sites" :
- créer un site à tout moment (nom, adresse, SIRET facultatif, aucun siège obligatoire) ;
- gérer ses 1 à 2 contacts ;
- transférer un véhicule, un conducteur ou un utilisateur d'un site vers un autre de la même organisation, avec trace dans l'historique.

## 4. Vue consolidée / par site (espace client)

- Organisation mono-site : rien ne change, l'utilisateur reste sur ses écrans actuels.
- Organisation multi-sites : un sélecteur discret "Tous les sites / Site X" apparaît en tête des écrans flotte (accueil, missions, véhicules, factures & devis) pour les administrateurs d'organisation. Un utilisateur rattaché à un site ne voit que son site, sans sélecteur.
- Dans la vue "Tous les sites", une section liste les sites avec leurs contacts côte à côte.

## 5. Contacts dans les communications

Les emails et SMS liés à une mission (confirmation, livraison, demande de signature) utilisent le contact du site de la mission, jamais celui d'un autre site. La fiche mission affiche ce contact.

## 6. Conducteurs optionnels

La section conducteurs devient facultative : un site peut fonctionner uniquement avec sa liste de véhicules. Aucun blocage si aucun conducteur n'est associé ; un message d'invitation remplace l'écran vide.

## 7. Facturation

Choix par organisation : facturation consolidée (une facture pour tous les sites) ou une facture par site. Le regroupement des devis/factures suit ce réglage ; par défaut consolidée, comportement identique à aujourd'hui.

## 8. Ordre de réalisation

1. Migration base (tables + colonnes + règles d'accès) — invisible côté client.
2. Reprise des données CAT + vérification du compte CAT.
3. Onglet Sites côté admin (création, contacts, transferts, historique).
4. Sélecteur de site et vue consolidée côté client, conditionnés à 2+ sites.
5. Contacts par site dans les communications et la fiche mission.
6. Conducteurs optionnels + réglage de facturation.

## Détails techniques

- Nouvelles tables en `public` avec GRANT + RLS scopée (membre du site, admin d'organisation, admin Ligneo).
- Fonction d'aide `public.user_site_ids(uuid)` en SECURITY DEFINER pour éviter la récursion RLS.
- Les colonnes `site_id` sont ajoutées nullables puis remplies par backfill : aucun code existant ne casse.
- Filtres site appliqués côté requêtes via un hook `useFleetSiteScope()` qui renvoie `null` (aucun filtre) quand l'organisation a un seul site.
