
# Plan — Améliorations EDL, Mission, PDF & UI mobile

Objectif : améliorer l'expérience mobile de l'état des lieux, ajouter de nouvelles étapes (équipements, kilométrages, contact livraison), corriger l'OCR, générer le PDF final admin sans prix, et moderniser l'UI — **sans casser** la logique métier existante (missions, signatures, rôles, paiements).

---

## 1. Photos EDL — affichage immédiat & navigation manuelle

**Fichier :** `src/components/inspection/EdlPremiumFlow.tsx`

- Retirer **tous** les `setTimeout(() => autoAdvance(), 700)` ajoutés précédemment après upload photo/scan/selfie/signature. L'utilisateur reste sur l'étape.
- Afficher la preview locale (`URL.createObjectURL`) **immédiatement** dans le state, avant la fin de l'upload (l'upload continue en arrière-plan avec indicateur).
- Garder le bouton **« Photo suivante »** comme seule action d'avancement.
- Rendre le footer d'action **sticky bas** (`fixed bottom-0` + `safe-bottom`) sur mobile, avec backdrop blur navy, hauteur min 64px, padding safe-area.
- Ajouter un padding-bottom au scroll container pour que le footer ne masque pas le contenu.

## 2. Étape « Équipements du véhicule » (avant photos)

**Fichiers :**
- `src/components/inspection/edl-premium-sequence.ts` — insérer une nouvelle étape `equipements` en tout début (type `checklist`).
- `src/components/inspection/EdlPremiumFlow.tsx` — nouveau renderer `ChecklistArea` (cases à cocher mobile-friendly).

**Champs :**
- Extincteur (oui/non)
- Kit de sécurité (oui/non)
- Câble de recharge (oui/non/N.A. si non-électrique)
- Roue de secours / Kit crevaison : sélecteur radio à 3 choix (`roue_secours` | `kit_crevaison` | `aucun`)

**Stockage :** colonne `equipements jsonb` sur la table `inspections` (migration).

## 3. Kilométrages départ & arrivée

**Étapes :** ajouter `kilometrage_depart` juste avant la signature client départ, et `kilometrage_arrivee` juste avant signature client arrivée.

**UI :** champ `<input type="number" inputMode="numeric" />` plein écran mobile, validation > 0, sauvegarde dans `inspections.kilometrage_depart` / `kilometrage_arrivee` (colonnes `integer`).

**Migration :** ajouter les 3 colonnes (`equipements jsonb`, `kilometrage_depart int`, `kilometrage_arrivee int`).

## 4. Signatures d'arrivée

Auditer le code des signatures d'arrivée (`ArriveeSignatureSheet.tsx`) et aligner exactement sur la logique départ (validation, save, transition, affichage post-sign). Réutiliser le même composant `SignatureCanvas` et les mêmes handlers.

## 5. OCR / scan documents

**Fichiers :**
- `supabase/functions/edl-document-ocr/index.ts` — vérifier l'appel Lovable AI (modèle vision : `google/gemini-2.5-flash`), logs, gestion erreur claire.
- `src/components/inspection/DocumentScanner.tsx` — afficher message d'erreur visible si OCR échoue + bouton « Continuer sans OCR » déjà en place.

Diagnostiquer via logs edge function après tentative réelle. Vérifier que l'image est bien envoyée en base64 et que le modèle vision répond.

## 6. PDF final admin (sans prix)

**Nouveau fichier :** `src/lib/edl-final-pdf.ts` — génère un PDF récapitulatif mission + EDL.

**Contenu :**
- En-tête : logo, n° mission, date, départ/arrivée, véhicule (marque/modèle/immat)
- Convoyeur assigné
- Équipements cochés
- Kilométrage départ + arrivée + différence
- Toutes les photos EDL (grille 2 colonnes, légendées par zone)
- Signatures départ (client + convoyeur)
- Signatures arrivée (client + convoyeur)
- Incidents éventuels
- **Aucun prix, aucune mention tarifaire**

**Intégration :** bouton « Télécharger PDF mission complet » dans `admin.missions.$missionId.tsx` (visible quand mission terminée).

## 7. Contact livraison (réception)

**Migration :** ajouter sur `trajets` (et/ou `missions`) :
- `arrivee_contact_nom text`
- `arrivee_contact_telephone text`
- `arrivee_contact_telephone2 text`
- `arrivee_contact_instructions text`

**Admin :** champs éditables dans la fiche mission admin.

**Convoyeur :** dans `PremiumMissionHero.tsx` / `MissionCockpit.tsx`, ajouter une carte « Contact livraison » avec nom, téléphone, bouton `tel:` (« Appeler la réception »), distincte de la carte client commanditaire.

## 8. UI mobile premium

**Cibles :**
- `MissionCockpit.tsx` / `PremiumMissionHero.tsx` : corriger le chevauchement du badge jaune « Envoyer à l'admin » avec le cadran départ — ajouter `mt-` et utiliser un layout flex column avec gap.
- Remplacer les boutons/textes noirs purs par un bleu électrique premium cohérent avec la charte navy/or.
- Ajouter un token `--electric-blue: oklch(0.62 0.22 250)` dans `src/styles.css` + variante `Button` `electric`.
- Améliorer contraste textes (passer noirs purs en `text-foreground` sur surfaces claires, et `text-primary-foreground` sur navy).

## Détails techniques

**Migration SQL** (un seul fichier) :

```sql
ALTER TABLE public.inspections
  ADD COLUMN IF NOT EXISTS equipements jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS kilometrage_depart integer,
  ADD COLUMN IF NOT EXISTS kilometrage_arrivee integer;

ALTER TABLE public.trajets
  ADD COLUMN IF NOT EXISTS arrivee_contact_nom text,
  ADD COLUMN IF NOT EXISTS arrivee_contact_telephone text,
  ADD COLUMN IF NOT EXISTS arrivee_contact_telephone2 text,
  ADD COLUMN IF NOT EXISTS arrivee_contact_instructions text;
```

**Fichiers modifiés :**
- `src/components/inspection/EdlPremiumFlow.tsx` (retire auto-advance, sticky footer, nouveaux renderers)
- `src/components/inspection/edl-premium-sequence.ts` (nouvelles étapes)
- `src/components/inspection/DocumentScanner.tsx` (UX erreur OCR)
- `supabase/functions/edl-document-ocr/index.ts` (fix OCR si besoin)
- `src/components/convoyeur/PremiumMissionHero.tsx` + `MissionCockpit.tsx` (contact livraison, fix chevauchement)
- `src/routes/_authenticated/admin.missions.$missionId.tsx` (bouton PDF + champs contact livraison)
- `src/styles.css` (token bleu électrique)
- `src/components/ui/button.tsx` (variante `electric`)

**Fichiers créés :**
- `src/lib/edl-final-pdf.ts`
- Migration SQL

**Ce qui ne change pas :**
- Logique paiements, rôles, RLS, flux mission, signatures déjà fonctionnelles (juste alignement arrivée sur départ), génération facture/devis PDF existants.

---

Confirmes-tu ce plan ? Je l'implémente d'un coup ensuite.
