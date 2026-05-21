# Plan — Refonte Espace Pro & tarifs personnalisés

## Périmètre & cadrage

L'app expose deux espaces clients :

- **Dashboard Pro** (`/dashboard-pro`) — pour les comptes B2B (CAT France entre dans ce cas). 
- **Dashboard Client** (`/dashboard-client`) — pour les particuliers.

Toutes les corrections demandées s'appliquent au **Dashboard Pro** (c'est là que CAT France se connecte). Les correctifs visuels (textes invisibles dans l'estimateur, suppression CA, contacts opérationnels) sont **répliqués à l'identique sur le Dashboard Client**.

Aucune table existante n'est supprimée. `client_pricing_rules` existe déjà — on s'appuie dessus.

---

## 1. Accueil Pro/Client — retirer estimateur + "CA réalisé"

- `dashboard-pro.index.tsx` : retirer le KPI **CA réalisé**, garder *En cours / À venir / Livrées*. La grille passe de 4 à 3 colonnes.
- Vérifier `dashboard-client.index.tsx` : retirer toute carte « estimateur » présente sur l'accueil et toute carte CA. Garder résumé demandes / missions / factures.

## 2. "Nouvelle mission" = estimateur direct (plus de carte intermédiaire)

- `dashboard-pro.nouvelle-demande.tsx` : remplacer la double-carte (« Devis instantané » / « Demande sur mesure ») par le formulaire estimateur **direct**.
- Supprimer la route intermédiaire `dashboard-pro.devis-instantane.tsx` (ou la rediriger vers `/dashboard-pro/nouvelle-demande` pour ne pas casser d'anciens liens).
- Renommer dans la sidebar : « Nouvelle mission » → garder ce libellé (déjà clair).
- Idem côté client : `dashboard-client.nouvelle-reservation.tsx` héberge directement l'estimateur (déjà presque le cas).

## 3. Estimateur pro simplifié

Créer un nouveau composant `src/components/dashboard-pro/QuickMissionForm.tsx` (sans dupliquer le `DevisGenerator` public). Il pré-remplit nom/email/téléphone/société depuis `profiles` (et `companies` si lié) **sans les afficher** comme champs à ressaisir.

Champs visibles :

- Type de prestation : *Aller simple / Aller-retour* (+ *Express* si option configurée)
- Adresse départ + **contact enlèvement** (nom, téléphone, commentaire)
- Adresse arrivée + **contact livraison** (nom, téléphone, commentaire)
- Type de véhicule, date, heure
- Informations complémentaires
- Récap prix (HT / TVA / TTC selon réglage client — voir §6)
- Bouton « Créer la demande de mission »

À la soumission : insertion dans `demandes_convoyage` avec `user_id` du client connecté + métadonnées contacts (voir §4) + `prix_estime` calculé via le resolver (voir §5).

## 4. Contacts opérationnels transmis au driver

Ajout DB (migration) : 4 colonnes nullable sur `demandes_convoyage`, `trajets`, `missions` (ou un JSONB `contacts_terrain`) :

- `contact_depart_nom`, `contact_depart_tel`, `contact_depart_note`
- `contact_arrivee_nom`, `contact_arrivee_tel`, `contact_arrivee_note`

Propagation : `auto_create_trajet_from_devis` (et chemin demande→trajet→mission) recopie ces champs.

Vue convoyeur (`src/components/convoyeur/MissionCockpit.tsx` ou équivalent) : ajouter un bloc « Contacts terrain » avec deux boutons `tel:` (cliquables sur mobile, ouvrent l'appel natif).

## 5. Tarifs personnalisés appliqués automatiquement

Table `client_pricing_rules` existe déjà (avec `ville_depart`, `ville_arrivee`, `trip_type`, `prix_ttc`, `prix_ht`, `active`).

Créer `src/lib/client-pricing.ts` :

```
resolveClientPrice({ userId, email, depart, arrivee, tripType }) → { prix_ht, prix_ttc, ruleId } | null
```

Logique :

1. Cherche `active=true` matchant `client_user_id=userId` OR `client_email=email`
2. Filtre `ville_depart`/`ville_arrivee` (NULL = wildcard) — préfère matching exact > partiel > wildcard
3. Filtre `trip_type` (`any` matche tout)
4. Retourne le plus spécifique trouvé

Branchements :

- `QuickMissionForm` (Pro & Client) : appelle resolver avant le calcul standard ; si tarif perso → applique-le, affiche source (« Tarif personnalisé »).
- `DevisGenerator` public (utilisé sur `nouvelle-reservation`) : même résolveur si user connecté.
- Conversion demande → devis → mission → facture : stocker le `prix_ttc` résolu dans `prix_estime`/`prix_client` au moment de l'insert (déjà fait par `auto_create_trajet_from_devis`, donc le prix est figé une fois inscrit).

## 6. Réglage fiscal par client (HT / TTC / non soumis TVA)

Migration : ajouter sur `profiles` (ou `companies`) :

- `pricing_display_mode` text default `'ttc'` (`'ttc' | 'ht' | 'exempt'`)
- `tva_exemption_note` text (mention légale spécifique, optionnelle)

Côté admin :

- `admin.clients.$clientId.tsx` : sélecteur Mode d'affichage + champ mention TVA.

Côté estimateur / récap : si `exempt` → masquer TVA et afficher mention ; si `ht` → afficher HT en gros, TTC en petit ; sinon TTC.

## 7. Factures — mention légale configurable

Migration : table `app_settings` (singleton) **ou** ajout sur `profiles`/`companies` :

- `facture_mention_legale` text nullable
- `facture_mention_active` boolean default false

Une mention globale par défaut (dans `app_settings`) + override par client (sur profile/company).

`src/lib/facture-pdf.ts` : bloc bas-de-page conditionnel rendant la mention (en italique, taille réduite, n'altère pas la mise en page si vide).

Admin : page **Paramètres → Facturation** pour la mention par défaut + champ dans la fiche client pour l'override.

## 8. Lisibilité de l'estimateur (textes invisibles)

Audit ciblé sur `DevisGenerator.tsx` + nouveau `QuickMissionForm` : tout texte du **récap prix** (HT, TTC, distance, durée, options, message bas) doit utiliser des tokens lisibles sur fond clair (`text-foreground` / `text-pro-text` / `text-slate-700/600`) — bannir `text-cream/*` et `text-white` dans les contextes shell client/pro lumineux.

Vérification visuelle préview après modif.

## 9. Visibilité côté client : demandes + factures

- Les `demandes_convoyage` créées depuis l'estimateur pro portent `user_id` (déjà géré par trigger `demandes_set_user_id`). RLS « Clients read demandes by user_id » déjà OK.
- Vue « Missions » côté pro : déjà branchée. Ajouter le statut **« Demande envoyée / En attente de validation »** si la demande n'a pas encore de trajet associé (affiche depuis `demandes_convoyage` quand pas de mission).
- `factures` : RLS déjà OK (lecture par email). Vérifier la page `dashboard-pro.documents.tsx` (liste & téléchargement PDF).

---

## Détails techniques

### Migrations SQL (un seul lot)

1. `ALTER TABLE demandes_convoyage / trajets / missions ADD COLUMN contact_depart_nom/tel/note, contact_arrivee_nom/tel/note`
2. `ALTER TABLE profiles ADD COLUMN pricing_display_mode text DEFAULT 'ttc', tva_exemption_note text, facture_mention_legale text, facture_mention_active boolean DEFAULT false`
3. `CREATE TABLE app_settings (key text PK, value jsonb)` + RLS admin-only + seed `facture_mention_default`
4. Update fonction `auto_create_trajet_from_devis` pour recopier les contacts

### Fichiers touchés (estimation)

- `src/routes/_authenticated/dashboard-pro.index.tsx` (retrait CA)
- `src/routes/_authenticated/dashboard-pro.nouvelle-demande.tsx` (remplacement)
- `src/routes/_authenticated/dashboard-pro.devis-instantane.tsx` (redirect ou suppr)
- `src/routes/_authenticated/dashboard-client.index.tsx` (retrait CA/estimator)
- `src/components/dashboard-pro/QuickMissionForm.tsx` (nouveau)
- `src/lib/client-pricing.ts` (nouveau resolver)
- `src/components/DevisGenerator.tsx` (branchement resolver + lisibilité)
- `src/components/convoyeur/MissionCockpit.tsx` (bloc contacts terrain)
- `src/lib/facture-pdf.ts` (mention légale)
- `src/routes/_authenticated/admin.clients.$clientId.tsx` (mode fiscal + mention)
- `src/routes/_authenticated/admin.parametres.tsx` (mention globale)
- Migration SQL

### Tests manuels finaux (cf. checklist utilisateur 1–26)

À dérouler une fois l'implémentation finie : créer règles CAT France (Tours 70/120, Le Mans 120/190), se connecter, valider l'application automatique, vérifier que d'autres clients ne sont pas affectés, vérifier les appels driver sur mobile, vérifier facture+mention.

---

## Hors-scope volontaire

- Pas de refonte visuelle profonde du Dashboard (sidebar, layouts conservés).
- Pas de réécriture du `DevisGenerator` public — seulement branchement resolver + fixes contrastes.
- Pas de migration des anciennes données (les anciens devis gardent leur prix figé).