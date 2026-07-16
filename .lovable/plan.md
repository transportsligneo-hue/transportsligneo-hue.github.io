# Scanner Premium TRANSPORTS LIGNEO

Vous avez validé : **tout en une seule phase**, **OpenCV.js WASM temps réel**, **intégration sur les 3 formulaires** (admin, client, pro). Je découpe en 5 sous-phases livrées à la suite dans ce même chantier, chacune testable indépendamment pour éviter la régression.

## Architecture cible

```text
┌─────────────────────────────────────────────────────────────┐
│  <PremiumScanner />  (composant unique, réutilisable)       │
│  ├─ Caméra getUserMedia + <video> preload                   │
│  ├─ Web Worker OpenCV.js (findContours, 4 coins, stabilité) │
│  ├─ Auto-capture quand doc stable > 800ms                   │
│  ├─ Correction perspective (warpPerspective) + filtres      │
│  │   (ombre, contraste, netteté, N&B "magic color")         │
│  ├─ Contrôle qualité local (Laplacian variance = flou)      │
│  └─ Multi-pages : liste réordonnable + PDF pdf-lib          │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┴───────────────┐
        ▼                              ▼
  EDL photos véhicule           Création mission
  (remplace                     ┌──────────────────────┐
  QuickCameraCapture)           │ scan-document.fn.ts  │
                                │ Gemini 2.5 Flash     │
                                │ tool-calling struct. │
                                │ classifie type doc   │
                                │ (CG/CPI/BC/BL/PV/…)  │
                                │ extrait tous champs  │
                                └──────────┬───────────┘
                                           ▼
                                  Pré-remplit formulaires :
                                  • admin nouvelle mission
                                  • dashboard-client réservation
                                  • dashboard-pro demande
```

## Sous-phase 1 — Fondations scanner (composant + worker OpenCV)

- Ajout dep `opencv.js` (WASM ~8 Mo, chargé à la demande via `<script>` dynamique, pas dans le bundle initial).
- `src/lib/workers/opencv-worker.ts` : détection contours + 4 coins + score stabilité.
- `src/components/scanner/PremiumScanner.tsx` : UI plein écran, overlay contours animés, capture auto, flash, torch, HD.
- `src/lib/scanner/image-pipeline.ts` : perspective + shadow removal + auto-enhance (3 modes : Original / Auto / N&B).
- `src/lib/scanner/quality-check.ts` : flou (Laplacian), luminosité, coupure bord.
- Fallback total : si OpenCV échoue à charger → capture simple `QuickCameraCapture` actuel (aucune régression).

## Sous-phase 2 — OCR & classification serveur

- Nouvelle fonction `supabase/functions/scan-document-extract/index.ts` (ou server fn) : Gemini 2.5 Flash Vision + `tool_choice` avec un schéma qui accepte **tous les types de documents auto FR** dans un seul `oneOf` — le modèle classifie + extrait en un appel.
- Champs extraits normalisés : VIN, immat, marque, modèle, énergie, puissance, date_mec, titulaire, adresse, client, concession, n°commande/dossier/facture, tel, mail, kilométrage, dommages notés.
- Multi-doc : appel batch, fusion serveur (règle : dernière valeur non vide, priorité carte grise > BC > BL pour les champs véhicule ; BC > CG pour client).
- Cache : hash SHA-256 de l'image → réutilise résultat si scan répété (localStorage).
- Rétrocompatible : `edl-document-ocr` existante reste en place (non touchée).

## Sous-phase 3 — Intégration création mission (3 formulaires)

- Nouveau composant `<ScanToPrefill onExtracted={fn} />` : bouton premium doré, ouvre scanner → appelle extraction → renvoie objet normalisé.
- Branché sur :
  - `admin.trajets` / nouvelle mission
  - `dashboard-client.nouvelle-reservation`
  - `dashboard-pro.nouvelle-demande`
- Mapping champs vers state existant du formulaire (sans changer la validation ni les mutations Supabase).
- Alertes intelligentes : VIN check digit, doublon immat sur missions récentes (query `missions` + `trajets`), client existant (`profiles.email`).
- Multi-pages : bouton "+ Ajouter document" → concat des extractions → PDF pdf-lib attaché en storage (`mission-documents` bucket).

## Sous-phase 4 — Refonte scanner EDL

- `QuickCameraCapture` conservé (fallback + zones simples) mais remplacé par `PremiumScanner` sur :
  - Photos véhicule (4 zones inspection)
  - Photos compteur / carburant (avec extraction OCR km auto → pré-remplit champ km)
  - Photos documents (PV livraison, mandat)
- Détection dommages : appel Gemini Vision sur chaque photo véhicule → suggestions structurées `{type, sévérité, zone}` → pré-cochées dans l'UI dommages existante, l'utilisateur valide/décoche.
- File d'attente offline existante (`edl-offline-queue.ts`) réutilisée : le scanner met les images dedans si offline.

## Sous-phase 5 — Export, offline, polish

- Export PDF/PNG/JPEG HD via pdf-lib (déjà présent dans le projet).
- Retour haptique `navigator.vibrate` sur capture auto et succès.
- Skeleton + progressive rendering : preview locale immédiate, OCR en tâche de fond avec indicateur discret.
- Préchargement du WASM OpenCV au hover du bouton "Scanner" (link `rel=preload`).
- Tests visuels Playwright sur les 3 formulaires (screenshot avant/après scan avec image de démo).

## Détails techniques

- **Modèle OCR** : `google/gemini-2.5-flash` via Lovable AI Gateway (rapide, tool-calling fiable). Fallback `gemini-2.5-pro` si extraction structurée échoue.
- **Sécurité** : la fonction OCR vérifie JWT + rôle (admin/client/convoyeur propriétaire). Rate limit côté fonction (10 scans/min/user).
- **Storage** : bucket `mission-documents` existant, chemin `${user_id}/${mission_id}/scan_${timestamp}.pdf`.
- **Bundle** : OpenCV.js chargé via `import()` dynamique + `<script async>` — 0 impact sur le bundle initial.
- **Types** : nouveau fichier `src/lib/scanner/types.ts` avec union discriminée `ExtractedDocument = CarteGrise | BonCommande | PVLivraison | ...`.
- **Zero-regression** : `QuickCameraCapture`, `edl-document-ocr`, `edl-offline-queue`, formulaires existants restent fonctionnels. Le scanner premium est un **ajout** activable, pas un remplacement destructif.

## Ce qui n'est PAS inclus (à demander séparément si voulu)

- SDK payant (Scanbot / Microblink) — vous avez choisi OpenCV.js.
- Refonte visuelle des dashboards eux-mêmes.
- Reconnaissance vocale / dictée.
- App mobile native (reste web/PWA).

## Estimation

~15-20 fichiers nouveaux, ~8 fichiers édités, 1 migration mineure (colonne `scan_source` sur `missions` pour traçabilité, optionnel). Livraison en un enchaînement sans questions supplémentaires — je vous ping à chaque sous-phase terminée pour que vous testiez avant la suivante.

**Confirmez ce plan et je démarre la sous-phase 1 immédiatement.**
