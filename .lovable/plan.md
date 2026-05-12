# Refonte finale admin + parcours client véhicule

## 1. Base de données (1 migration)

Ajouter les colonnes véhicule manquantes pour faire circuler les infos du devis → mission → driver.

- `devis` : `vin text`, `carte_grise_recto_url text`, `carte_grise_verso_url text`, `vehicule_docs_completed boolean default false`
- `trajets` : `vin text`, `carte_grise_recto_url text`, `carte_grise_verso_url text` (copiés au moment de la création depuis devis)
- `missions` : idem (copiés depuis trajet/devis)
- `profiles` : `adresse text` (déjà demandé précédemment)
- Bucket storage `cartes-grises` (privé) + RLS : client lit/écrit ses propres fichiers `{user_id}/...`, admin lit tout, convoyeur lit ceux de ses missions assignées
- Trigger `auto_create_trajet_from_devis` : étendre pour copier `vin`, `carte_grise_*`

## 2. Auto-prix client TTC partout (pricing engine)

Règle unique : quand un devis accepté/payé existe pour la demande/trajet, `prix_client_ttc` est :
- pré-rempli automatiquement depuis `devis.prix_estime`
- verrouillé par défaut (read-only)
- modifiable seulement via un toggle "ajustement admin" (promo / pénalité)

Composant : `PricingModeBlock` accepte déjà `lockedClientPrice`. Il faut :
- l'utiliser dans `admin.attributions.tsx` (création depuis demande)
- l'utiliser dans le drawer "Modifier trajet"
- l'utiliser dans le drawer Demande (bouton "Convertir en trajet" passe le prix)
- helper `resolveDevisPrice(demande_id|email|trajet_id)` dans `src/lib/pricing-resolver.ts`

## 3. Drawer bleu unique — finir la conversion

Créer/finir `src/components/admin/drawers/` :
- `TrajetDrawer.tsx` — voir / modifier trajet, prix verrouillé, attribution inline
- `AttributionDrawer.tsx` — voir attribution, changer convoyeur, statut
- `MissionDrawer.tsx` — détail mission complet (étapes, photos, docs, VIN, carte grise)
- `DevisDrawer.tsx` — détail devis + paiement + véhicule
- `FactureDrawer.tsx` — détail facture + PDF
- `ConvoyeurDrawer.tsx` — fiche convoyeur + missions + docs

Pages liste à convertir (supprimer Links vers `$id`, ajouter `useState` + drawer en bas) :
- `admin.trajets.tsx`, `admin.attributions.tsx`, `admin.devis.tsx`, `admin.factures.tsx`, `admin.convoyeurs.tsx`

Suppression des routes détail admin :
- `admin.devis.$devisId.tsx`
- `admin.factures.$factureId.tsx`
- `admin.missions.$missionId.tsx`
- `admin.clients.$clientId.tsx`
- `admin.convoyeurs.$convoyeurId.tsx`

Tous remplacés par état `selected` qui ouvre le drawer.

## 4. Parcours client — upload obligatoire avant paiement

Nouveau composant `src/components/devis/VehiculeDocsStep.tsx` :
- Champ VIN (validation 17 caractères alphanumériques sans I/O/Q)
- Upload carte grise recto (obligatoire)
- Upload carte grise verso (optionnel)
- Compression image client-side (`compressImage` existe déjà)
- Preview immédiate
- Mobile-friendly avec `capture="environment"` pour caméra directe

Intégration dans le parcours :
- `dashboard-client/devis` (si devis non payé) → bouton "Compléter avant paiement"
- Bloque `DevisEmbeddedCheckout` tant que `vehicule_docs_completed = false`
- Sauvegarde sur `devis.vin` / `devis.carte_grise_*` + flag

## 5. Visibilité VIN / carte grise

- **Admin** : section "Véhicule" dans drawers Devis/Trajet/Mission avec aperçu carte grise + VIN copiable
- **Convoyeur** : `convoyeur.missions.tsx` + `MissionWorkflow` → bloc "Documents véhicule" avec liens signés vers carte grise
- RLS bucket : convoyeur peut lire les fichiers carte grise via path = `{user_id_du_client}/{devis_id}/...` si attribution active

## 6. Mobile

- Drawer admin : `w-full` sur mobile (déjà OK via Sheet)
- Upload carte grise : `<input type="file" accept="image/*" capture="environment">` pour caméra
- Aperçu image fluide, barre de progression Tailwind

---

## Architecture cible

```text
DEVIS accepté
  └── client complète : VIN + carte grise (NOUVEAU step bloquant)
        └── PAIEMENT
              └── trigger auto crée TRAJET (avec VIN + carte grise copiés)
                    └── ADMIN attribue → ATTRIBUTION (prix verrouillé depuis devis)
                          └── MISSION (convoyeur voit VIN + carte grise)
```

## Ordre d'exécution

1. Migration BDD + bucket storage + RLS
2. Helper `pricing-resolver.ts`
3. `VehiculeDocsStep` + intégration dashboard-client
4. Drawers manquants (Trajet, Attribution, Mission, Devis, Facture, Convoyeur)
5. Conversion pages liste + suppression routes `$id`
6. Affichage carte grise/VIN côté admin et convoyeur

## Hors périmètre

- Refonte visuelle des autres composants client/convoyeur
- OCR carte grise (peut venir dans une itération suivante)
- Validation manuelle admin de la carte grise (peut être ajoutée plus tard)
