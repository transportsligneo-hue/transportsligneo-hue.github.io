
# Plan d'action — Corrections critiques & fiabilisation

Objectif : corriger les bugs bloquants, homogénéiser l'UX et améliorer les performances, sans casser l'existant ni introduire de régression.

Travail découpé en 9 lots livrables indépendamment. Je peux tout enchaîner, ou tu me dis par où commencer.

---

## Lot 1 — PDF : VIN + kilométrages

Fichiers : `src/lib/mission-pdf.ts`, `src/lib/devis-pdf.ts`, `src/lib/facture-pdf.ts`, `src/lib/edl-final-pdf.ts`, `src/components/MissionReport.tsx`, `src/components/mission/ClientMissionDetailView.tsx`.

- Ajouter dans la section "Informations véhicule" de chaque PDF :
  - **VIN** (depuis `trajets.vehicule_vin` / `demandes.vin` / `missions` selon source)
  - **Km départ** (depuis `inspections` étape départ)
  - **Km arrivée** (depuis `inspections` étape arrivée — affiché "—" si absent)
- Source de vérité unique : helper `getVehiculeInfo(missionId)` lisant `attributions` → `trajets` → `inspections` pour rester aligné avec l'admin.
- Affichage identique dans l'encadré véhicule de la fiche mission client/driver/admin.

## Lot 2 — Validation email & "Compte suspendu" (BUG CRITIQUE)

Cause probable : le label "Compte suspendu" est affiché dès que `email_confirmed_at IS NULL` OU dès que `profiles.statut != 'actif'`, alors que `handle_new_user` met déjà `statut='actif'`. À vérifier : `attente-validation.tsx`, `useAuth.tsx`, et la lecture de `profiles.statut`.

Actions :
1. Auditer la chaîne : trigger `handle_new_user`, route `/auth/email-confirmation`, hook `useAuth`, page `attente-validation`.
2. Garantir qu'après clic sur le lien Supabase :
   - `email_confirmed_at` est set (natif Supabase) ;
   - aucune logique ne repasse `profiles.statut` à `suspendu` ;
   - redirection vers `/auth/email-confirmation` (page déjà créée).
3. Remplacer tout label "Compte suspendu" par la bonne sémantique :
   - `email_confirmed_at IS NULL` → "Email non vérifié — renvoyer le lien"
   - `profiles.statut = 'suspendu'` (vrai cas admin) → "Compte suspendu, contactez le support"
4. Ajouter bouton "Renvoyer l'email de confirmation" sur la page login + attente-validation.
5. Vérifier que les convoyeurs en `pending` voient bien "En attente de validation admin" et non "suspendu".

## Lot 3 — Notifications push

État actuel : VAPID configuré, SW présent, `pushToUser`/`pushToAdmins` existent mais pas systématiquement câblés.

Audit + câblage des déclencheurs manquants :

| Évènement | Cible | Câblage |
|---|---|---|
| Nouvelle demande devis | admins | déjà via `notifyAdmin`, vérifier push |
| Nouveau devis signé | admins | à câbler dans `devis-acceptation.functions.ts` |
| Mission attribuée | convoyeur | à câbler dans `accept_mission_fixe` / serverFn |
| Statut mission change | client + convoyeur | hook sur `MissionWorkflow` save |
| Mission terminée | client + admin | déjà partiel |
| Nouveau message | destinataire | à câbler dans `admin.messages` |
| Inscription client/convoyeur | admins | déjà via `notifyAdmin` |

Aussi :
- Activer l'enregistrement du SW dès `PwaProvider` (vérifier que `getSubscription()` fonctionne sans clic manuel pour les utilisateurs déjà opt-in).
- Ajouter `PushNotificationToggle` dans la sidebar admin/client/convoyeur (actuellement peu exposé).
- Logger les erreurs `sendPushToUser` dans `activity_logs` pour diagnostic.

## Lot 4 — Emails transactionnels

Audit ciblé de chaque template du registry, vérification destinataires + variables + lien.

Checklist (un passage = un fix si écart) :
- Client : inscription, validation, reset MDP, devis créé, devis payé, mission confirmée, mission démarrée, mission livrée, mission terminée, facture dispo.
- Admin : nouvelle demande, nouveau devis, devis accepté, devis payé, B2B lead/paiement, inscription convoyeur, document mission.
- Convoyeur : attribution, validation compte, offre acceptée/refusée.

Pour chaque template : tester via `/lovable/email/transactional/preview`, vérifier `recipientEmail` réel, idempotencyKey unique, variables non vides.

## Lot 5 — Logo client visible partout (back-office)

Sources : `profiles.avatar_url` (client) + `organizations.logo_url` (société). Bucket `company-logos` déjà public.

Affichage à ajouter (composant réutilisable `<ClientLogo client={...} size="sm|md" />`) :
- `admin.clients.tsx` (liste) — avatar 32px à gauche du nom
- `admin.clients.$clientId.tsx` (fiche) — header avec logo 80px
- `admin.demandes.tsx`, `admin.devis.tsx`, `admin.missions.*` — colonne client avec logo
- Fiche mission convoyeur (`MissionCockpit`, `PremiumMissionHero`) — bloc "Client" avec logo + raison sociale

Fallback : initiales sur fond `card-premium`.

## Lot 6 — Nettoyage rédactionnel "ton IA"

Pass sur :
- `ServicesContent`, `AProposContent`, `HeroDesktop`, `Hero`, `Footer`, `blog-articles.ts`, templates emails, meta tags.
- Supprimer : `—` (em-dash) décoratifs, formulations "Découvrez l'expérience…", "premium" résiduel, doubles adjectifs ("rapide, simple et efficace").
- Reformuler en phrases courtes orientées action métier.

Pas de changement fonctionnel — uniquement copywriting.

## Lot 7 — UX/UI fluidité

- Lazy-load : routes admin lourdes (`admin.trajets`, `admin.historique`, blog) via `lazy()` déjà géré par TanStack — vérifier qu'aucune route n'importe en eager des libs lourdes (leaflet, pdf-lib).
- Pagination côté serveur sur `admin.devis`, `admin.missions`, `admin.factures`, `admin.clients` (range Supabase, 25/page) au lieu du fetch global actuel.
- Cache TanStack Query : `staleTime: 30s` pour listes admin, `Infinity` pour referentiels (pricing rules, app_settings).
- Mémoïsation des grosses tables (`React.memo` + `useMemo` sur filtres).
- Mobile : vérifier z-index carte GPS (déjà fix), padding bottom-nav, scroll sur modals plein écran.

## Lot 8 — Performance back

- `supabase--slow_queries` pour identifier le top 10.
- Index probables à ajouter (migration) :
  - `missions(user_id, statut)`, `attributions(convoyeur_id, statut)`, `trajets(statut_publication, date_trajet)`, `devis(user_id, statut)`, `mission_locations(attribution_id, recorded_at)`.
- Audit RLS coûteuses : `is_mission_client`, `is_attribution_client` (sous-requêtes multi-JOIN) — envisager une vue matérialisée `mission_access` rafraîchie par trigger si pg_stat_statements le justifie.
- Vérifier qu'aucun composant ne fait du N+1 (boucle `await` sur missions pour aller chercher inspections).

## Lot 9 — Contrôle qualité

Plan de tests Playwright headless :
1. Inscription client → email → activation → login → dashboard
2. Inscription convoyeur → attente validation admin → activation → mission
3. Création devis → signature → paiement → mission auto → attribution → workflow complet → PDF EDL + facture
4. Vérif push reçue à chaque étape clé
5. Vérif emails reçus (via `email_send_log`)
6. Vérif logo client visible dans 6 emplacements admin

---

## Ordre proposé d'exécution

1. **Lot 2** (BUG critique compte suspendu) — bloquant
2. **Lot 1** (PDF VIN/km) — rapide, à fort impact pro
3. **Lot 5** (logo client) — visuel, rapide
4. **Lot 4** (emails) puis **Lot 3** (push) — fiabilisation comms
5. **Lot 6** (copywriting) — pass global
6. **Lots 7 + 8** (perf) — nécessitent `slow_queries` + mesure avant/après
7. **Lot 9** (QA finale)

Confirme l'ordre (ou dis-moi quels lots prioriser) et je passe en mode build.
