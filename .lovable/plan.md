## Problème

Sur ta capture (`/dashboard-pro/missions/...`), les blocs de la fiche mission sont quasi invisibles : seul le texte sélectionné (surligné bleu) se voit. Cause technique :

- `ClientMissionDetailView` utilise partout `text-cream`, `text-cream/50`, `border-primary/10` (pensés pour le shell sombre `client-shell` navy + glass).
- Mais l'espace **Pro** (`dashboard-pro.tsx`) et **Flotte** rendent sur fond clair `bg-pro-bg` (#F6F8FB). Résultat : du texte crème sur fond blanc → illisible.
- Le badge "EN ATTENTE" reste visible parce qu'il a déjà une couleur saturée (la nouvelle palette opérationnelle).

## Objectif

Rendre la fiche mission lisible dans **tous** les espaces clients, en restant cohérent avec la charte déjà validée :
- Espaces sombres (`dashboard-client`, `client-shell`) : on garde le rendu navy/glass actuel.
- Espaces clairs (`dashboard-pro`, `flotte`) : carte claire haut de gamme + texte navy lisible + accents **bleu électrique #00AEEF** (déjà nos tokens `--op-electric` / `--op-violet` / `--op-green` / `--op-red` / `--op-orange`).
- Aucun changement aux modules admin, site public, header/footer, ni à la palette navy/doré globale.

## Périmètre des fichiers

- `src/components/mission/ClientMissionDetailView.tsx` — passer en classes adaptatives.
- `src/components/mission/MissionTrackingPanel.tsx` — même traitement (lecture seule, doit être lisible sur fond clair comme sombre).
- `src/styles.css` — ajouter une seule classe utilitaire `.mission-surface` qui s'adapte au shell parent (sombre → glass cream-on-navy, clair → carte blanche bordure fine ombre douce + texte navy). Pas de nouveau token couleur, on réutilise `--op-electric` déjà ajouté.

Aucun changement de logique métier, de requêtes Supabase, de routes, ni de permissions.

## Approche visuelle

Hiérarchie commune (les deux modes) :

```text
┌─ Card surface ──────────────────────────────────────┐
│ N° mission (eyebrow, muted small caps)              │
│ Ville → Ville  (titre, icône bleu électrique)       │
│ ─────────────────────────────────────────────────── │
│ Date         |       Prix (accent doré OU navy)    │
└─────────────────────────────────────────────────────┘
```

- Titres de section : `text-[#00AEEF]` (au lieu de `text-primary` doré) → cohérent avec le module Suivi/Véhicules déjà refait.
- Plaque immatriculation : on garde le bloc bleu électrique existant.
- Statut : `StatusBadge` (déjà saturé, OK partout).
- Lien retour, eyebrows, valeurs : tokens adaptatifs via `.mission-surface` (sombre = cream/cream-muted, clair = `#0b1026` / `#475569`).

## Détails techniques

1. Ajouter dans `src/styles.css` :

```css
.mission-surface { /* défaut = mode clair Pro/Flotte */
  --ms-bg: #ffffff;
  --ms-border: rgba(15, 23, 42, 0.08);
  --ms-text: #0b1026;
  --ms-text-soft: #475569;
  --ms-text-muted: #94a3b8;
  --ms-divider: rgba(15, 23, 42, 0.08);
  --ms-accent: #00AEEF;
  background: var(--ms-bg);
  border: 1px solid var(--ms-border);
  border-radius: 14px;
  box-shadow: 0 1px 2px rgba(15,23,42,0.04), 0 8px 24px -16px rgba(15,23,42,0.10);
  color: var(--ms-text);
}
.client-shell .mission-surface { /* mode sombre Particulier */
  --ms-bg: transparent;
  --ms-border: var(--client-border);
  --ms-text: #f3f6ff;
  --ms-text-soft: #c9d3ee;
  --ms-text-muted: #8c97bd;
  --ms-divider: rgba(120,165,255,0.18);
  background: linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.03));
  box-shadow: 0 20px 50px -22px rgba(8,16,48,0.75);
}
.mission-text       { color: var(--ms-text); }
.mission-text-soft  { color: var(--ms-text-soft); }
.mission-text-muted { color: var(--ms-text-muted); }
.mission-divider    { border-color: var(--ms-divider); }
.mission-accent     { color: var(--ms-accent); }
```

2. Dans `ClientMissionDetailView.tsx` et `MissionTrackingPanel.tsx` :
   - Remplacer chaque `card-premium` → `mission-surface`.
   - `text-cream` → `mission-text`.
   - `text-cream/80` → `mission-text-soft`.
   - `text-cream/50` / `text-cream/40` → `mission-text-muted`.
   - `border-primary/10` → `mission-divider`.
   - Les titres `<h2>` de section et les icônes principales : `text-primary` (doré) → `mission-accent` (bleu électrique #00AEEF). Cohérent avec la décision prise pour Suivi/Véhicules.
   - Le prix total et la facture restent en `text-primary` (doré) dans le shell sombre, en navy `mission-text` + chiffre `font-semibold` en mode clair (déjà géré par le token).
   - Lien retour `text-cream/60 hover:text-primary` → `mission-text-muted hover:mission-accent`.

3. Aucun changement aux composants `StatusBadge`, `GpsMapView`, `MissionDocuments`, `FactureEmbeddedCheckout`, etc. Ils sont déjà lisibles (palette opérationnelle saturée).

## Vérification après build

- `/dashboard-pro/missions/:id` (cas du screenshot) : titre, adresse, date, prix, sections Véhicule / Détails / Contact, panneau Suivi → tout en navy foncé sur cartes blanches, accents bleu électrique.
- `/flotte/missions/:id` : idem (shell light).
- `/dashboard-client/missions/:id` : rendu inchangé (toujours dans `client-shell`, donc styles glass/navy conservés via override CSS).
- `/admin/missions/:id` : non touché.
