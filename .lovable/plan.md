# Refonte Transports Lignéo — plan pluri-phases (avec analyse captures)

Choix produit confirmés :
- **Régime facturation** : Micro-entreprise (défaut, prix saisis = TTC) / Société assujettie TVA **multi-taux** (20 / 10 / 5,5 / 0), taux par ligne.
- **Attribution catalogue** : prix libre convoyeur (mode enchère). L'admin publie sans prix, les convoyeurs proposent leur tarif, l'admin accepte / refuse / contre-propose.

## Analyse des captures reçues

| Capture | Constat | Action prévue |
|---|---|---|
| **Paramètres** | Bandeau "stockés localement… branchés sur la DB lors d'un prochain incrément" — non persisté. Pas de choix de régime, pas de taux TVA. | Phase 1 : table `pricing_settings` + section Facturation avec radio Micro/Société + tableau taux TVA. |
| **Attributions** | Cards trop verbeuses, 6 icônes d'action non légendées, pas de filtres statut/client/date, pas de recherche. Le tri chronologique n'est pas évident. | Phase 4 : passage en tableau dense filtrable (statut, période, client, convoyeur, plaque) + actions groupées + hover reveal. |
| **Trajets** | Bandeau "n'affiche plus les partenariats" mange 15 % de l'écran, colonne prix cassée sur 2 lignes ("180 €"), pas de KPI. | Phase 4 : passage bandeau en toast dismissible + KPI (24 trajets, X en cours, X à facturer) + colonnes recalibrées + tri natif. |
| **Utilisateurs** | KPIs OK mais pas de fiche latérale rapide, pas d'export, filtres rôle/statut basiques, pas de tri. | Phase 4 : QuickView side sheet au clic ligne + tri colonnes + export CSV + actions bulk (suspendre, réinitialiser mdp). |
| **Paiements/Devis** | Courbe "Factures payées" vide (Récent) mais prend 200 px, hiérarchie tabs "Stripe B2C (0) / B2B (0) / Factures (9)" — la donnée réelle est cachée. | Phase 4 : courbe conditionnelle (masquée si vide < 3 points), ordre tabs par volume, badges monétaires cumulés dans chaque tab. |
| **Historique (flou et net)** | Libellés hashés `0d573428`, action = "user", payload JSON brut `{"role":"convoyeur"}`. Illisible. | Phase 4 : vue `v_activity_logs_readable` + composant `ActivityFeed` avec phrase humaine "Jean Dupont a promu Frédéric au rôle Convoyeur le 20/06/2026 à 04:47". |
| **Fiche Client (Morgane Landais)** | Panel latéral 90 % vide sous "Historique missions (15)" — les 15 missions ne s'affichent pas. Onglets absents. | Phase 4 : refonte fiche avec tabs (Vue / Missions / Devis / Factures / Documents / Historique / Notes), KPI header (CA total, missions en cours, dernière activité), actions rapides. |
| **Organisations & clients** | 2 lignes seulement, colonnes Score et Statut à moitié vides, pas de tri, pas d'action rapide autre que "Voir → 🗑". | Phase 4 : score calculé (missions / CA / paiement) + statut clair (actif / suspendu / prospect) + QuickView + fiche complète. |
| **Espace client — dernières missions** | Colonne Montant mélange "0.00 €" et "180.00 €" pour des missions au même statut "En attente" → incohérence prix (les demandes sans devis affichent 0). | Phase 2 : génération auto d'un devis à la création de la demande → montant systématiquement présent. Phase 1 : `formatMoney` unifié. |

## Phase 1 — Fondations tarification (source unique de vérité + régime TTC/HT)

**Migration**
- Table `pricing_settings` (singleton) : `regime` (`micro`|`societe`), `default_vat_rate`, `currency`. GRANT admin, RLS admin.
- Table `vat_rates` : liste éditable (20 / 10 / 5,5 / 0), flag `is_default`.
- Colonnes ajoutées à `devis` et `factures` : `regime_snapshot`, `vat_breakdown jsonb`, `total_ht`, `total_tva`, `total_ttc` (nullable — rétrocompat, valeurs `NULL` traitées comme "micro" avec montant existant = TTC).
- Trigger `set_pricing_snapshot` à l'insert d'un devis/facture.

**Front (module unique `src/lib/pricing/`)**
- `PricingProvider` initialisé au root, `usePricingRegime()` hook.
- `formatMoney(amount, opts)` — fonction unique appelée par admin, client, convoyeur, PDF, emails.
- Refonte `client-pricing.ts`, `b2b-pricing.ts`, `reservation-pricing.ts`, `pricing-engine.ts`, `pricing-resolver.ts` pour déléguer à ce module (aucune règle métier changée).
- PDFs (`devis-pdf.ts`, `facture-pdf.ts`, `edl-final-pdf.ts`) et templates email branchés sur `formatMoney`.

**Admin — Paramètres facturation**
- Nouveau tab "Facturation" dans `admin.parametres.tsx` : radio régime + tableau taux TVA + aperçu devis exemple.
- Suppression du bandeau "stockés localement" — les valeurs viennent désormais de la DB.
- Le changement n'affecte que les documents futurs (le snapshot fige les anciens).

## Phase 2 — Devis automatique à la demande client + validation convoyeur

**Backend**
- Server fn `createQuoteFromDemande(demandeId)` — appelée à la création d'une `demandes_convoyage` (dashboard-client, TunnelReservation, B2B).
- Statuts `attributions.statut_convoyeur` : `en_attente_reponse` → `accepte` | `refuse`. `attribuee` ne bascule `confirmee` qu'après acceptation convoyeur.
- Notification convoyeur (in-app + push + email `attribution-convoyeur.tsx` déjà présent).

**Front**
- Bandeau convoyeur "Nouvelle mission proposée" avec CTA Accepter / Refuser (refus → retour dispatch admin).
- Badge admin sur `admin.attributions.tsx` : "en attente réponse convoyeur".
- L'espace client affiche systématiquement un montant (fini les "0,00 €" en attente).

## Phase 3 — Mode attribution catalogue (enchère prix libre convoyeur)

**Backend**
- Colonne `attributions.mode` : `directe` (défaut) | `catalogue`.
- Extension `mission_offres` : `prix_propose`, `commentaire_convoyeur`, `admin_counter_offer`, `admin_counter_at`, `statut_offre`.
- Vue `v_missions_catalogue` filtrée pour convoyeur (publiées, non attribuées, matching disponibilités).
- RPC `submit_offer(missionId, prix, message)` et `counter_offer(offerId, prix, message)`.

**Front convoyeur**
- Nouvelle route `convoyeur.catalogue.tsx` : liste missions publiées, filtres zone/date/type.
- Modal "Proposer mon prix" (montant + message).

**Front admin**
- Radio "Publier au catalogue" au moment d'attribuer.
- Tab "Candidatures" par mission : liste offres, actions accepter / refuser / contre-proposer.
- Historique des allers-retours de négociation dans la fiche mission.

**Emails**
- Nouveaux templates `nouvelle-offre-convoyeur.tsx` (admin) et `contre-proposition-admin.tsx` (convoyeur).

## Phase 4 — Refonte UX admin (fiches, historique, exploitation, listes)

**Layout uniforme des fiches "Voir"** (clients, convoyeurs, organisations, missions, devis)
- Header identité + KPI (CA, missions actives, dernière activité, statut).
- Tabs : Vue d'ensemble / Missions / Devis / Factures / Documents / Historique / Notes.
- Actions rapides contextuelles en header (Créer devis, Envoyer email, Ajouter note, Suspendre).
- Pré-chargement parallèle via `ensureQueryData` — aucun aller-retour.

**Historique humain**
- Vue SQL `v_activity_logs_readable` : jointure `activity_logs` + `profiles` + labels d'action/entité.
- Composant `ActivityFeed` : "Jean Dupont a accepté la mission M-2025-004 le 14/07/2026 à 10:35".
- Utilisé par `admin.historique.tsx`, tab Historique des fiches, `admin.notifications.tsx`.

**Exploitation temps réel** (`admin.exploitation.tsx`)
- Colonnes enrichies (plaque, véhicule, client, convoyeur, départ, arrivée, statut, priorité, progression, prochaine étape).
- Realtime Supabase sur `attributions`, `missions`, `mission_locations` — `useEffect` avec cleanup.
- Bouton Rafraîchir → `router.invalidate()` + `queryClient.invalidateQueries` scopés.

**Attributions / Trajets / Utilisateurs / Organisations**
- Tableaux denses filtrables, tri colonnes, QuickView side sheet au clic, actions bulk.
- Bandeaux d'info transformés en toasts dismissibles.
- Prix affichés sur une seule ligne (correction wrapping).

**Paiements**
- Courbe masquée si < 3 points de données.
- Ordre des tabs par volume réel (Factures 9 en tête si non vide).
- Badges monétaires cumulés dans les tabs.

## Phase 5 — Performance transverse

- Toutes les routes `_authenticated/admin.*` et `dashboard-client.*` : `ensureQueryData` en parallèle, préchargement au hover (`preload="intent"`).
- Skeletons courts partout (< 400 ms → pas de loader visible).
- Lazy loading des tabs lourds (Documents, Historique).
- Migration des `useEffect + fetch` legacy → TanStack Query.

## Fichiers principaux (indicatif)

**Nouveaux**
- `src/lib/pricing/{index.ts, format.ts, context.tsx, types.ts}`
- `src/lib/quote-from-demande.functions.ts`
- `src/lib/offer.functions.ts`
- `src/components/admin/{ActivityFeed.tsx, EntityHeader.tsx, EntityTabs.tsx, QuickViewSheet.tsx}`
- `src/routes/_authenticated/convoyeur.catalogue.tsx`
- `src/lib/email-templates/{nouvelle-offre-convoyeur.tsx, contre-proposition-admin.tsx}`

**Migrations**
- `pricing_settings` + `vat_rates` + colonnes snapshot devis/factures + trigger
- `attributions.mode`, `attributions.statut_convoyeur` + colonnes `mission_offres`
- Vue `v_activity_logs_readable`
- `ALTER PUBLICATION supabase_realtime ADD TABLE attributions, mission_offres, mission_locations`

**Modifiés** (UI/perf uniquement, aucune API métier changée)
- Tous les `src/routes/_authenticated/admin.*`, `dashboard-client.*`, `convoyeur.*`
- `client-pricing.ts`, `b2b-pricing.ts`, `pricing-engine.ts`, `pricing-resolver.ts`, `devis-pdf.ts`, `facture-pdf.ts`

## Séquencement

1. **Phase 1** (tarification + régime) — bloquant pour la cohérence prix.
2. **Phase 2** (devis auto + validation convoyeur) — parcours métier.
3. **Phase 3** (catalogue enchère) — nouvelle fonctionnalité.
4. **Phase 4** (refonte fiches + historique + listes) — traite toutes les captures.
5. **Phase 5** (perf) en continu.

## Garanties zéro régression

- Chaque migration additive, jamais destructive.
- `regime_snapshot` fige les documents existants — le passage micro → société ne réécrit rien.
- Mode d'attribution `directe` reste défaut ; catalogue = opt-in.
- Statuts existants conservés ; nouveaux statuts additifs uniquement.
- Tests manuels à chaque phase : devis existant / mission en cours / convoyeur actif ne doivent voir aucun changement.

Je lance la Phase 1 dès validation.
