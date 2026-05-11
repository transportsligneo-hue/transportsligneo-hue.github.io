# Refonte Dashboard Admin — SaaS Premium

Refonte complète de la partie admin sans casser le backend ni les flux existants. Découpage en 5 lots pour livrer progressivement et permettre de valider visuellement entre chaque étape.

## Principes directeurs

- **Pleine page partout** : suppression des modales/overlays sur clients, convoyeurs, demandes, missions. Chaque clic ouvre une vraie route `/admin/<entité>/:id`.
- **Design tokens admin** : nouveau thème clair, bleu électrique, glassmorphism subtil, scoped via `.admin-shell` pour ne pas impacter le reste du site (client / driver).
- **Hiérarchie typographique forte** : titres XL, sous-titres, labels muted, valeurs gros/foncés, badges colorés pour les statuts.
- **Connectivité** : chaque page détail relie client ↔ demandes ↔ devis ↔ missions ↔ convoyeur ↔ inspection ↔ paiements ↔ factures.
- **Realtime** : abonnements Supabase sur les tables clés pour MAJ sans refresh.
- **Aucune migration DB** nécessaire — uniquement frontend + lecture des données existantes.

## Lot 1 — Fondation visuelle & layout admin

```text
[ Topbar : recherche universelle | alertes | profil ]
+----------+----------------------------------------+
| Sidebar  |  Contenu pleine largeur (admin-shell)  |
| fixe     |  - breadcrumb                          |
| (icônes  |  - header sticky                       |
|  + badges|  - sections                            |
|  compteur|                                        |
+----------+----------------------------------------+
```

- Nouveau layout `_authenticated/admin.tsx` avec sidebar fixe + topbar premium.
- Tokens CSS `.admin-shell` dans `src/styles.css` : fond gris/bleu clair, cartes blanches, bordures fines, ombres douces, bleu électrique `#2563eb`/`#3b82f6`, accents.
- Composants partagés : `AdminPageHeader`, `AdminBreadcrumb`, `AdminStatCard`, `AdminBadge`, `AdminTable` (sticky header, tri, filtres, recherche, pagination).
- Sidebar : Dashboard, Demandes, Estimations, Devis, Missions, Convoyeurs, Clients, Factures, Paiements, Inspections, Notifications, Support, Paramètres.

## Lot 2 — Dashboard home (tour de contrôle)

- KPI cards : nouvelles demandes, estimations, devis, missions actives, convoyeurs dispo, CA HT/TVA/TTC, taux conversion, alertes.
- Widgets : missions en cours (live), alertes critiques (selfie/signatures/photos manquants, paiement échoué), dernières demandes, top convoyeurs.
- Graphiques simples (CA 30j, conversion).
- Realtime : `missions`, `devis`, `admin_notifications`.

## Lot 3 — Routes détail pleine page (suppression des modales)

Création / refonte de :

- `/admin/clients/:id` — header + coordonnées + historique (demandes/devis/missions/incidents) + financier + notifications.
- `/admin/convoyeurs/:id` — profil + documents + disponibilités + missions + notation + paiements.
- `/admin/demandes/:id` — détails demande + client lié + devis générés + mission(s) + timeline.
- `/admin/missions/:id` — refonte de la page existante au nouveau design, en gardant la traçabilité EDL/signatures déjà connectée au Lot 4 driver.

Suppression / remplacement des `Dialog`/overlays actuels par `<Link>` vers ces routes.

## Lot 4 — Tableaux & listes premium

- Refonte des listes : Demandes, Devis, Missions, Convoyeurs, Clients, Factures, Paiements, Inspections.
- Colonnes claires, tri, filtres, recherche, pagination, sticky header, version mobile lisible (cards), export.
- Badges statuts cohérents (vert/orange/rouge/bleu).

## Lot 5 — Notifications, realtime & alertes auto

- Centre de notifications admin (déjà partiellement présent) refondu : filtres, mark all read, deep links.
- Alertes automatiques calculées côté front à partir des données :
  - selfie convoyeur manquant
  - signatures départ/arrivée manquantes
  - paiement échoué
  - inspection incomplète (photos manquantes)
- Realtime branché sur `admin_notifications`, `missions`, `mission_documents`, `inspection_photos`.

## Détails techniques

- Stack inchangée : TanStack Router file-based, TanStack Query, Tailwind, shadcn.
- Tout est scopé sous `.admin-shell` pour ne pas impacter `driver-shell` ni le site public.
- Pas de framer-motion (mémoire projet) — animations CSS/Tailwind uniquement.
- Pas de migration : on lit `profiles`, `convoyeurs`, `missions`, `devis`, `b2b_transport_requests`, `mission_documents`, `inspection_photos`, `admin_notifications`, `factures`, etc. déjà existants.
- Realtime : `ALTER PUBLICATION supabase_realtime` déjà actif pour `admin_notifications`, à étendre si besoin sur `missions` / `mission_documents` (migration ciblée si non actif).
- Sécurité : RLS existant inchangé, accès admin via `has_role(auth.uid(), 'admin')`.

## Ordre de livraison proposé

1. Lot 1 — Fondation (layout + tokens + composants partagés)
2. Lot 3 — Routes détail pleine page (priorité car c'est le point bloquant UX cité)
3. Lot 2 — Dashboard home
4. Lot 4 — Tableaux premium
5. Lot 5 — Notifications & realtime

Dis-moi si tu valides ce découpage, ou si tu veux qu'on commence par un autre lot (par ex. Lot 3 en premier pour tuer les pop-ups tout de suite).
