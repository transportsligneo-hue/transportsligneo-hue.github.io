## Objectif

Reproduire fidèlement la maquette sur la home desktop :
- Hero en 2 colonnes : ton image actuelle + titre/CTAs à gauche, **carte sombre arrondie du simulateur à droite**.
- Courbe blanc cassé sous le hero qui « accueille » le simulateur (l'arrondi visible en bas de ta maquette).
- Sections sous l'estimateur entièrement remodernisées en alternance navy ↔ clair.
- **Aucun champ, calcul, API, route, validation, étape du wizard n'est modifié.** Logo et image hero conservés.

## 1. Simulateur — version « hero card » (sans casser le wizard)

Le composant `DevisGenerator` reste l'unique source de vérité (mêmes états, mêmes calculs, mêmes étapes 1→4 en modal).

J'ajoute une **prop visuelle** `variant?: "bar" | "hero-card"` (défaut `"bar"`, comportement actuel inchangé pour `/tarifs` et toutes les autres pages qui l'utilisent).

Quand `variant="hero-card"`, **seul le rendu de l'étape 0** est réorganisé en layout vertical compact, fidèle à la maquette :

```text
┌─────────────────────────────┐
│ Obtenez votre tarif         │
│ en quelques secondes        │   (titre serif + accent doré)
│ Renseignez votre trajet…    │
├─────────────────────────────┤
│ [Départ]      [Arrivée]     │   (2 colonnes)
│ [Véhicule              ▾]   │   (pleine largeur)
│ [Date]        [Heure]       │   (2 colonnes)
│ ┌─────────────────────────┐ │
│ │   OBTENIR MON PRIX  ➤   │ │   (CTA doré pleine largeur)
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

- Carte = `glass-onyx` arrondie 24px, bordure dorée fine, ombre profonde.
- Champs = mêmes inputs/onChange/state qu'aujourd'hui, juste réagencés dans un grid vertical.
- Switch « Type de prestation » (3 boutons) : déplacé en chips discrètes au-dessus, ou masqué dans la variante hero-card avec valeur par défaut « livraison » (à confirmer si tu veux le garder visible).
- Bouton « Obtenir mon prix » : déclenche exactement le même `setStep(1)` qu'aujourd'hui → ouvre le wizard modal complet inchangé.
- Bloc résultat (prix HT/TTC/distance) : reste affiché sous la carte une fois calculé, même contenu.

`/tarifs` continue d'utiliser la variante `"bar"` actuelle → zéro régression.

## 2. Hero desktop — layout 2 colonnes

`HeroDesktop` repensé :

```text
┌──────────────────────────────────────────────────────────────┐
│  [Image hero actuelle pleine largeur en fond + overlay navy] │
│                                                              │
│  ┌─ CONVOYAGE AUTOMOBILE PREMIUM ─┐    ┌──────────────────┐  │
│  │                                │    │                  │  │
│  │  LA TRANQUILLITÉ               │    │  Simulateur      │  │
│  │  SUR TOUTE LA LIGNE.           │    │  (hero-card)     │  │
│  │                                │    │                  │  │
│  │  Transports Ligneo…            │    │  Départ  Arrivée │  │
│  │                                │    │  Véhicule        │  │
│  │  [Estimer mon trajet] [Tarifs] │    │  Date    Heure   │  │
│  │                                │    │  [OBTENIR PRIX]  │  │
│  │  ⚡ Réponse  🛡 Assurance       │    │                  │  │
│  │  💼 Péages   ⏱ 7j/7            │    └──────────────────┘  │
│  └────────────────────────────────┘                          │
└──────────────────────────────────────────────────────────────┘
       ╲___ bas du hero : arrondi blanc cassé ___╱
```

- Image hero **conservée à l'identique** (`hero-ligneo-night.jpg`), juste recadrée pour laisser respirer la colonne droite.
- Grid `lg:grid-cols-[1.05fr_1fr]` avec gap généreux, padding latéral large.
- Trust pills dorées intégrées sous les CTAs (Réponse immédiate / Assurance / Péages / 7j/7).
- Numéro téléphone du header **conservé** (07 82 45 61 81 — pas celui de la maquette).

### Courbe blanc cassé en bas de hero
Pseudo-élément qui « avale » le bas du hero pour reproduire l'arrondi de la maquette :
```css
section::after { content:''; position:absolute; bottom:-40px; inset-x:0; height:80px;
  background: var(--surface-cream); border-radius: 40px 40px 0 0; }
```
Le simulateur dépasse visuellement sur cette courbe (impression d'intégration premium).

## 3. Sections sous l'estimateur — refonte alternée

### Bande stats blanche (juste sous le hero, façon maquette)
Carte unique blanche arrondie 24px, ombre douce, 3 colonnes séparées par des filets très fins :
- 6+ ANS D'EXPÉRIENCE / 0 ANNULATION DE NOTRE PART / 7J/7 DISPONIBLE
- Icônes dorées dans cercles dorés discrets, typo Playfair pour les titres en uppercase.
- Fond de section : cream `#faf7ef` (pas blanc pur, respect du système 60/25/15).

### « Ils nous font confiance » — INTOUCHÉ
PartnersMarquee reste exactement comme aujourd'hui (fond gris, défilement, logos, animation).

### « Pourquoi nous choisir » — refonte CLAIRE moderne
- Fond cream avec halo doré subtil.
- Eyebrow doré + titre Playfair grande taille + filet doré court.
- Grille 3 colonnes de cartes `card-premium-light` mais redesign : grosse icône dorée en cercle ourlé doré, titre Playfair, description, mini-CTA texte « En savoir plus » apparaissant au hover.
- Hover : lift discret + bordure dorée + ombre dorée subtile.

### « Comment ça marche » — refonte NAVY premium
- Bascule sur fond navy `#0b1026` (rythme : clair → navy).
- Eyebrow doré + titre Playfair blanc cassé.
- 3 étapes en cartes verre fumé (`glass-onyx` allégée) avec gros numéro 01/02/03 en doré géant en arrière-plan, icône, titre, description.
- Filet doré horizontal reliant les 3 cartes (timeline visuelle).

### Footer — INTOUCHÉ
Reste navy comme aujourd'hui.

## 4. Détails techniques

**Fichiers modifiés :**
- `src/components/DevisGenerator.tsx` — ajout prop `variant`, branchement conditionnel sur l'étape 0 uniquement. Aucun changement aux états, calculs, wizard modal, RPC, validations, pricing.
- `src/components/HeroDesktop.tsx` — passage en 2 colonnes, slot droit pour `<DevisGenerator variant="hero-card" />`, courbe blanc cassé en bas.
- `src/routes/index.tsx` — suppression de la section estimateur séparée (l'estimateur vit dans le hero maintenant), réorganisation : Hero → Bande stats blanche → Partners (intact) → Pourquoi nous choisir (clair) → Comment ça marche (navy) → Footer.
- `src/components/PourquoiNousChoisir.tsx` — refonte visuelle (mêmes 6 raisons, mêmes textes).
- `src/components/CommentCaMarche.tsx` — refonte visuelle (mêmes 3 étapes, mêmes textes).
- `src/styles.css` — ajout 1-2 utilitaires si besoin (`.hero-curve-cream`, `.step-card-navy`).

**Non touché :**
- `src/integrations/`, `src/lib/pricing-*`, `src/lib/*pdf*`, `src/server/`, `src/routes/api/`, `supabase/`, tous les hooks, l'auth, le dashboard, l'espace pro/convoyeur/admin, mobile (`MobileHomeScreen`/`MobileDevisGenerator`).
- `PartnersMarquee`, `Footer`, `Navbar` (déjà fait).
- Tous les calculs, validations, Stripe, emails, reCAPTCHA, Google Places, wizard modal étapes 1→4.

**Responsive :**
- `< lg` : la grille du hero passe en 1 colonne, le simulateur descend sous le bloc texte (pas de régression mobile, le composant `MobileHomeScreen` reste utilisé pour `< md`).
- `lg → xl` : ajustement des gaps pour éviter que la carte du simulateur ne touche le bord droit.

## 5. Hors scope (à confirmer ensuite)

Une fois cette home validée visuellement, on enchaîne avec la même grammaire 60/25/15 + cartes verre fumé sur :
- pages internes (`/services`, `/tarifs`, `/contact`, `/a-propos`, `/comment-ca-marche`, `/b2b`)
- pages d'auth (`/login`, `/inscription-*`)
- dashboards (client / pro / convoyeur / admin) — restylage visuel uniquement, zéro changement fonctionnel.

Pas inclus dans ce plan pour rester focus sur ta demande immédiate (hero + sections home).
