
# Refonte esthétique Transports Ligneo — plus claire, plus moderne

Objectif : alléger le site avec du blanc et de la respiration, en conservant 100% de l'identité (bleu nuit, doré, logo, hero, image), des fonctionnalités, des routes et de la logique métier. Aucune modification backend, pricing, auth, formulaires, ou de la bande "Ils nous font confiance".

## Principes directeurs

- **70% identité actuelle** (bleu nuit `#0b1026`, doré `#d4af37/#e7c76a`, Playfair) + **30% clair** (blanc, blanc cassé, gris très clair, cartes blanches).
- Alternance de sections : hero sombre → carte claire (simulateur) → bande grise partenaires (inchangée) → sections alternées blanc / blanc cassé / bleu nuit.
- Doré utilisé **uniquement en accent** (filets, soulignements, icônes, bordures fines), jamais en aplat.
- CSS/Tailwind uniquement pour animations (pas de framer-motion — règle projet).

## Zones intouchables (verrouillées)

- Logo `logo-transports-ligneo-officiel.png`.
- Image hero `hero-chauffeur-ligneo.jpg` (desktop + mobile).
- Composant `PartnersMarquee` (bande grise "Ils nous font confiance") : fond, logos, animation, ordre — aucun changement.
- `DevisGenerator`, `MobileDevisGenerator`, `PlacesInput` : logique, props, états, calculs — intacts.
- Routes, auth, RLS, server functions, edge functions, schéma DB, pricing.
- Dashboard client / pro / admin / convoyeur : logique, hooks, données.

## Système de design (tokens)

Édition unique de `src/styles.css` pour introduire des tokens "clair" sans casser l'existant :

- Ajouter tokens : `--surface-white`, `--surface-cream` (blanc cassé), `--surface-mist` (gris très clair bleuté), `--ink-navy` (texte sur clair), `--ink-muted`, `--hairline-gold` (filet doré 1px), `--shadow-soft`, `--shadow-card`.
- Conserver tous les tokens existants (`--navy`, `--cream`, `--primary` doré…).
- Ajouter classes utilitaires : `.section-light`, `.section-cream`, `.section-navy`, `.card-light`, `.btn-primary-navy`, `.btn-accent-gold`, `.btn-ghost-light`, `.hairline-gold`.

## Composants partagés à restyler (sans changer l'API)

1. **Navbar desktop** (`src/components/Navbar.tsx`)
   - Garder bleu nuit, menu, logo, boutons "Estimer" et "Connexion".
   - Filet doré 1px en bas, micro-ombre, espacement légèrement augmenté.
   - Téléphone `07 82 45 61 81` visible en haut à droite (lien `tel:`), accent doré discret.

2. **Sections homepage** (`src/routes/index.tsx`)
   - Hero : inchangé (image + texte cream/doré).
   - Bandeau juste sous hero : **fond clair** (`--surface-cream`) au lieu du fond sombre actuel pour la zone estimateur.
   - `DevisGenerator` enveloppé dans une **carte blanche** premium (coins arrondis, ombre douce, filet doré supérieur). Le composant interne n'est pas touché — uniquement le wrapper et tokens CSS internes via classes existantes.
   - Trust-chips sous l'estimateur : pastilles claires sur fond clair.
   - `PartnersMarquee` : intact.
   - `PourquoiNousChoisir`, `CommentCaMarche` : alternance blanc / blanc cassé, cartes blanches avec ombre douce, titres plus grands, icônes dans pastille bleu nuit ou cerclée doré.
   - `Footer` : conservé bleu nuit (ancrage premium).

3. **Pages internes** (services, tarifs, comment-ca-marche, b2b, a-propos, contact, login, inscription-*, cgv, mentions, confidentialite, blog)
   - Hero de page : bandeau bleu nuit court avec filet doré.
   - Corps : fond clair, cartes blanches, formulaires sur fond blanc avec bordures fines `--ink-muted/20`, focus doré.
   - CTAs uniformisés : `btn-primary-navy` (principal), `btn-accent-gold` (accent), `btn-ghost-light` (secondaire).

4. **Dashboards** (client, pro, convoyeur, admin)
   - Layout, sidebars, routes, données : inchangés.
   - Restyling visuel uniquement : fond `--surface-mist`, cartes blanches, headers de section avec filet doré, badges plus doux, tableaux plus aérés.
   - Sidebar conserve l'ancrage bleu nuit pour cohérence.

5. **Mobile** (`MobileHomeScreen`, `MobileBottomNav`, `MobileTopBar`)
   - Garder l'écran d'app (hero image, CTA, bottom nav).
   - Cartes mobiles passent en blanc avec ombre douce (au lieu de `bg-white/[0.03]`).
   - Sections alternent fond clair / bleu nuit.
   - **Aucune modification du picker Google Places** (correctif récent conservé : pas de `backdrop-filter` sur wrapper, portail intact).

## Détails visuels

- **Coins** : `rounded-2xl` pour cartes, `rounded-xl` pour boutons, `rounded-full` pour pastilles.
- **Ombres** : `0 1px 2px rgba(11,16,38,0.04), 0 8px 24px -12px rgba(11,16,38,0.08)`.
- **Filet doré** : bordure 1px `--primary` à 40% opacité, ou ligne `::before` de 2px en haut de carte.
- **Espacements** : sections `py-20 lg:py-28`, conteneurs `max-w-6xl`, gaps `gap-8`.
- **Typo** : Playfair conservé pour titres, body actuel conservé, tailles agrandies sur clair pour contraste.
- **Boutons** :
  - Principal : fond `--navy`, texte cream, hover filet doré.
  - Accent : fond gradient doré discret, texte navy.
  - Secondaire : fond blanc, bordure `--ink-muted/30`, texte navy.

## Fichiers touchés (édition surfacique uniquement)

- `src/styles.css` — ajout de tokens clairs + utilitaires (additif).
- `src/components/Navbar.tsx` — filet doré, téléphone, espacements.
- `src/routes/index.tsx` — section estimateur passe en clair, wrapper carte blanche.
- `src/components/PourquoiNousChoisir.tsx`, `CommentCaMarche.tsx`, `CommentCaMarcheTimeline.tsx`, `Engagements.tsx`, `Tarifs.tsx`, `FAQ.tsx`, `AvisClientsDynamiques.tsx`, `Confiance.tsx`, `Contact.tsx`, `ServicesContent.tsx`, `AProposContent.tsx`, `Prestations.tsx` — fonds, cartes, classes.
- `src/routes/services.tsx`, `tarifs.tsx`, `comment-ca-marche.tsx`, `b2b.tsx`, `a-propos.tsx`, `contact.tsx`, `login.tsx`, `inscription-*.tsx`, `cgv.tsx`, `mentions-legales.tsx`, `confidentialite.tsx`, `blog.tsx`, `blog.$slug.tsx`, `pro.tsx` — wrappers de page (fond clair, hero bandeau).
- `src/components/dashboard/*`, `dashboard-pro/*`, `convoyeur/*`, `admin/*` — restyling visuel des layouts (fond, cartes, sidebars). **Aucune modification de hooks/données/handlers**.
- `src/components/mobile/MobileHomeScreen.tsx`, `MobileBottomNav.tsx`, `MobileTopBar.tsx`, `MobilePartnersStrip.tsx` — fonds clairs alternés, cartes blanches.

**Non touchés** : `DevisGenerator.tsx`, `MobileDevisGenerator.tsx`, `PlacesInput.tsx`, `PartnersMarquee.tsx`, tout `src/lib/`, `src/hooks/`, `src/integrations/`, `src/server/`, `src/routes/api/`, `supabase/`, calculs, validations.

## Garde-fous

- Aucun composant renommé, aucune prop supprimée.
- Aucun composant dynamique transformé en statique.
- Aucun avis/logo inventé.
- Responsive mobile préservé (tests visuels 390×844 + 1280).
- Vérification post-build : préview homepage, tarifs, dashboard-client, login, mobile home.

## Détails techniques

```text
Palette claire (additive à src/styles.css)
  --surface-white : oklch(1 0 0)
  --surface-cream : oklch(0.985 0.005 90)
  --surface-mist  : oklch(0.97 0.01 240)
  --ink-navy      : var(--navy)
  --ink-muted     : oklch(0.45 0.02 245)
  --hairline-gold : color-mix(in oklab, var(--primary) 50%, transparent)
  --shadow-card   : 0 1px 2px rgba(11,16,38,.05), 0 12px 32px -16px rgba(11,16,38,.12)

Classes utilitaires
  .section-light  { background: var(--surface-white); color: var(--ink-navy); }
  .section-cream  { background: var(--surface-cream); color: var(--ink-navy); }
  .section-navy   { background: var(--navy); color: var(--cream); }
  .card-light     { background:#fff; border:1px solid color-mix(in oklab, var(--ink-navy) 8%, transparent);
                    border-radius:1rem; box-shadow:var(--shadow-card); }
  .hairline-gold::before { content:''; position:absolute; inset:0 0 auto 0; height:2px;
                           background:linear-gradient(90deg,transparent,var(--primary),transparent); }
```

Stratégie de rollout : tokens + utilitaires d'abord, puis Navbar + homepage (hors estimateur), puis pages internes, puis dashboards, puis mobile. Vérification visuelle à chaque étape.
