
# Plan de stabilisation Transports Ligneo

Demande très large (12 chantiers). Pour éviter de tout casser, je propose **4 phases livrables indépendamment**, dans cet ordre. Vous validez globalement, j'exécute phase par phase et vous testez entre chaque.

---

## Phase 1 — Lisibilité UI (rapide, gros impact visuel)

Objectif : plus aucun texte invisible, partout.

- Audit + correction globale via les **tokens du design system** (`src/styles.css`) :
  - Forcer `bg-popover` + `text-popover-foreground` sur tous les composants Radix : `Select`, `DropdownMenu`, `Command`, `Popover`, `ContextMenu`, `Menubar`, `HoverCard`.
  - Vérifier `Dialog`, `Sheet`, `AlertDialog`, `Drawer` → `bg-background text-foreground`, bordures `border-border`.
  - Boutons `variant="ghost"` / `outline` sur fonds sombres : ajouter contraste hover/active.
- **Dashboard Driver** : passer en revue `convoyeur/*`, `MissionCockpit`, `MissionWorkflow`, `MissionCard`, boutons photo/signature/docs → forcer couleurs explicites lisibles sur mobile (fonds sombres → texte clair, et inverse).
- **Vues "œil" / drawers admin** : `AdminDetailDrawer` + drawers missions/devis/factures → contraste texte/labels, bordures visibles.

Pas de refonte : uniquement corrections de classes Tailwind / tokens.

---

## Phase 2 — Tarifs personnalisés & adresses (déjà partiellement en place)

Objectif : rendre le système existant **visible et accessible** depuis les bons endroits.

- **Fiche client admin** (`/admin/clients/$clientId`) : vérifier que `ClientPricingRulesBlock` et `ClientDefaultAddressesBlock` sont bien rendus en haut, avec un titre clair "Tarifs personnalisés" + bouton "Ajouter un tarif" déjà existant mais à mettre en évidence (CTA primary visible).
- **Liste clients** (`/admin/clients`) : ajouter une action rapide "💶 Tarifs" sur chaque ligne → ouvre la fiche client ancrée sur la section tarifs.
- **Fiche organisation** (`/admin/organisations/$orgId`) : les onglets Tarification / Adresses existent déjà → vérifier qu'ils sont visibles et fonctionnels pour CAT FRANCE.
- **Adresses par défaut côté client Partner** : la page `/dashboard-pro/adresses` existe déjà ; vérifier qu'elle est bien liée dans la sidebar Pro et que le préremplissage fonctionne dans `QuickMissionForm` / `dashboard-pro.nouvelle-demande`.

Aucune nouvelle table — tout existe (`client_pricing_rules`, `client_default_addresses`).

---

## Phase 3 — Cohérence des prix & liaisons données

Objectif : plus de "79 € ici, 70 € là".

- **Source unique de vérité** : le prix calculé à la création de la demande est figé dans `demandes_convoyage.prix_estime` → repris tel quel par `trajets.prix_client` (trigger `auto_create_trajet_from_devis` existe déjà) → repris par `factures.prix_ttc`.
- Auditer tous les écrans qui **recalculent** au lieu de lire le prix stocké, et les corriger pour lire la valeur figée.
- Vérifier que `resolveClientPrice` (déjà implémenté) est bien appelé **uniquement à la création** de la demande, pas en lecture.
- **Numéros de mission** : la fonction `next_document_number('MIS-TLG', …)` + trigger `missions_set_numero` / `attributions_set_numero` existent déjà → vérifier que toutes les vues utilisent `missionNumberOf()` (helper déjà présent) et pas un calcul ad-hoc.
- **Liaisons** : vérifier `demande_id` sur `trajets`, `mission_id` sur `factures`, `attribution_id` → afficher partout dans les vues détail.

---

## Phase 4 — Édition complète admin (clients + convoyeurs)

Objectif : l'admin peut tout modifier.

- **Fiche client admin** : formulaire d'édition complet (nom, société, email, téléphone, adresse, SIRET, TVA, mode HT/TTC, notes internes) → écrit dans `profiles`.
- **Fiche convoyeur admin** (`/admin/convoyeurs/$convoyeurId`) : édition nom/prénom/email/téléphone/adresse/statut/notes → écrit dans `convoyeurs`. Validation documents déjà gérée.
- Vérifier que la modification email/téléphone se propage (pas de duplication) — utiliser `user_id` comme clé partout, jamais l'email en dur.

---

## Ce que je ne ferai PAS sans confirmation

- Pas de refonte de l'estimateur (il reste unique, seuls les prix changent par client → déjà le cas via `resolveClientPrice`).
- Pas de migration destructive sur les données existantes.
- Pas de changement des numéros déjà attribués.

---

## Question avant de lancer

Vous voulez que je commence par **Phase 1 (lisibilité, ~30 min, impact immédiat visible partout)**, ou que je traite d'abord **Phase 2 (tarifs CAT France visibles)** parce que c'est bloquant métier ?

Dites-moi simplement "phase 1" / "phase 2" / "tout dans l'ordre" et j'exécute.
