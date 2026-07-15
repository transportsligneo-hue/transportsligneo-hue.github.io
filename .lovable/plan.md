## Objectif

Remplacer la signature manuscrite du devis client par une **validation par code à 6 chiffres envoyé par e-mail** (OTP), ajouter un **bouton Refuser**, générer un **PDF signé avec cartouche de preuve**, et afficher le tout dans l'admin.

Aucune fonctionnalité existante n'est cassée : le flux d'acceptation actuel (`acceptDevis`, `devis_acceptations`, verrouillage, notif admin, e-mails) reste la colonne vertébrale, on remplace juste l'étape "signature dessinée" par "code OTP" et on ajoute le refus.

---

## Base de données

**Nouvelle table `devis_otp_challenges`** (défis OTP à durée limitée)
- `devis_id`, `client_user_id`, `email` destinataire
- `code_hash` (SHA-256 du code, jamais le code en clair)
- `expires_at` (10 min), `attempts` (max 5), `consumed_at`
- RLS : le client voit/crée uniquement ses propres challenges ; admin voit tout ; edge/serveur écrit via service role

**Colonnes ajoutées à `devis_acceptations`**
- `validation_method` (`email_otp` par défaut, extensible)
- `otp_sent_at`, `otp_verified_at`

**Colonnes ajoutées à `devis`**
- `refused_at`, `refus_motif` (nullable)
- Statut `refuse` déjà supporté

Historique complet : les tables `devis_status_history` + `devis_acceptations` capturent déjà chaque transition, on continue à les alimenter.

---

## Server functions (TanStack, RLS respectée)

Dans `src/lib/devis-signature-otp.functions.ts` :

1. **`requestDevisOtp({ devisId })`**
   - Vérifie que le devis appartient au client et n'est pas verrouillé
   - Génère un code 6 chiffres cryptographiquement aléatoire
   - Stocke le hash + expiration (10 min) dans `devis_otp_challenges`
   - Envoie l'e-mail via l'infra existante (`sendTransactionalEmail`, template `devis-otp-code`)
   - Rate-limit : max 3 envois / 10 min par devis
   - Retour : `{ ok, expiresAt, maskedEmail }`

2. **`verifyDevisOtpAndSign({ devisId, code })`**
   - Compare le hash du code, vérifie non-expiration et `attempts < 5`
   - Incrémente `attempts` sur échec, marque `consumed_at` sur succès
   - Sur succès : appelle la logique d'acceptation existante (insert `devis_acceptations` avec `validation_method=email_otp` + IP + UA + `otp_verified_at`, `locked_at`+`accepted_at`+statut sur `devis`, notif admin, push)
   - Génère et upload le PDF signé avec cartouche (voir plus bas) dans le bucket `devis-acceptes`
   - Envoie l'e-mail de confirmation client (template existant `devis-accepte`) et admin (`devis-accepte-admin`)

3. **`refuseDevis({ devisId, motif? })`**
   - Vérifie propriété + non-verrouillage
   - Update `devis.statut = 'refuse'`, `refused_at`, `refus_motif`
   - Insert dans `devis_status_history`
   - Notifie l'admin (RPC + push)

---

## E-mail OTP

Nouveau template `src/lib/email-templates/devis-otp-code.tsx` :
- Enveloppe `LigneoEmailShell` existante (bleu nuit / doré Playfair)
- Highlight-box centrale avec le code à 6 chiffres en très gros
- Rappel : validité 10 minutes, à ne pas partager, devis + montant
- Enregistré dans `src/lib/email-templates/registry.ts`

---

## PDF signé — cartouche de preuve

Extension de `src/lib/devis-pdf.ts` (ou nouveau `devis-pdf-signed.ts`) :
- Reprend le PDF de devis existant
- Ajoute en dernière page un **cartouche "Signature électronique"** :
  - Nom / e-mail du signataire
  - Méthode : `Code de validation par e-mail (OTP 6 chiffres)`
  - Date/heure UTC + fuseau
  - Adresse IP + User-Agent tronqué
  - Numéro et version du devis, montant TTC accepté
  - `Hash SHA-256` du PDF original (empreinte)
  - Version des CGV acceptées
  - Bandeau visuel : "Devis signé électroniquement — valeur probante conforme eIDAS niveau simple"
- Upload dans `devis-acceptes/{userId}/{devisId}-signed.pdf`
- URL renseignée dans `devis_acceptations.pdf_url`

---

## UI client — `src/components/devis/DevisAcceptationStep.tsx`

Refonte du composant (garde le même contrat de props / `onAccepted`) :

```text
┌─────────────────────────────────────────────┐
│  Devis LIG-2026-0123        1 240,00 € TTC  │
│  Tours → Bordeaux · Peugeot 3008            │
├─────────────────────────────────────────────┤
│  Étape 1 — Choisir                          │
│  [  Accepter et signer  ]  [  Refuser  ]    │
├─────────────────────────────────────────────┤
│  Étape 2 — Code de validation               │
│  Un code a été envoyé à j***@gmail.com      │
│  [ _ ][ _ ][ _ ][ _ ][ _ ][ _ ]             │
│  Renvoyer le code (dans 42s)                │
│  [       Valider et signer le devis       ] │
└─────────────────────────────────────────────┘
```

- Composant OTP à 6 cases (utilise `input-otp` déjà présent dans shadcn ou saisie contrôlée)
- Compteur d'expiration + bouton "Renvoyer" (grisé pendant 60 s)
- Écran de succès : cocarde verte + bouton "Télécharger le devis signé"
- Écran refus : petite confirmation + motif optionnel (textarea 300 car.)
- Toutes les erreurs remontent via `toast` (code invalide, expiré, trop d'essais)

---

## UI admin — `src/routes/_authenticated/admin.devis.$devisId.tsx`

Ajout d'un bloc "Preuves de signature" :
- Statut : badge `En attente` / `Signé` / `Refusé`
- Date/heure de signature, méthode (`E-mail OTP`), IP, User-Agent
- Bouton "Télécharger PDF signé"
- Section historique : liste chronologique des lignes `devis_status_history` + `devis_acceptations` + envois OTP
- Si refusé : motif visible

---

## Notifications admin

Réutilise `create_admin_notification` + push existants — signal "Devis signé" est déjà envoyé par `acceptDevis`, on ajoute une notif "Devis refusé" et éventuellement "OTP demandé" (silencieux, dans le feed).

---

## Sécurité

- Code stocké **hashé (SHA-256)** uniquement, jamais en clair
- Expiration stricte 10 min, max 5 tentatives, max 3 renvois / 10 min
- IP + User-Agent capturés côté serveur
- Bucket PDF privé, URLs signées 1h pour le téléchargement
- Devis verrouillé une fois signé (`locked_at`) → immuable
- Aucun changement d'API publique existante, tout passe par des server functions authentifiées

---

## Fichiers touchés / créés

Créés
- `src/lib/devis-signature-otp.functions.ts`
- `src/lib/email-templates/devis-otp-code.tsx`
- Migration DB (nouvelle table + colonnes + RLS + GRANTs)

Modifiés
- `src/components/devis/DevisAcceptationStep.tsx` (refonte UI, garde le contrat)
- `src/lib/devis-pdf.ts` (ajout cartouche signature)
- `src/lib/email-templates/registry.ts`
- `src/routes/_authenticated/admin.devis.$devisId.tsx` (bloc preuves)
- `src/routes/_authenticated/dashboard-client.devis.tsx` (bouton refuser + succès)

Inchangés (base légale conservée)
- `src/lib/devis-acceptation.functions.ts` — reste utilisée en interne par le nouveau flux OTP
- `devis_acceptations` — enrichi, pas cassé
- Templates e-mails `devis-accepte`, `devis-accepte-admin` — réutilisés

---

## Points à confirmer

- OK pour ne PAS supprimer le rendu de signature manuscrite (canvas) mais le remplacer complètement par le flux OTP côté client ? (l'ancien composant `SignatureCanvas` reste dispo pour l'état des lieux)
- La durée d'expiration du code (10 min) et le nombre max de tentatives (5) te conviennent ?
