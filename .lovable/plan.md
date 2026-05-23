
# Phase 2 — Livrable unique (à valider avant phase 3/4)

Le brief contient 14 chantiers. Je propose de **livrer en une seule phase les 6 points bloquants métier** que vous avez explicitement marqués prioritaires, et de garder le reste (notifications push, tarifs, estimateur mobile, accueil mobile) pour des phases suivantes — sinon je casse l'existant.

## Périmètre de CETTE intervention

### 1. PV de livraison digitalisés (Model/Arval & Welcomauto/Ayvens)
- Nouvelle table `mission_pv_digitaux` (mission_id, plateforme, actif, url, code, plaque, instruction).
- Bloc admin dans `admin.missions.$missionId.tsx` : "PV de livraison digitalisés" avec 2 cartes (Model/Arval, Welcomauto/Ayvens), toggle actif + champs URL/code/plaque/instruction.
- Bloc Driver dans `MissionCockpit` / `MissionWorkflow` : "PV de livraison digitalisés", uniquement les plateformes actives, boutons **Ouvrir** (window.open) + **Copier code** + **Copier plaque** (`navigator.clipboard.writeText` + toast).
- Jamais appelé "état des lieux".

### 2. Documents de mission (admin + client + driver)
- Table `mission_documents` existe déjà — étendre avec `visible_driver bool`, `visible_client bool`, `type_document` (enum élargi : pv_livraison_vierge, pv_restitution_vierge, carte_grise, bon_transport, instruction, autre).
- **Admin** (fiche mission) : bloc "Documents de mission" → upload multiple, nom, type, toggle visibilité driver/client, suppression, remplacement. Possible **avant publication** ET en cours de mission.
- **Client** (`dashboard-client.missions.$missionId.tsx` + `dashboard-pro.missions`) : bloc "Mes documents" → upload + liste, ajout possible en cours de mission tant que non archivée.
- **Driver** (`MissionCockpit`) : section "Documents de mission" → liste avec bouton Télécharger/Ouvrir (signed URL Supabase storage).
- Bucket storage `mission-documents` (privé, RLS par mission_id).
- Notification admin quand client ajoute un doc (via `notifyAdmin` existant).

### 3. Publication catalogue vs assignation directe
- Sur `admin.missions.$missionId` (ou création), ajouter un **toggle "Mode d'attribution"** : `assignation_directe` | `catalogue_public`.
- Si `catalogue_public` : pas de `convoyeur_id` obligatoire ; la mission apparaît dans `convoyeur.disponibles.tsx` pour les drivers éligibles.
- Si un driver l'accepte → bascule en `assignation_directe` avec son `convoyeur_id`, sort du catalogue.
- Ajouter colonne `mode_attribution` sur `attributions` (ou flag `is_public boolean default false`).
- Vérifier `convoyeur.disponibles.tsx` lit bien le catalogue.

### 4. Lisibilité Driver (noir illisible UNIQUEMENT)
- **Ne pas toucher** au workflow ni à la structure.
- Audit ciblé : `convoyeur/MissionCockpit.tsx`, `MissionWorkflow.tsx`, `MissionCard.tsx`, `PremiumMissionHero.tsx`, `VehiculeDocsView.tsx`, `ArriveeSignatureSheet.tsx`, `DoubleSignatureModal.tsx`, `IncidentReportSheet.tsx`.
- Remplacer `bg-black text-black`, `Button variant="ghost"` sur fond sombre, etc. par tokens design system (`bg-primary`, `text-primary-foreground`, `bg-accent`, contraste visible).
- Garder la palette bleu premium Ligneo.

### 5. Lisibilité globale (menus déroulants déjà partiellement faite)
- Vérifier `Select`, `DropdownMenu`, `Popover`, `Command` → `bg-popover text-popover-foreground` (déjà appliqué en partie, compléter si trous).

### 6. Libellé "Recharge du véhicule"
- Search & replace global "Recharger le véhicule à l'arrivée" / "avant d'y aller" → "Recharge du véhicule" dans tout `src/`.

## Hors périmètre (phases suivantes, à valider)

- **Phase notifications push** (point 7) : système web-push complet + service worker, gros chantier dédié.
- **Phase tarifs perso & moteur unique** (points 8-9-10) : déjà partiellement en place (`ClientPricingRulesBlock`, `resolveClientPrice`), audit complet réservé pour la phase 3.
- **Estimateur mobile + Google Places** (point 10) : refonte à part.
- **Page accueil mobile premium** (point 12) : refonte design dédiée.

## Migrations SQL prévues

```sql
-- 1. PV digitalisés
CREATE TABLE public.mission_pv_digitaux (
  id uuid PK default gen_random_uuid(),
  attribution_id uuid NOT NULL,
  plateforme text NOT NULL CHECK (plateforme IN ('model_arval','welcomauto_ayvens')),
  actif boolean NOT NULL DEFAULT false,
  url text, code text, plaque text, instruction text,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  UNIQUE(attribution_id, plateforme)
);
-- RLS : admin all, convoyeur SELECT si owner attribution

-- 2. Documents mission : étendre mission_documents
ALTER TABLE mission_documents
  ADD COLUMN visible_driver boolean DEFAULT true,
  ADD COLUMN visible_client boolean DEFAULT false,
  ADD COLUMN ajoute_par text DEFAULT 'admin' CHECK (ajoute_par IN ('admin','client','convoyeur'));
-- Nouvelles policies : client peut INSERT/SELECT ses docs

-- 3. Catalogue public
ALTER TABLE attributions
  ADD COLUMN is_public boolean DEFAULT false;
-- ou: permettre convoyeur_id null + flag

-- 4. Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('mission-documents','mission-documents',false);
-- policies storage par attribution_id
```

## Ordre d'exécution

1. Migrations SQL (PV table, mission_documents extension, catalogue flag, storage bucket + policies).
2. Bloc admin PV digitalisés + bloc Driver PV digitalisés.
3. Bloc admin documents + bloc client documents + bloc Driver documents.
4. Toggle publication catalogue / assignation + visibilité dans `convoyeur.disponibles`.
5. Audit lisibilité Driver (contraste boutons/textes noirs).
6. Replace "Recharger le véhicule…" → "Recharge du véhicule".
7. Message de clôture demandé exactement par vous.

## Risques / décisions à valider

- **Périmètre réduit assumé** : je ne traite PAS notifs push, tarifs, estimateur, accueil mobile dans ce livrable. Sinon on dépasse 3-4h de travail et risque casse.
- **Confirmation** : la table `mission_documents` existe déjà — j'étends, je ne recrée pas.
- **PV digitalisés** liés à `attribution_id` (et non `mission_id` qui n'existe pas en tant que tel — la mission EST l'attribution).

Validez-vous ce périmètre ? Si oui je lance les migrations puis le code dans la foulée.
