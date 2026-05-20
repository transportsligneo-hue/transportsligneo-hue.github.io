# Finalisation workflow conducteur

Suite des travaux déjà entamés (séquence EDL réordonnée, `ArriveeSignatureSheet` créé, logique EV branchée). Reste à finaliser l'intégration côté cockpit et l'outil admin.

## 1. Cockpit conducteur (`MissionCockpit.tsx`)

- Ajouter l'étape `signature_arrivee` **entre** "Arrivé livraison" et la fin de mission, distincte de l'inspection.
- Empêcher l'ouverture automatique de `EdlPremiumFlow` au moment du tap "Arrivé au lieu de livraison" : l'inspection devient un bouton manuel ("Démarrer état des lieux livraison").
- Nouvelle séquence d'actions livraison :
  1. Arrivé au lieu de livraison
  2. État des lieux livraison (photos seulement, pas de signature)
  3. Signatures arrivée (driver + client) via `ArriveeSignatureSheet`
  4. Envoi admin / clôture mission
- Anti double-clic : `disabled` + flag local `isSubmitting` sur chaque bouton d'action workflow.

## 2. Fiabilité photos EDL

- Dans `EdlPremiumFlow.tsx` : badge statut par photo (`pending` / `sent` / `error`) lu depuis l'état d'upload.
- Bouton "Réessayer" par photo en erreur (ré-appelle l'upload sans reprendre la photo).
- File d'attente offline simple via `localStorage` (clé `edl-queue-{missionId}`) rejouée au retour online (`window.addEventListener('online')`).

## 3. Scanner documents (étape 17)

- Nouveau composant `DocumentScanner.tsx` (canvas natif, détection 4 coins + recadrage manuel + correction perspective basique).
- Branché uniquement sur les 2 derniers steps (PV livraison + Carte grise), le reste reste en capture photo standard.

## 4. Admin — suppression photo

- Dans `admin.missions.$missionId.tsx`, sur chaque vignette `inspection_photos` : bouton corbeille (admin/super_admin only).
- Action : `DELETE` storage `inspection-photos` + `DELETE` ligne `inspection_photos`.
- Confirmation modale avant suppression.
- Le conducteur pourra ainsi reprendre une photo manquante via le flow EDL existant (slot redevient vide).

## Détails techniques

- **Fichiers modifiés** : `src/components/convoyeur/MissionCockpit.tsx`, `src/components/inspection/EdlPremiumFlow.tsx`, `src/routes/_authenticated/admin.missions.$missionId.tsx`.
- **Fichiers créés** : `src/components/inspection/DocumentScanner.tsx`.
- **Pas de migration DB** nécessaire (les tables `mission_signatures`, `inspection_photos` existent déjà avec les bonnes RLS).
- **Aucune suppression** de code existant : les anciennes étapes `cote_droit`/`cote_gauche` restent en base, simplement masquées du flow actif.

## Garanties

- Aucune fonctionnalité existante supprimée.
- Étape câble électrique conditionnée à `demandes_convoyage.carburant ∈ {electrique, hybride_rechargeable}`.
- Signatures jamais déclenchées avant la fin des photos livraison.
- Admin peut nettoyer les photos ratées sans intervention dev.
