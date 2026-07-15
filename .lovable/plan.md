
## Objectif

1. Remplacer les 3 modules de formation actuels par les **10 modules pédagogiques** fournis (sans aucune question — 100 % contenu).
2. Remplacer l'examen final actuel par l'**examen professionnel de 50 questions** fourni, avec un vrai bilan de certification (score, statut, corrections, bouton "repasser").

Aucune modification de logique métier existante (accès missions, triggers, RLS, certificat, refresh_convoyeur_training_status…). Uniquement du contenu (data) et l'écran de bilan côté front.

---

## 1. Modules de formation (data uniquement)

Via `supabase--insert` : `UPDATE` + upsert dans `formation_modules` pour :

- Désactiver / supprimer les 3 modules existants (`securite-prise-en-charge`, `edl-signatures`, `relation-client-premium`) → `is_active=false` puis remplacés.
- Insérer les 10 nouveaux modules avec :
  - `slug` stable (`m01-metier-convoyeur`, `m02-conditions-mission`, …, `m10-qualite-standard-ligneo`)
  - `title`, `description`
  - `content_type = 'text'`
  - `sections jsonb` = tableau riche (intro, sous-parties, callouts "bonnes pratiques" / "erreurs à éviter", checklists, résumé final)
  - `quiz_questions = '[]'` (aucune question dans les modules)
  - `is_required = true`, `is_active = true`, `sort_order = 10..100`
  - `estimated_minutes` calibré (8–15 min)
- La fonction `refresh_convoyeur_training_status` est inchangée et prendra automatiquement en compte les 10 modules requis.

Contenu des 10 modules (repris tel quel du brief, rédigé façon plateforme pro convoyage) :

1. Comprendre le métier de convoyeur automobile
2. Conditions pour effectuer une mission
3. Prise en charge du véhicule
4. Inspection et protection du véhicule
5. Conduite professionnelle d'un véhicule client
6. Sécurité du convoyeur et du véhicule
7. Gestion des incidents
8. Relation client et communication
9. Livraison du véhicule
10. Qualité et standard Transports Ligneo (10 règles d'or)

Chaque module = intro + sous-parties + exemples terrain + bonnes pratiques (callout success) + erreurs à éviter (callout warning) + résumé final. **Zéro QCM.**

---

## 2. Examen final (data + écran bilan)

### 2.1 Data (via `supabase--insert`)

`UPDATE formation_exams` du record actif :
- `title` : "Examen de certification Convoyeur Ligneo"
- `description` : évaluation professionnelle 50 questions / 100 points
- `question_pool` = les **50 questions** fournies telles quelles (5 parties × 10 Q), format `{ question, choices[4], answer, explanation }`
- `question_count = 50`
- `time_limit_minutes = 60`
- `minimum_score = 80`
- `is_active = true`

Le tirage tirera les 50 questions du pool (= toutes). Rétrocompatible : le trigger `handle_exam_attempt` continue de délivrer le certificat quand `passed = true`.

### 2.2 Écran de bilan (front — `src/routes/_authenticated/convoyeur.formation.tsx`)

Étendre l'écran de résultats d'examen (sans toucher au flow) pour afficher :

- **Score sur 100** (2 points par question)
- **Statut de certification** selon le seuil :
  - 90–100 : *Convoyeur confirmé* (or)
  - 80–89 : *Certification validée* (vert)
  - 70–79 : *Nouvelle tentative obligatoire après révision* (orange)
  - < 70 : *Formation complémentaire obligatoire* (rouge)
- **Bilan des questions ratées uniquement** (jamais pendant l'examen) : énoncé, réponse choisie, bonne réponse, explication pédagogique.
- **Bouton "Repasser l'examen"** si `passed = false`.
- **Bouton "Voir mon certificat"** si `passed = true`.

Aucune modification du composant Question pendant l'examen (pas d'affichage des bonnes réponses en cours). Bilan lu depuis le dernier `formation_exam_attempts` (`questions` + `answers` déjà stockés).

---

## Détails techniques

- Modules & examen = **data seulement** → 2 appels `supabase--insert` (pas de migration schéma).
- Front : édition ciblée de la vue résultats dans `convoyeur.formation.tsx` (composant `ExamResult` / bloc bilan). Aucun changement dans `admin.formation.tsx`, ni dans les triggers/RLS/fonctions.
- Rétrocompat : les anciens `formation_progress` restent valides ; la fonction `refresh_convoyeur_training_status` recalcule automatiquement au prochain module complété.
- Anciens modules désactivés (`is_active=false`) → non affichés côté convoyeur, historique préservé côté admin.

```text
formation_modules  →  10 modules riches (contenu pur, aucune Q)
formation_exams    →  1 examen actif, pool = 50 Q officielles
convoyeur.formation.tsx  →  écran bilan enrichi (statut + corrections ratées + retry)
```

Aucune régression sur le déblocage des missions, le certificat PDF, la page de vérification, ni l'espace admin.
