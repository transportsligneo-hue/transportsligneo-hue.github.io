# Refonte critique — Admin preuves / Driver workflow / Documents

Vu l'ampleur (7 chantiers indépendants touchant ~25 fichiers), je découpe en lots cohérents et je livre tout en séquence dans cette même conversation après ton GO.

## Lot 1 — Bloc "Inspection & preuves" dans les drawers admin

**Composant nouveau** : `src/components/admin/drawers/InspectionPreuvesBlock.tsx`
- Charge en parallèle pour une `attribution_id` :
  - `mission_selfies` (selfie convoyeur)
  - `inspection_photos` joint à `inspections` (filtré par `vue_type` → départ / arrivée)
  - `mission_signatures` (4 types : driver_start, client_start, driver_end, client_end)
  - `mission_documents` (PV, autres)
- Génère **signed URLs** via buckets `mission-selfies`, `inspection-photos`, `mission-documents`
- Affichage : grille HD avec lightbox zoom (clic → overlay plein écran), badge date/heure, bouton télécharger
- Persistant : `useQuery` avec `staleTime: 0` + invalidation au refresh

**Intégration drawers** : `admin.attributions.tsx`, `admin.trajets.tsx`, `admin.devis.tsx` (quand `attribution_id` existe via trajet→attribution).

## Lot 2 — Drawer bleu pour pages admin restantes

Reste à convertir : `admin.factures.tsx`, `admin.paiements.tsx`, `admin.missions.$missionId.tsx` (à supprimer + drawer dans liste). Les autres (utilisateurs, clients, demandes, convoyeurs, attributions, devis, trajets) sont déjà OK.

- Supprimer routes détail isolées : `admin.devis.$devisId.tsx`, `admin.factures.$factureId.tsx`, `admin.missions.$missionId.tsx`, `admin.clients.$clientId.tsx`, `admin.convoyeurs.$convoyeurId.tsx` → tout dans drawer.
- `admin.paiements.tsx` : drawer paiement avec détails Stripe + lien facture.
- `admin.factures.tsx` : drawer facture (déjà existant ? à vérifier/convertir).

## Lot 3 — Driver accueil "missions disponibles"

`convoyeur.index.tsx` :
- Query `trajets` où `statut_publication = 'publie'` ET aucune `attribution` du convoyeur courant
- Si > 0 : remplacer "Aucune mission" par carte premium **"X nouvelles missions disponibles"** avec mini-liste (n°, depart, arrivée, prix, distance, date) + CTA → `/convoyeur/disponibles`
- Toast/badge notification rouge sur l'item sidebar "Disponibles"

## Lot 4 — Workflow mission driver (9 étapes strictes)

**Refonte `src/components/convoyeur/MissionWorkflow.tsx`** avec machine d'états :

```
selfie → trajet_vers_depart → arrivee_depart → edl_depart 
→ en_route → arrivee_livraison → edl_arrivee → soumis_admin → valide_admin
```

- Selfie obligatoire = ÉTAPE 1, blocante (pas de skip)
- Validations intégrées DANS l'étape (pas un panel séparé) — supprimer/cacher `MissionGatesPanel` au profit d'inline gates
- **Sticky footer mobile** : `fixed bottom-0` avec :
  - Étape courante (ex: "3/9 · Arrivée départ")
  - Bouton "Retour" (étape précédente, désactivé si validations faites)
  - Bouton "Continuer" (désactivé tant que gates étape pas remplies)
- Persistance : à chaque transition → `UPDATE attributions SET etape_courante = ...` + `INSERT mission_etape_history`
- Au mount : lire `attributions.etape_courante` → reprendre exactement à cette étape

**Bug "Démarrer trajet"** : vérifier que `setEtape('trajet_vers_depart')` déclenche bien le `update` Supabase + la transition UI (sans doute un `await` manquant ou un guard qui bloque).

## Lot 5 — Sauvegarde mission au refresh

- Étape courante déjà en BDD via `etape_courante`
- Photos/signatures déjà en BDD (uploads atomiques)
- Au mount du dashboard convoyeur : si une `attribution` a `statut IN ('accepte','en_cours')` ET `etape_courante NOT IN ('soumis_admin','valide_admin')` → **redirect auto** vers `/convoyeur/missions/{id}` (banner "Reprendre votre mission en cours")

## Lot 6 — Documents convoyeur (refonte UI)

`convoyeur.documents.tsx` + table `documents_convoyeurs` :

**Liste fixe (10 docs)** :
1. CNI recto
2. CNI verso
3. Permis recto
4. Permis verso
5. Contrat signé
6. Assurance RC Pro
7. RIB
8. Kbis
9. Attestation de vigilance
10. W Garage
+ **Photo de profil** (stockée dans `profiles.avatar_url`, bucket `convoyeur-permis` ou nouveau)

- UI : 1 carte par doc → upload / preview / badge statut (validé vert / en attente ambre / refusé rouge + motif)
- Supprimer toute notion de "signature" du dashboard convoyeur (signatures = uniquement dans workflow mission)
- Migration : ajouter contrainte `type_document IN (...)` ou simplement filtrer côté UI

## Lot 7 — Admin : voir docs convoyeur dans drawer

Déjà partiellement fait dans `admin.convoyeurs.tsx` — vérifier que tous les types sont listés + previews HD avec signed URLs + badge statut + bouton "valider/refuser" inline.

## Migrations BDD

```sql
-- Photo profil convoyeur si pas déjà sur profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- Bucket public pour avatars
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true) 
ON CONFLICT DO NOTHING;
```

(Tout le reste est déjà en place : `mission_selfies`, `mission_signatures`, `inspection_photos`, `mission_documents`, `cartes-grises`, `attributions.etape_courante`.)

## Hors scope (ne sera PAS fait pour rester focus)

- Refonte visuelle pages publiques
- OCR carte grise auto
- Système de notifications push (uniquement badge UI)
- Refacto facturation convoyeur (validation finale admin → juste un bouton qui flag)

## Ordre d'exécution proposé

1. Migration BDD (avatars)
2. Lot 1 (bloc Inspection & preuves) — impact admin immédiat
3. Lot 4 + 5 (workflow driver + persistance) — bug critique
4. Lot 3 (accueil driver missions dispo)
5. Lot 6 + 7 (documents)
6. Lot 2 (finir conversion drawers admin)

Je livre lot par lot, en t'indiquant à chaque fois ce qui est fait et ce qui reste, pour que tu puisses tester en continu.
