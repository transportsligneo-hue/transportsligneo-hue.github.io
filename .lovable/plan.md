
# Corrections Transports Ligneo — plan par phase

Périmètre cadré, modifications chirurgicales, aucune refonte. Aucune donnée existante supprimée. Pas de touche au cœur (DevisGenerator logique de prix, MissionCockpit, EdlPremiumFlow, Stripe, PDF, RLS existants).

---

## Phase 1 — Dashboard Client : nettoyage et lisibilité

### 1.1 Supprimer “CA réalisé” côté client
Aucun bloc nommé "CA réalisé" n'apparaît dans `dashboard-client.index.tsx` actuel (stats : En cours / À venir / Terminées / Demandes). Action :
- Recherche exhaustive (`rg "CA |Chiffre|réalisé|revenu"`) sur tous les fichiers `dashboard-client.*` + composants importés.
- Si trouvé : retrait visuel uniquement (pas de suppression en base). Si non trouvé : noter dans `.lovable/plan.md` comme déjà OK.

### 1.2 Lisibilité de l'estimateur (suite)
Le wrapper `card-premium` a déjà été retiré. Vérifier en preview que les blocs internes `bg-white/[0.03]` (récap prix, TTC, détails) sont lisibles sur le shell client. Si besoin : ajouter une règle CSS scoped `.client-shell [data-devis-summary] { background: rgba(11,16,38,0.85); }` pour forcer un fond navy sous le générateur sans toucher la version landing.

### 1.3 Demandes non converties + suivi missions
Déjà en place (`dashboard-client.index.tsx` + `dashboard-client.missions.tsx` lisent `devis` + `demandes_convoyage`). À vérifier seulement : badges de statut couvrent bien `nouvelle`, `en_traitement`, `en_cours`, etc.

---

## Phase 2 — Convoyeur : accès avant validation des documents

### 2.1 Lever le blocage du layout convoyeur
`src/routes/_authenticated/convoyeur.tsx` affiche aujourd'hui un écran "Compte en attente" qui bloque tout accès si `convoyeurStatut !== "valide" | "actif"`.

Action :
- Garder l'écran de blocage uniquement pour `refuse` et `suspendu`.
- Pour `en_attente` : laisser passer vers le layout normal et afficher un **bandeau persistant** en haut du dashboard convoyeur :
  > "Votre compte est en attente de validation. Vous pouvez déposer vos documents. Vous pourrez accepter des missions disponibles une fois vos documents validés."

Bandeau implémenté dans `ConvoyeurSidebar` ou directement dans `convoyeur.tsx` au-dessus de `<Outlet />`, conditionné sur `convoyeurStatut === "en_attente"`.

### 2.2 Bloquer l'acceptation autonome si non validé
Dans `convoyeur.disponibles.tsx` :
- Si `convoyeurStatut !== "valide" | "actif"` : désactiver les boutons "Accepter" et "Proposer", afficher une note dorée :
  > "Vous pourrez accepter des missions disponibles une fois vos documents validés."
- Côté serveur la RPC `accept_mission_fixe` filtre déjà sur convoyeurs validés (statut = 'valide'), donc la sécurité est conservée. La désactivation UI est cosmétique mais évite confusion.

### 2.3 Side-effect : page documents / profil convoyeur
Vérifier que `convoyeur.documents.tsx` et `convoyeur.profil.tsx` fonctionnent avec un convoyeur `en_attente` (RLS déjà OK : "Convoyeurs can manage own documents" filtre par `user_id`).

---

## Phase 3 — Admin : assignation à un convoyeur non validé

### 3.1 Élargir la liste des convoyeurs dans AssignDriverDialog
`src/components/admin/AssignDriverDialog.tsx` filtre actuellement `.eq("statut", "valide")`. Action :
- Charger tous les convoyeurs `not in ('refuse', 'suspendu')`.
- Ajouter dans chaque ligne un badge de statut : "Validé" (vert) / "En attente" (orange) / "Documents incomplets" (rouge).
- Avant assignation d'un convoyeur non `valide` : confirm dialog avec
  > "Attention : ce convoyeur n'a pas encore tous ses documents validés. Voulez-vous quand même lui assigner cette mission ?"

Aucun changement RLS. L'attribution se crée déjà via `UPDATE` sur `attributions` côté admin (policy "Admins can manage attributions").

---

## Phase 4 — Tarifs personnalisés par client

### 4.1 Migration SQL (nouvelle table)

```sql
CREATE TABLE public.client_pricing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  client_email text NOT NULL,
  ville_depart text,           -- nullable = wildcard
  ville_arrivee text,          -- nullable = wildcard
  zone_label text,             -- ex: "Tours intra"
  trip_type text NOT NULL CHECK (trip_type IN ('aller','aller_retour','any')),
  prix_ttc numeric NOT NULL CHECK (prix_ttc > 0),
  prix_ht numeric,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.client_pricing_rules ENABLE ROW LEVEL SECURITY;

-- Admins : full
CREATE POLICY "Admins manage client pricing"
  ON public.client_pricing_rules FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));

-- Clients : lecture de leurs propres règles (pour application transparente côté front)
CREATE POLICY "Clients read own pricing"
  ON public.client_pricing_rules FOR SELECT TO authenticated
  USING (
    client_user_id = auth.uid()
    OR lower(client_email) = lower(coalesce(auth.jwt()->>'email',''))
  );

CREATE INDEX ON public.client_pricing_rules (client_email);
CREATE INDEX ON public.client_pricing_rules (client_user_id);
```

### 4.2 UI Admin
Nouveau bloc "Tarifs personnalisés" dans `admin.clients.$clientId.tsx` :
- Liste des règles existantes (ville départ → arrivée, type, prix TTC, actif).
- Formulaire d'ajout : ville départ (autocomplete), ville arrivée, type (Aller / Aller-retour / Tous), prix TTC, notes.
- Actions : éditer / désactiver / supprimer.

### 4.3 Application automatique dans l'estimateur
Dans `DevisGenerator.tsx`, **avant** `calculatePrice`, si user authentifié :
- Lookup `client_pricing_rules` filtré par email/user_id + extractCity(départ)/(arrivée) + option_trajet.
- Match prioritaire : règle exacte ville→ville > règle wildcard.
- Si match : remplacer `finalPrice` par `rule.prix_ttc`, label = `Tarif personnalisé`. Sinon : logique actuelle inchangée.
- Le client voit simplement le prix appliqué (pas de mention "tarif admin").

Impact minimal : un seul ajout dans le `useMemo` qui calcule le prix, fallback identique au comportement actuel si aucune règle n'existe.

---

## Phase 5 — Factures côté client

### 5.1 Diagnostic
`dashboard-client.devis.tsx` lit déjà `factures` filtré par `client_email = user.email`. Cas non couverts :
- Si l'admin émet une facture avec un email différent (casse, alias) → invisible.
- Lien explicite vers la mission/devis associé absent.

### 5.2 Correctifs
- Étendre la requête : `.or("client_email.ilike." + email + ",client_email.eq." + altEmail)` en utilisant l'email du profil ET l'email auth.
- S'appuyer sur la policy RLS existante "Clients read own factures" (déjà tolérante à la casse via `lower()`).
- Ajouter colonne "Mission / Devis" dans le tableau factures avec lien.
- Ajouter une carte "Mes factures" sur `dashboard-client.index.tsx` (count + lien direct vers l'onglet factures).

### 5.3 Côté admin
Vérifier dans `admin.factures.tsx` / création de facture que `client_email` est bien renseigné en lowercase avec l'email du devis/mission source. Si bug détecté : forcer `lower(trim(email))` à l'insertion.

---

## Fichiers touchés (récapitulatif)

```
src/routes/_authenticated/convoyeur.tsx                       (lever blocage en_attente + bandeau)
src/routes/_authenticated/convoyeur.disponibles.tsx           (désactiver actions si non validé)
src/components/admin/AssignDriverDialog.tsx                   (élargir liste + warning)
src/components/admin/.../ClientPricingRulesBlock.tsx          (nouveau composant)
src/routes/_authenticated/admin.clients.$clientId.tsx         (intégrer le bloc)
src/components/DevisGenerator.tsx                             (lookup tarif perso, ~15 lignes)
src/routes/_authenticated/dashboard-client.devis.tsx          (requête factures élargie + lien mission)
src/routes/_authenticated/dashboard-client.index.tsx          (carte "Mes factures", retrait CA si présent)
src/styles.css                                                (override estimateur si besoin)
+ 1 migration SQL : client_pricing_rules
```

## Hors scope (conservé tel quel)
- Logique de calcul kilométrique / forfaits département (`pricing-engine.ts`, `pricing-departments.ts`).
- Flux EDL, Stripe, génération PDF, emails transactionnels.
- RLS et triggers existants.
- Comportement convoyeurs validés (aucune régression).

## Ordre d'exécution recommandé
1. Phase 1 (UI cleanup) — 0 risque
2. Phase 2 (convoyeur access) — risque faible
3. Phase 5 (factures) — risque faible
4. Phase 3 (assign non validé) — risque moyen, prévoir test manuel
5. Phase 4 (tarifs perso, migration SQL en premier) — risque le plus élevé, à valider seul

Chaque phase peut être livrée et testée indépendamment.
