## Objectif

1. Afficher le **même numéro de mission** dans la liste Attributions, le drawer mission et la page « Vue d'ensemble » (`/admin/missions/$missionId`).
2. Dans le Rapport mission (bouton « Rapport mission »), placer **l'historique complet daté des étapes** en haut du document et confirmer qu'aucun selfie convoyeur n'y figure.

---

## 1. Numéro de mission unifié

Aujourd'hui :
- Liste / drawer Attributions → `numero_mission || MIS-{id.slice(0,8)}` (8 premiers caractères de l'UUID).
- Page Vue d'ensemble → `formatMissionNumber(id, created_at)` = `MIS-YYYY-XXXX`.

→ Les deux écrans affichent un identifiant différent pour la même mission.

Solution :
- Extraire `formatMissionNumber(id, createdAt)` dans `src/lib/mission-number.ts` (un seul utilitaire partagé).
- Règle unique appliquée partout : `numero_mission` de la table si présent, sinon `formatMissionNumber(id, created_at)`.
- Mettre à jour :
  - `src/routes/_authenticated/admin.attributions.tsx` : carte de liste (ligne ~513), titre du drawer (ligne ~720) — ajouter `created_at` au select déjà existant.
  - `src/routes/_authenticated/admin.missions.$missionId.tsx` : remplacer l'appel local par l'import partagé, en respectant `numero_mission` si renseigné.
  - Vérifier le titre du rapport (`MissionReport`) pour qu'il reprenne ce même numéro plutôt que `id.slice(0,8).toUpperCase()`.

## 2. Rapport mission — historique des étapes en haut

Fichier : `src/components/MissionReport.tsx`.

- Charger `mission_etape_history` (déjà requêtée dans la page détail) en parallèle des autres données dans `generateReport` :
  - colonnes : `etape`, `created_at`, `note` éventuelle.
- Ajouter une nouvelle `<Section title="Avancement de la mission">` **en première position** dans le rendu, juste après le titre d'impression.
- Format : liste verticale chronologique avec, par ligne, l'étape (label lisible via mapping), la date/heure formatée `fr-FR`, et la note si présente. Mise en page sobre, compatible `window.print()`.
- Conserver toutes les sections existantes (Infos mission, Véhicule, Trajet, Client, Convoyeur, GPS, États des lieux, Documents) inchangées.

## 3. Selfies convoyeur

Vérification du code : le composant `MissionReport` ne charge ni n'affiche actuellement les selfies (`mission_selfies`). Aucun retrait nécessaire — simple confirmation à mentionner dans la réponse finale. Aucune régression à introduire (ne pas brancher les selfies par erreur).

---

## Détails techniques

### Fichier nouveau
- `src/lib/mission-number.ts` :
  ```ts
  export function formatMissionNumber(id: string, createdAt: string): string { /* logique actuelle */ }
  export function missionNumberOf(row: { id: string; created_at: string; numero_mission?: string | null }): string {
    return row.numero_mission || formatMissionNumber(row.id, row.created_at);
  }
  ```

### Fichiers modifiés
- `src/routes/_authenticated/admin.attributions.tsx` — import + remplacement des 2 endroits affichant le numéro, ajout de `created_at` dans `setAttrDetail` si manquant.
- `src/routes/_authenticated/admin.missions.$missionId.tsx` — supprimer la fonction locale, importer l'utilitaire, brancher sur `attribution.numero_mission`.
- `src/components/MissionReport.tsx` —
  - Étendre `ReportData` avec `history: Array<{ etape: string; created_at: string; note: string|null }>`.
  - Ajouter requête `mission_etape_history` triée par `created_at asc`.
  - Nouvelle section « Avancement » en tête.
  - Remplacer la référence affichée par `missionNumberOf(...)`.

### Hors-périmètre
- La `Fiche de mission` PDF (`src/lib/mission-pdf.ts`) n'est pas modifiée.
- Aucun changement de schéma DB ni de RLS.
- Aucune modification fonctionnelle des étapes ni des selfies.
