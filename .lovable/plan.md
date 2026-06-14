
# Suivi mission client — complet, en direct et après livraison

## Objectif

Quand un client ouvre une mission (en cours OU terminée) dans `/dashboard-client/missions`, il doit voir et télécharger :

1. Suivi GPS live + timeline d'étapes + ETA
2. Carte grise (recto/verso)
3. Photos d'inspection départ + arrivée (lightbox, téléchargeables individuellement)
4. Signatures (départ / arrivée)
5. Documents partagés (PV livraison, PV restitution, CG, contrat, autres)
6. **Un PDF unique consolidé** (toutes les preuves dans un rapport) — toujours disponible si la mission a au moins une preuve, sans dépendre du flag `pdf_share_client`
7. Téléchargement individuel de chaque pièce (photo, signature, document)

## Diagnostic

L'écran `dashboard-client.missions.$missionId.tsx` rend déjà `MissionLiveTracker` + `MissionClientGallery`, mais 3 verrous bloquent les clients :

- **Résolution attribution fragile** : sur d'anciennes missions (avant la séquence numero), le matching `numero_mission` peut échouer ; le fallback trajet exige une triple égalité (`depart` / `arrivee` / `date_trajet`) qui ne tient pas si l'admin a normalisé une adresse → `attributionId` reste `null` → aucun bloc suivi/galerie n'apparaît.
- **PDF EDL conditionné à `pdf_share_client`** : tant que l'admin n'a pas coché le partage, le client ne voit rien à télécharger, même sur une mission livrée et signée. Le besoin exprimé est l'inverse : le PDF doit être disponible dès qu'il y a des preuves.
- **Téléchargement individuel** : la galerie ouvre un lightbox mais ne propose pas de bouton « Télécharger » par photo/signature/CG.

Les RLS et le bucket sont déjà OK (migration `is_attribution_client` + politiques `inspection_photos` / `mission_signatures` / `mission_documents` / `mission_locations` / `mission_etape_history` + storage `inspection-photos` / `mission-selfies` / `mission-documents`). Pas de nouvelle migration nécessaire pour le client. Les RLS bucket `cartes-grises` côté client sont à vérifier — j'ajoute une policy SELECT scopée si manquante.

## Plan d'exécution

### 1. Résolution attribution robuste (composant détail mission client)
Fichier : `src/routes/_authenticated/dashboard-client.missions.$missionId.tsx`
- Garder le matching par `numero_mission` en priorité.
- Étendre les fallbacks dans cet ordre :
  1. Trajet par `commande_ref = mission.numero` (devis/demande).
  2. Trajet via `devis.id` (si `mission.devis_id` ou via `commande_ref`).
  3. Trajet par `(depart ILIKE %ville%, arrivee ILIKE %ville%, date_trajet)`.
  4. Dernière attribution `convoyeur_id IS NOT NULL` sur le trajet trouvé.
- Logger discrètement en console quand aucun n'aboutit, mais afficher quand même un message « Suivi non encore disponible » sans casser la page.

### 2. PDF unique consolidé sans dépendance admin
Fichier : `src/routes/_authenticated/dashboard-client.missions.$missionId.tsx`
- Remplacer la condition `pdfShareEnabled` par « PDF disponible dès qu'il existe au moins 1 photo OU 1 signature OU 1 document partagé ».
- Le bouton « Télécharger le rapport PDF » utilise `generateEdlFinalPdf` (déjà en place) et empile **toutes** les preuves résolues côté client.
- Garder un fallback gracieux : si rien à mettre, masquer le bouton (pas d'erreur).

### 3. Téléchargement individuel des pièces (galerie)
Fichier : `src/components/mission/MissionClientGallery.tsx`
- Sur chaque `ImgTile` (photos, CG, signatures) : ajouter une icône « Download » qui force `download=` via un `<a>` masqué (fonctionne car URLs signed même cross-bucket).
- Pour les signatures (data URL base64), convertir en `Blob` à la volée pour permettre le `download`.
- Conserver l'ouverture en lightbox au clic principal ; le bouton download est un sous-bouton dédié.

### 4. Petit polish du tracker
Fichier : `src/components/mission/MissionLiveTracker.tsx`
- Aucun changement structurel : la timeline + GPS live + ETA fonctionnent déjà ; juste s'assurer qu'on n'affiche pas « En attente du démarrage » quand la mission est `termine` (cas déjà couvert via `isFinished`, à confirmer).
- Sur mission terminée, afficher le trajet final (origin/dest + tracé complet) au lieu d'attendre un nouveau point GPS.

### 5. Vérif RLS bucket carte grise (préventif, micro-migration uniquement si manquant)
Avant migration je lis la policy actuelle de `storage.objects` pour le bucket `cartes-grises`. Si aucune SELECT client n'existe, j'ajoute :
```sql
-- Pseudo (uniquement si nécessaire) :
-- Clients lisent la CG du trajet d'une de leurs missions
```
Sinon, rien à faire.

## Détails techniques

- Pas de nouveau hook ni de nouvelle table : tout passe par la résolution composant + le composant `MissionClientGallery` enrichi.
- `generateEdlFinalPdf` (déjà testé) accepte la signature actuelle ; on lui passe les photos signées + signatures + équipements + KM exactement comme aujourd'hui, juste sans le gate `pdf_share_client`.
- Realtime déjà OK (les tables sont dans `supabase_realtime`), donc les nouvelles photos/signatures apparaissent live dans la galerie tant que le client est sur la page (un `bumpKey` du hook réalimente déjà l'effet).
- Pas de changement côté admin pour cette étape : le besoin n'inclut pas le dispatch admin ici.

## Hors scope (volontairement)

- Dispatch carto admin « style Uber » — sera traité dans un lot séparé.
- Génération d'un PDF côté serveur — on garde la génération client (déjà en place, suffisant pour la volumétrie).

## Validation après build

1. Mission terminée d'un client de test → la page détail affiche tracker (avec trajet figé) + galerie + bouton PDF + téléchargements unitaires.
2. Mission en cours → GPS live + ETA + timeline qui avance + nouvelles photos qui apparaissent sans refresh.
3. Tester un cas issu de `devis` (paiement Stripe) ET un cas issu de `demandes_convoyage` pour valider la résolution attribution.
