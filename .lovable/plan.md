## Objectif

Apporter dans chaque espace client un panneau "Suivi de mission" complet, en lecture seule, avec le même contenu que la fiche admin (GPS temps réel, photos EDL, signatures horodatées, historique d'étapes, incidents, infos convoyeur), sans aucune fonction d'édition / suppression / bypass / note interne.

Sécurité : RLS déjà en place côté DB (policies "Clients read … of own missions" sur `mission_locations`, `mission_etape_history`, `mission_signatures`, `mission_selfies`, `mission_incidents`, via `is_mission_client`). **Aucune migration nécessaire.**

Design : style espace client (card-premium navy + accents dorés, typo Playfair) — conforme à la mémoire de marque.

---

## Composant central réutilisable

Nouveau composant **`src/components/mission/MissionTrackingPanel.tsx`** (lecture seule, réutilisable Particulier / B2B / Flotte) regroupant :

1. **En-tête mission** — numéro, statut, départ → arrivée, date/heure de prise en charge, durée si terminée.
2. **Convoyeur** — prénom + nom + ville + téléphone + email (bouton click-to-call/mail). Pas de selfies dans les espaces clients (conformément à la consigne utilisateur).
3. **Suivi temps réel** — réutilise `MissionLiveTracker` existant (carte GPS, timeline étapes, ETA).
4. **Photos état des lieux** — galerie classée **Départ / Pendant / Arrivée** (le bucket existant range par `inspection.type` = `depart` / `arrivee` ; tout selfie/photo intermédiaire éventuelle ira dans "Pendant"). Lightbox plein écran, horodatage par photo, signed URLs 1h.
5. **Signatures horodatées** — réutilise `MissionTraceability` existant (variant="full") : départ convoyeur + client, arrivée convoyeur + client, miniature + date/heure.
6. **Historique chronologique complet** — lit `mission_etape_history` (toutes les étapes, pas seulement la dernière) + dérive : arrivée sur place, début intervention, fin intervention, événements importants. Affichage en timeline verticale avec horodatages.
7. **Incidents éventuels** — lit `mission_incidents` en lecture seule (type, description, photos jointes, date).
8. **Documents partagés** — réutilise `MissionClientGallery` (déjà filtre les docs partageables côté client).
9. **Bandeau temps réel** — abonnement Supabase Realtime sur `mission_locations`, `mission_etape_history`, `mission_signatures`, `mission_incidents` pour rafraîchir GPS/timeline/signatures sans reload.

**Aucun bouton d'action** dans ce panneau : pas de delete, pas d'override, pas d'AdminLiveControl, pas de note interne, pas d'édition contact, pas de Stripe.

---

## Intégration dans les espaces clients

### 1. Particulier — `/dashboard-client/missions/$missionId`
- `ClientMissionDetailView` simplifié : conserve l'en-tête véhicule / coordonnées / facture / téléchargement EDL PDF, **remplace** les blocs partiels actuels par `<MissionTrackingPanel />`.

### 2. B2B / Pro — `/dashboard-pro/missions/$missionId`
- Déjà câblé via `ClientMissionDetailView` → bénéficie automatiquement du nouveau panneau.

### 3. Flotte — nouveau
- Créer **`src/routes/_authenticated/flotte.missions.$missionId.tsx`** qui rend `<MissionTrackingPanel missionId=… backTo="/flotte/missions" />`.
- Mettre à jour `flotte.missions.tsx` pour rendre chaque ligne cliquable (Link vers la route détail).

---

## Détails techniques

- Chargement : un seul `useEffect` qui résout `mission → attribution → trajet → convoyeur` (logique déjà présente dans `ClientMissionDetailView`, extraite dans un hook `useMissionTrackingData(missionId)`).
- Realtime : un canal Supabase unique par mission, désabonné au unmount.
- Photos & docs : `createSignedUrl(…, 3600)` ; classement "Pendant" = photos liées à l'attribution mais hors inspections `depart`/`arrivee` (selfies exclus, conformément à la demande).
- Responsive : grille `lg:grid-cols-3` pour desktop, `space-y-5` empilé en mobile. Composants tactiles ≥ 44 px.
- Aucun changement de schéma DB, aucune nouvelle policy RLS, aucun edge function.

---

## Fichiers touchés

```
created  src/components/mission/MissionTrackingPanel.tsx
created  src/hooks/useMissionTrackingData.ts
created  src/routes/_authenticated/flotte.missions.$missionId.tsx
edited   src/components/mission/ClientMissionDetailView.tsx   (utilise le panneau)
edited   src/routes/_authenticated/flotte.missions.tsx        (liens vers détail)
```

Aucune migration SQL. Aucun secret à ajouter.

---

## Vérifications post-implémentation

- Client particulier voit GPS live + photos + signatures horodatées sur sa mission, et **ne voit pas** les missions d'autres clients (RLS).
- Client B2B/Pro idem via `/dashboard-pro/missions/:id`.
- Espace flotte : la liste des missions ouvre la nouvelle page détail avec le même panneau.
- Aucun bouton d'édition / suppression / bypass visible dans aucun des trois espaces.
- Mise à jour temps réel : un nouveau point GPS ou une nouvelle étape apparaît sans recharger.