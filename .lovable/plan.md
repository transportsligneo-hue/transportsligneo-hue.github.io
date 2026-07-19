## Refonte design globale — Transports Ligneo

Application du système visuel des 6 maquettes HTML au site en production, **sans toucher à la logique métier existante** (formulaire d'estimation, auth, dashboards, GPS, factures, routes, SEO, tracking).

### 1. Système de design global (`src/styles.css` + `__root.tsx`)
- Fond continu bleu marine lumineux : dégradé `#0a1638 → #081230 → #061238` + halos radiaux bleu électrique / or, appliqué au `<body>` marketing (pas dans les dashboards).
- Chargement polices via `<link>` dans `__root.tsx` : Poppins (800/900), Space Grotesk (500-700), Inter (400-700).
- Tokens CSS : `--navy`, `--blue #2f5fff`, `--blue-bright #4f8cff`, `--gold #d9b54a`, `--text-muted #9aa6c9`, `--border rgba(122,163,255,.16)`.
- Wordmark "TRANSPORTS **LIGNEO**" avec glow bleu pulsé sur "LIGNEO".
- Composants réutilisables : `.glass-card`, `.btn-pill-blue` (reflet lumineux balayant), `.btn-estimer` (bordure dégradée animée + éclair doré), `.btn-connexion` (dégradé bleu→or dérivant), `.nav-pill` (pilule englobante, onglet actif "respire").
- Animations indépendantes (nav / bouton Estimer / bouton Connexion non synchronisés).

### 2. Navbar desktop (`Navbar.tsx`)
- Refonte visuelle uniquement : liens dans pilule englobante translucide, item actif en dégradé bleu pulsé.
- Boutons Estimer / Connexion refaits selon maquette.
- Toutes les routes, actions `goToEstimer` / `goToEspace`, comportement mobile : inchangés.

### 3. Hero accueil (`HeroDesktop.tsx`)
- Garde photo `heroBg` existante + overlay bleu électrique multiply + fondu vers le bas (pas de coupure).
- Simulateur (`DevisGenerator variant="hero-card"`) **conservé tel quel** (demande explicite : « juste garde l'estimateur actuel sur l'accueil »), juste réhabillé en glass card avec bordure dégradée animée, chevauchant le bas du hero.
- Trust pills, titre, CTAs restylés au système.

### 4. Carte interactive France/Europe (nouveau composant `MapFranceEurope.tsx`)
- Nouvelle section sur l'accueil, insérée après le hero / stats.
- SVG copié tel quel depuis `accueil-desktop-refonte_2.html` (vrais tracés géographiques France + voisins, Tours en hub doré pulsant, 9 lignes bleues vers villes FR, 5 lignes pointillées dorées vers Europe, points lumineux `animateMotion`).
- Légende 3 couleurs dessous.

### 5. Page "Comment ça marche" (`CommentCaMarcheTimeline.tsx`)
- Restructure en **4 grandes phases** (Estimation & Devis / Validation interne / Convoyage / Clôture & Facturation) avec gros numéro + titre, sous-étapes réelles en grille 2 colonnes.
- Reprend le **contenu réel actuel des 12 étapes** regroupé par phase — pas le texte d'exemple des maquettes.

### 6. Pages restylées (contenu réel conservé, seul le style change)
- `services.tsx` → `ServicesContent.tsx` + `Engagements.tsx`
- `a-propos.tsx` → `AProposContent.tsx`
- `b2b.tsx`
- `contact.tsx` → `Contact.tsx` + `FAQ.tsx`
- Chaque page adopte : fond global, eyebrow Space Grotesk, titres Poppins avec mot-clé en bleu pulsé, cartes glass, boutons pilule.
- **Aucun texte, tarif, FAQ, mention légale n'est réécrit** — juste rehabillé.

### 7. Non touché
- `DevisGenerator` (logique + UI actuelle du simulateur)
- Auth, dashboards admin/pro/convoyeur/client, routes `_authenticated/*`, `api/*`
- SEO (`head()` de chaque route), JSON-LD, tracking
- Mobile (`MobileHomeScreen`, `MobileBottomNav`) — refonte mobile déjà validée précédemment
- PartnersMarquee (marqué "INTOUCHABLE" en mémoire)
- Fichiers `src/integrations/supabase/*` et migrations

### Détails techniques
- Aucune migration DB, aucun changement de props/ids/classes utilisés hors marketing.
- Test preview page par page avant validation.
- Ordre : (1) tokens/polices/composants CSS globaux → (2) Navbar → (3) Hero + carte France → (4) 4 autres pages marketing → (5) Comment ça marche restructuré.

### Ce qui reste en discussion
Volume important (6 pages + carte SVG + composants globaux). Je propose de livrer en **2 lots** :
- **Lot A** : système de design + Navbar + Hero accueil + carte France/Europe (impact visuel principal).
- **Lot B** : Services, À propos, B2B, Contact, Comment ça marche restructuré.

Confirme-tu ce découpage, ou tu veux tout en un seul passage ?