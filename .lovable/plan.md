# Dashboard Client — corrections d'affichage et suivi

Périmètre strictement limité aux fichiers du Dashboard Client. Aucune modification du DevisGenerator partagé, du moteur de prix, des paiements, des tables ou des triggers Cloud. Pas de migration SQL.

## 1. Lisibilité de l'estimateur (Nouvelle réservation)

**Cause identifiée** : `src/routes/_authenticated/dashboard-client.nouvelle-reservation.tsx` enveloppe `DevisGenerator` dans `<div class="card-premium">`. Or dans `.client-shell`, `card-premium` est repeint en surface très claire (`rgba(255,255,255,0.10)`). Les blocs internes du générateur (récap prix, récap final) utilisent `bg-white/[0.03]` + `text-cream/45` qui deviennent illisibles sur ce fond clarifié — c'est le "blanc sur fond clair" signalé.

**Action** :
- Retirer le wrapper `card-premium` dans `dashboard-client.nouvelle-reservation.tsx` et laisser le composant gérer son propre fond navy (`#0b1026/85`), comme sur le landing. Le titre `text-primary` reste au-dessus, sur le fond client-shell.
- Ajouter une règle CSS ciblée dans `src/styles.css` (section `.client-shell`) pour forcer les sous-blocs translucides du générateur à un fond navy minimal — uniquement quand le générateur apparaît dans le shell client. Sélecteur ciblé sur l'attribut `data-devis-summary` ajouté côté route (voir étape suivante) pour ne pas toucher la version landing.

Pas de refonte du `DevisGenerator` — uniquement le container du dashboard.

## 2. Suivi de mission lisible et étapes détaillées

**Fichier** : `src/components/mission/MissionLiveTracker.tsx`

Le composant utilise un thème clair (`bg-white`, `text-slate-700/900`) qui jure visuellement avec le shell client (bleu nuit) et ne reprend pas l'identité Ligneo.

**Action — re-skinner sans casser la logique** :
- Conserver intacts : `useMissionRealtime`, `GpsMapView`, les états `allPoints`, `rt.statut`, `rt.etape_courante`, `rt.lastEtape`, `rt.lastGps`. Aucun changement aux requêtes Supabase.
- Remplacer `bg-white` → `card-premium`, `text-slate-*` → `text-cream/text-cream/80`, `bg-slate-50` → `bg-navy/40`, `bg-emerald-100 text-emerald-700` → variantes `bg-emerald-500/15 text-emerald-300 border-emerald-500/30` (mêmes tokens que `StatusBadge` ailleurs).
- **Enrichir `ETAPE_LABELS`** avec les étapes manquantes pour couvrir les libellés demandés par l'utilisateur :
  - `prise_en_charge` → "Véhicule récupéré"
  - `edl_depart` → "Inspection de départ"
  - `en_route` → "Trajet en cours"
  - `edl_arrivee` → "Inspection d'arrivée"
  - `signature_arrivee` → "En attente de signature"
  - `livraison` → "Arrivé au lieu de livraison"
  - `termine` → "Mission terminée"
- Ajouter une **mini-timeline verticale** (CSS pur, pas de framer-motion) listant les étapes du flow et marquant celles validées (basé sur l'index de l'étape courante dans `ETAPE_LABELS`). L'étape active pulse en bleu électrique.

## 3. Demandes visibles avant conversion en mission

**Fichier** : `src/routes/_authenticated/dashboard-client.index.tsx`

Aujourd'hui la section "Mes demandes en cours" lit déjà `devis` (les demandes de devis sont bien affichées). En revanche :
- Le bandeau « Dernière mission » disparaît si l'admin n'a pas encore créé de mission, sans message rassurant.
- Les demandes qui passent dans `demandes_convoyage` (formulaire de contact convoyage) ne sont pas listées.

**Action** :
- Ajouter une requête parallèle sur `public.demandes_convoyage` filtrée par `user_id` ou `email` (RLS déjà OK : policy "Clients can read own demandes"), et fusionner ces lignes dans la section "Mes demandes" avec un badge dédié ("Demande envoyée" / "En cours de validation").
- Mettre à jour la fonction `demandeStatusInfo` pour inclure les statuts `nouvelle`, `en_traitement` issus de `demandes_convoyage`.
- Quand `lastMission` est `null` mais qu'au moins une demande existe, afficher un bloc rassurant : titre "Votre demande est en cours de validation" + texte "Une fois validée par notre équipe, elle apparaîtra ici comme mission en cours."
- Ajouter une 5ᵉ carte de stats "Demandes" si non-zéro, ou enrichir la stat existante "Devis" en "Demandes & devis".

## 4. Page « Mes missions » — couvrir le cas "pas encore convertie"

**Fichier** : `src/routes/_authenticated/dashboard-client.missions.tsx`

Ajouter sous la liste des missions un bloc **discret** listant les demandes/devis non encore convertis (mêmes données que l'index, requête sur `devis` + `demandes_convoyage` avec `mission_id IS NULL`). Chaque entrée renvoie vers `/dashboard-client/devis` (déjà la cible naturelle pour suivre les devis).

Pas de modification de la table missions ni de la requête principale.

## 5. Préservation

- Aucune migration SQL.
- Aucun changement aux RLS, triggers, ou edge functions.
- Aucune modification de `DevisGenerator.tsx`, `MissionCockpit.tsx`, `EdlPremiumFlow.tsx`, du flux conducteur, des paiements Stripe ou de la génération PDF.
- Les statuts existants restent gérés tels quels — on ajoute uniquement des libellés humains côté affichage.
- Composants ré-utilisés : `StatusBadge`, `missionStatusKind`, `missionStatusLabel`.

## Fichiers touchés

```
src/routes/_authenticated/dashboard-client.nouvelle-reservation.tsx   (wrapper + attribut data-)
src/routes/_authenticated/dashboard-client.index.tsx                  (requête demandes_convoyage + bloc rassurant)
src/routes/_authenticated/dashboard-client.missions.tsx               (bloc demandes en attente)
src/components/mission/MissionLiveTracker.tsx                         (re-skin + timeline + libellés)
src/styles.css                                                        (override ciblé .client-shell sur bloc estimateur)
```

Aucun autre fichier n'est touché.
