## Objectif

Deux chantiers complémentaires, livrés ensemble pour offrir une expérience "SaaS international" cohérente :

1. **Rendre les missions TEST réellement exécutables** — aujourd'hui elles sont invisibles côté convoyeur (RLS `is_test_data = false`), donc impossible de valider le scan sur le vrai parcours.
2. **Handoff PC → mobile instantané via QR code** — un demandeur qui remplit une demande sur PC scanne un QR affiché à l'écran avec son téléphone, prend les documents en photo, et les champs se pré-remplissent sur le PC **en temps réel**, sans refresh, sans compte à créer côté mobile.

---

## Chantier 1 — Missions TEST utilisables en conditions réelles

### Principe

Une mission `is_test_data = true` doit se comporter exactement comme une vraie mission (attribution, acceptation, démarrage, EDL, scan, livraison) pour **tout convoyeur explicitement désigné comme testeur**, tout en restant invisible pour les autres convoyeurs, les clients, la facturation et les statistiques.

### Changements

- **Migration SQL**
  - Nouveau flag `profiles.is_test_convoyeur boolean default false` (activable par un admin depuis la fiche convoyeur).
  - Politiques RLS des tables `attributions`, `trajets`, `missions`, `mission_offres`, `mission_documents`, `inspections`, `inspection_photos` : ajouter la clause `OR (is_test_data = true AND EXISTS (select 1 from profiles where id = auth.uid() and is_test_convoyeur = true))` aux SELECT/UPDATE convoyeur.
  - RPC `admin_create_test_mission` : accepter un paramètre optionnel `_target_convoyeur_id` pour créer directement l'attribution en `directe` → `en_attente` sur ce convoyeur, ou en `catalogue` si non fourni.
  - Nouveau RPC `admin_toggle_test_convoyeur(_user_id, _enabled)` (admin-only).

- **UI Admin**
  - Fiche convoyeur : toggle "Convoyeur testeur" (badge visuel + description explicative).
  - Bouton "Créer mission test" existant (`TestMissionActions.tsx`) : ajouter un select "Attribuer à…" listant les convoyeurs testeurs, plus l'option "Publier au catalogue".
  - Badge TEST déjà présent, conservé sur toutes les vues admin.

- **UI Convoyeur**
  - Rien à changer : dès que le flag est actif, les missions TEST apparaissent naturellement dans catalogue / attributions / accueil, avec le `TestBadge` déjà défini pour signaler qu'il s'agit d'un test.
  - Filtre facturation / stats : exclure `is_test_data = true` (déjà exclu si les vues filtrent, à vérifier).

### Garde-fous

- Le flag `is_test_convoyeur` ne donne AUCUN accès aux vraies missions d'autres utilisateurs — l'élargissement RLS est strictement borné à `is_test_data = true`.
- Les emails/SMS/push transactionnels déclenchés par une mission test doivent être `[TEST]`-préfixés (helper existant à vérifier, sinon ajout d'un check dans `notify.ts`).
- Aucune écriture dans `factures`, `paiements`, statistiques publiques pour une mission test (filtres côté requêtes).

---

## Chantier 2 — Handoff QR "PC → mobile" pour le scan

### Expérience cible

1. Sur PC, dans un formulaire (admin nouvelle mission, client nouvelle réservation, pro nouvelle demande), à côté du bouton "Scanner un document" existant → nouveau bouton **"Scanner depuis mon téléphone"**.
2. Clic → modal centrée affichant un QR code net + code court à 6 caractères (backup manuel).
3. Le demandeur scanne le QR avec l'appareil photo natif de son téléphone → ouverture immédiate d'une page mobile publique `/scan/$token` (sans login).
4. Sur mobile, il voit le `PremiumScanner` existant en plein écran, prend une ou plusieurs photos.
5. **Temps réel** : dès qu'une extraction est finalisée côté serveur, les champs du formulaire PC se pré-remplissent (aucun refresh, badge "Reçu du téléphone" avec animation dorée).
6. Fermeture automatique de la modal PC dès la première extraction réussie (configurable multi-pages).

### Architecture

- **Table `scan_handoff_sessions`** (nouvelle)
  - `id uuid pk`, `token text unique` (32 chars url-safe), `short_code text` (6 chars), `created_by uuid null` (nullable pour flux client anonyme si besoin), `context text` (`admin_mission` / `client_reservation` / `pro_demande`), `expires_at timestamptz` (5 min TTL), `consumed_at timestamptz null`, `created_at timestamptz default now()`.
  - Enum `handoff_status`: `pending`, `scanning`, `completed`, `expired`.
  - RLS : SELECT/UPDATE réservé au créateur ; INSERT via server function ; page mobile lit via server route publique qui valide le token sans exposer la table.

- **Table `scan_handoff_extractions`** (nouvelle)
  - `id uuid pk`, `session_id uuid fk`, `extraction jsonb` (payload `ExtractionResult` déjà défini), `created_at timestamptz default now()`.
  - Realtime activé (publication supabase_realtime).

- **Server functions** (`src/lib/scanner/handoff.functions.ts`)
  - `createHandoffSession({ context })` → renvoie `{ token, short_code, url, expires_at }`. Auth requise pour admin/pro, anonyme autorisée pour client (protégée par recaptcha existant).
  - `pushHandoffExtraction({ token, extraction })` → appelée par la page mobile ; valide TTL, insère l'extraction, marque `completed` si demandé.

- **Server route publique** `src/routes/api/public/scan/session.ts`
  - `GET ?token=…` : renvoie le contexte minimal (expiration, statut) pour que la page mobile démarre sans avoir besoin de créer un compte.

- **Page mobile** `src/routes/scan.$token.tsx` (publique, hors `_authenticated`)
  - Récupère le contexte via server function anonyme, monte `PremiumScanner`, envoie chaque page via `scanDocumentExtract` (server function existante, on autorise un chemin `guest` avec token handoff au lieu du bearer auth — modification ciblée du validateur d'auth de cette function pour accepter `X-Handoff-Token`).
  - À chaque extraction OK → appel `pushHandoffExtraction`, affichage "✓ Envoyé au PC" + option "Scanner une autre page".

- **Composant PC** `src/components/scanner/QrHandoffButton.tsx`
  - Bouton doré secondaire à côté de `ScanToPrefill`.
  - Ouvre modal avec QR (via `qrcode` npm ou `qr-code-styling` — préférence pour `qrcode` léger).
  - Souscrit à la table `scan_handoff_extractions` filtrée par `session_id` via `supabase.channel(...).on('postgres_changes', ...)` → dès insertion, merge dans le state parent via le même callback `onExtracted` que `ScanToPrefill` (contrat unifié, zéro friction pour les intégrations existantes).
  - Timer visuel 5 min + bouton "Régénérer".

### Sécurité

- Token 32 chars aléatoires (`crypto.randomUUID` + segment supplémentaire).
- TTL strict 5 min, `consumed_at` non bloquant multi-pages mais session expirée = 410.
- Rate limit sur `pushHandoffExtraction` (max 20 pages / session).
- La page mobile ne peut RIEN lire du dossier PC : elle ne fait qu'écrire des extractions attachées à son token.
- Pas de PII persistée au-delà de la session : purge auto via cron `delete from scan_handoff_sessions where expires_at < now() - interval '1 hour'` (job pg_cron déjà en place à vérifier, sinon simple purge on-write).

### Performance / "quasi-instantané"

- QR généré côté client (aucun round-trip pour l'affichage).
- Realtime Supabase = latence < 1 s en France.
- Compression image mobile (`image-compression.ts` existant) avant upload : 300 Ko max en JPEG 85%.
- Extraction Gemini 2.5 Flash typique 2–3 s → total < 5 s entre "clic capture mobile" et "champ rempli sur PC".

---

## Livrables

### Fichiers créés
- `supabase/migrations/…_test_convoyeurs_and_scan_handoff.sql`
- `src/lib/scanner/handoff.functions.ts`
- `src/components/scanner/QrHandoffButton.tsx`
- `src/routes/scan.$token.tsx`
- `src/routes/api/public/scan/session.ts`

### Fichiers édités
- `src/components/admin/TestMissionActions.tsx` (select convoyeur cible)
- `src/routes/_authenticated/admin.convoyeurs.$convoyeurId.tsx` (toggle testeur)
- `src/lib/scanner/scan-document.functions.ts` (accepter `X-Handoff-Token` en plus du bearer)
- Formulaires portant déjà `ScanToPrefill` (admin trajets d'abord ; client/pro dans la foulée) : ajout du bouton QR à côté
- `src/integrations/supabase/types.ts` (nouvelles tables + colonne)

### Hors périmètre
- Refonte EDL premium (phase 4 du plan initial, reste ouverte)
- Détection dommages IA sur photos véhicule
- App mobile native

---

## Ordre d'exécution

1. Migration SQL (tables handoff + flag testeur + RPC + RLS).
2. Backend handoff (server functions + route publique + patch auth `scan-document`).
3. UI PC : `QrHandoffButton` + branchement sur `admin.trajets.tsx`.
4. UI mobile : page `/scan/$token`.
5. UI admin testeur : toggle + select cible sur "Créer mission test".
6. Extension aux formulaires client/pro.
7. Test manuel de bout en bout via Playwright (création mission test → attribution testeur → mobile handoff → pré-remplissage PC).

Prêt à lancer dès validation.
