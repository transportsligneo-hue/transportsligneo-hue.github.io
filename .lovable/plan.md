# Assistant IA — État des lieux TRANSPORTS LIGNEO

Objectif : ajouter un assistant IA (détection défauts, OCR compteur/voyants/équipements, guide photo, comparaison départ/arrivée, rapport premium) **sans toucher** aux workflows EDL, missions, attributions, facturation existants. Tout est piloté par feature‑flags admin ; IA OFF ⇒ comportement 100% identique à aujourd'hui.

## Principes non négociables

- Zéro régression : aucun composant EDL existant n'est modifié dans sa logique. On **enveloppe** (wrapper) ou on **ajoute des panneaux latéraux**.
- Kill-switch global + granulaire (par capacité) lisible côté client comme côté serveur.
- L'IA **suggère**, ne décide jamais. Toute suggestion est révisable/rejetable avant persistance.
- Server-side uniquement pour les appels payants (Lovable AI Gateway). Auth Supabase requise. Rate limit.
- Offline-first : file d'attente locale (IndexedDB) déjà présente pour EDL, on greffe les analyses IA dessus.

## Phase 1 — Fondations (livrées cette itération)

### 1. Table `ai_settings` + RPC publique

`public.ai_settings` (singleton) — toutes les capacités listées ci‑dessous en booléens + `ai_enabled` global + `assistance_level` (`minimal|standard|avance`).

Capacités : `ocr_documents`, `ocr_odometer`, `detect_fuel_level`, `detect_battery_level`, `detect_warning_lights`, `detect_scratches`, `detect_dents`, `detect_impacts`, `detect_rims`, `detect_windshield`, `detect_mirrors`, `detect_lights`, `detect_equipment`, `compare_departure_arrival`, `auto_report`, `mission_prefill`, `smart_suggestions`, `photo_assistant`.

- RLS : lecture pour `authenticated` (nécessaire côté convoyeur), écriture admin uniquement.
- RPC `get_public_ai_settings()` (SECURITY DEFINER, `TO authenticated`) : renvoie l'objet plat, cache côté client 60s.
- Table `ai_usage_events` (append-only) : `capability`, `user_id`, `latency_ms`, `success`, `cost_credits_est`, `created_at` — alimente les statistiques admin.

### 2. Provider React `AiSettingsProvider`

- Un fetch au montage via `get_public_ai_settings`.
- Realtime sur `ai_settings` pour propagation instantanée.
- Helper `useAiCapability("detect_scratches")` → `boolean`. **Toute** UI IA gate son rendu derrière ce hook. IA OFF ⇒ arbres React inchangés.

### 3. Server functions IA (`src/lib/ai/*.functions.ts`)

Chacune : `requireSupabaseAuth`, vérif capacité côté serveur (double gate), Zod input, appel Lovable AI Gateway (`google/gemini-3.1-flash` pour l'analyse rapide, `google/gemini-2.5-pro` pour la comparaison), log `ai_usage_events`, timeout 15s, gestion 429/402 explicite.

- `analyzePhotoDamage` — retourne bounding boxes normalisées + labels + confidence pour rayures/bosses/impacts/etc.
- `readDashboard` — kilométrage, autonomie, carburant %, batterie %, voyants allumés (liste).
- `detectEquipment` — équipements intérieur/coffre présents/absents/incertains.
- `photoQualityCheck` — flou, cadrage, luminosité, sujet manquant.
- `compareEdl` — deltas départ vs arrivée (nouveaux défauts uniquement).
- `generateEdlReport` — assemble un rapport structuré (JSON) prêt pour le PDF existant.

L'OCR documents (`scanDocumentExtract`) et le handoff QR existants sont **conservés tels quels** ; on les branche derrière la capacité `ocr_documents`.

### 4. UI Convoyeur — panneau `AiAssistantPanel`

Ajouté **à côté** du composant EDL existant, jamais dedans. Slot latéral repliable :

- Bandeau "Analyse en cours…" (skeleton) puis liste de suggestions groupées par catégorie.
- Chaque suggestion : miniature avec overlay canvas (bbox), label, confidence, actions `Confirmer` / `Modifier` / `Ignorer`.
- `Confirmer` ⇒ appelle les mêmes handlers que la saisie manuelle actuelle (ajout au state du form EDL). Aucune écriture directe en DB par l'IA.
- Assistant photo : toast non‑bloquant en bas de l'écran capture (`"Photo floue, refaire ?"`) — le bouton "Valider quand même" reste toujours dispo.

### 5. UI Admin — nouvelle route `/admin/parametres-ia`

- Toggle global "IA activée".
- Sélecteur `Niveau d'assistance`.
- Grille de switches par capacité (les 18 listées).
- Onglet Statistiques : appels/jour, latence p50/p95, taux de succès, coût estimé sur 30j (agrégation `ai_usage_events`).
- Onglet Modèles : mapping capacité → id modèle Gemini (édition libre, validation contre l'allow-list Lovable AI).

Ajout d'une entrée dans le menu latéral admin : `⚙️ Paramètres IA` (ne remplace **pas** `admin.parametres.tsx`).

### 6. Création mission par scan

Le bouton `📄 Scanner un document` existe déjà dans `admin.trajets.tsx` (ScanToPrefill + QrHandoffButton). On ajoute :
- Même bloc dans `DevisGenerator` et `QuickMissionForm` (déjà fait) — on gate derrière `ocr_documents`.
- Un mode "one-shot" : après OCR, si `mission_prefill` est actif, on peuple aussi les champs client (nom/email/tel) détectés.

### 7. Comparaison Départ / Arrivée

- Nouveau bouton dans la fiche mission côté admin : `Comparer EDL`.
- Appelle `compareEdl` avec les URLs signées des photos départ + arrivée.
- Affiche un split-view avec deltas surlignés + section "Nouveaux défauts" prête à être ajoutée au litige/facturation (bouton "Créer un incident" existant).

### 8. Rapport IA

- Bouton `Générer rapport IA` dans la fiche EDL (visible seulement si `auto_report` actif).
- Appelle `generateEdlReport` puis alimente `src/lib/edl-final-pdf.ts` (déjà en place) via une section additionnelle "Analyse IA" — pas de fork du PDF.

### 9. Performance

- Web Worker pour la compression photo (existe : `src/lib/workers/image-worker.ts`). On y ajoute un downscale ciblé 1280px avant envoi AI (au lieu du fichier plein) → -80% latence + coût.
- Cache mémoire `Map<sha256(image), result>` sur l'appel `analyzePhotoDamage` (session).
- Requêtes IA envoyées en parallèle par lot de 3 (limite Gateway).
- Lazy import de `AiAssistantPanel` (React.lazy) — 0 impact bundle si IA OFF.
- Objectif p95 : première suggestion visible < 2s sur 4G.

### 10. Mode hors ligne

- Réutilise `edl-offline-queue.ts`. On ajoute une file `ai_pending` (IndexedDB) : `{photo_id, capability, params}`.
- À la reconnexion, le worker rejoue et pousse dans le state EDL — sans jamais bloquer la saisie manuelle.

## Ce qui **n'est pas** touché

- `useMissionGates`, `mission_status.ts`, `attribution-response.functions.ts`, `pricing-engine.ts`, routes de checkout/webhooks Stripe, PDF facture, emails, EDL persistence (`inspections`, `inspection_photos`, `inspection_document_ocr`).
- Aucun trigger SQL sur tables existantes.
- Aucun changement de schéma sur `missions`, `attributions`, `trajets`, `devis`.

## Détails techniques

- Fichiers créés :
  - `supabase/migrations/xxx_ai_settings.sql` — table + RPC + RLS + grants + seed singleton.
  - `src/lib/ai/settings.functions.ts`, `src/lib/ai/context.tsx`, `src/lib/ai/useAiCapability.ts`.
  - `src/lib/ai/analyze-photo.functions.ts`, `read-dashboard.functions.ts`, `detect-equipment.functions.ts`, `photo-quality.functions.ts`, `compare-edl.functions.ts`, `generate-report.functions.ts`.
  - `src/components/ai/AiAssistantPanel.tsx`, `AiSuggestionCard.tsx`, `BoundingBoxOverlay.tsx`, `PhotoQualityToast.tsx`.
  - `src/routes/_authenticated/admin.parametres-ia.tsx`.
- Modèle par défaut : `google/gemini-3.1-flash-lite` (vision, rapide) — configurable en admin.
- Prompts fortement contraints par tool-calling (JSON schema strict) pour éviter les hallucinations.
- Chaque server fn journalise `ai_usage_events` même en cas d'échec (avec `success=false`).

## Livraison

Cette phase 1 pose **toutes** les capacités listées mais avec les modèles hébergés (pas de WASM/ONNX embarqué). Une phase 2 pourra remplacer les capacités les plus fréquentes (photo_quality, odomètre) par du on‑device (OpenCV.js déjà installé) pour tomber sous 500 ms de pré‑analyse — la même API `useAiCapability` restera valable, seul l'implémenteur change.
