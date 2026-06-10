Plan en 4 lots livrés dans cet ordre. Chaque lot est testable indépendamment.

## Lot 1 — Workflow d'acceptation de devis (le plus gros)

**Base de données**
- Nouveau paramètre global dans `app_settings` : `devis_acceptation_obligatoire` (bool, défaut `true`).
- Nouveau champ `exempte_acceptation_devis` (bool, défaut `false`) sur `profiles`.
- Nouvelle table `devis_acceptations` :
  - devis_id, devis_version, client_user_id, client_email
  - accepted_at (UTC), ip_address, user_agent
  - montant_accepte, cgv_version, statut (`accepte`)
  - pdf_url (lien vers le PDF figé du devis accepté)
- Nouveau champ `version` (int, défaut 1) + `locked_at` sur `devis`. À chaque modification d'un devis déjà accepté → +1 version, `locked_at` reset, nouvelle acceptation requise.
- RLS : client lit ses propres acceptations, admin lit tout, insert via server fn uniquement.

**UI Client (étape d'acceptation)**
- Nouveau composant `DevisAcceptationStep` inséré AVANT le paiement / la création de la demande.
- Affiche : récap trajet, véhicule, total TTC détaillé, lien CGV (modale).
- Case à cocher obligatoire avec le texte exact demandé.
- Bouton "Accepter et continuer" désactivé tant que case non cochée.
- Logique : si `devis_acceptation_obligatoire = false` OU `profile.exempte_acceptation_devis = true` → étape sautée.

**Serveur**
- `acceptDevis` serverFn : capture IP (`getRequestHeader('x-forwarded-for')`) + UA, génère PDF figé via `generateDevisPdf`, upload dans bucket `devis-pdfs` (nouveau, privé), insert dans `devis_acceptations`, envoie email avec PDF.
- Email transactionnel : nouveau template `devis-accepte.tsx` (récap + date acceptation + lien PDF).
- Verrouillage : trigger `protect_accepted_devis` → toute UPDATE sur un devis avec `locked_at != null` crée une nouvelle version au lieu de modifier.

**Admin**
- Toggle `devis_acceptation_obligatoire` dans `admin.parametres.tsx`.
- Toggle `exempte_acceptation_devis` dans fiche client.
- Sur fiche devis admin : statut acceptation, date, IP, lien PDF.
- Export CSV/PDF des preuves d'acceptation depuis `admin.devis.tsx`.

## Lot 2 — Bug lien confirmation email + notifs

**Lien confirmation email**
- Créer route `/auth/email-confirme.tsx` (page publique) qui affiche : logo, "Email validé ✓", "Votre compte est activé", bouton "Aller à mon espace".
- Modifier le template auth `email-change.tsx` + `signup.tsx` pour pointer vers cette page après confirmation (URL `{{ .RedirectTo }}` → `/auth/email-confirme`).
- Configurer Supabase Auth → `site_url` redirect inclut cette route.

**Notifs push + email admin/client**
- Audit des points d'envoi (création devis, acceptation, paiement, attribution, mission terminée) → garantir double envoi (push via `push_subscriptions` + email via `sendTransactionalEmail`).
- Admin : s'abonner aux push pour tous les events `admin_notifications` non lus.
- Ajouter logs `email_send_log` côté admin pour visibilité.

## Lot 3 — Lisibilité + splash logo animé PWA

**Lisibilité**
- Augmenter contraste texte sur cartes :
  - `.card-premium-light` (cream) : texte navy `#0b1026` au lieu de gris doux.
  - Tableaux admin (clients, devis, factures) : `text-cream` au lieu de `text-cream/60`, headers en `text-cream`.
  - Panneau tarifs (`Tarifs.tsx`) : passer libellés de `text-cream/70` à `text-cream` + augmenter weight `font-medium`.
- Conserver design premium 60/25/15 (mémoire projet).

**Splash logo animé**
- Composant `LogoLoader` : logo Ligneo avec animation CSS (pulse doré + rotation lente).
- Remplacer tous les `<Loader2 className="animate-spin" />` plein écran par `<LogoLoader />`.
- Splash PWA : dans `public/manifest.webmanifest` + `__root.tsx` afficher `LogoLoader` pendant l'hydratation initiale.

## Lot 4 — Tarifs étendus ville/département

**Base de données**
- Étendre `client_pricing_rules` :
  - `departement_depart` (text, ex "37")
  - `departement_arrivee` (text, ex "75")
  - `match_mode_depart` enum `ville | departement | both` (calculé)
  - idem arrivée
- Adapter `resolve_client_pricing_rule()` SQL function pour matcher aussi par département (via lookup ville → dept dans `pricing-departments.ts` existant).
- Scoring : ville+ville > ville+dept > dept+dept > général.

**UI Admin (`ClientPricingRulesBlock`)**
- Form : choix par règle entre "Ville", "Département" ou "Les deux" pour départ ET arrivée séparément.
- Champ département = select des 101 départements FR.
- Tableau récap montre clairement le scope de chaque règle.

---

## Détails techniques

- Stack : TanStack Start, server fns avec `requireSupabaseAuth`, RLS sur toutes nouvelles tables, GRANTs explicites.
- PDF : réutilise `src/lib/devis-pdf.ts` existant, ajoute version au filename.
- Storage : nouveau bucket `devis-acceptes` privé, RLS scopée client+admin.
- Migrations Supabase séparées par lot pour rollback facile.
- Pas de framer-motion (mémoire projet) — animations CSS pures.

## Question avant de démarrer

Je commence par le **Lot 1** (workflow d'acceptation, ~le plus gros). Confirmez-vous ou voulez-vous changer l'ordre ?