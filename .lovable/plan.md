# Plan — Académie de formation convoyeur Transports Ligneo

## Décisions retenues (réponses utilisateur)
- **Rédaction** : Lovable rédige les 10 modules à partir du contenu détaillé fourni dans le prompt.
- **Illustrations** : placeholders `[IMAGE: description]` dans le contenu + upload admin pour remplacer par les vraies photos.
- **Modules existants** : reset complet — purge des progressions, tentatives et certificats, réinitialisation du statut des convoyeurs.

## Objectif
Transformer le parcours actuel en une véritable académie e-learning : navigation fluide, contenu pédagogique structuré, quiz de fin de module, examen final professionnel 50 questions, certificat et déblocage des missions.

## Phase 1 — Reset et fondation (base de données)
1. Créer une migration SQL de reset :
   - `TRUNCATE` de `formation_progress`, `formation_exam_attempts`, `formation_certificates` (ou marquage `revoked_at`).
   - Réinitialisation de tous les `convoyeurs` : `has_completed_training = false`, `training_status = 'not_started'`, `training_completed_at = NULL`.
2. Vider `formation_modules` et `formation_exams` pour insérer le nouveau contenu.
3. Vérifier que les fonctions/triggers existants (`refresh_convoyeur_training_status`, `handle_exam_attempt`, `submit_module_quiz`, `submit_formation_exam`) restent compatibles.

## Phase 2 — Injection du contenu pédagogique
1. Insérer les **10 modules** selon le prompt fourni, avec pour chacun :
   - `slug`, `title`, `description`, `estimated_minutes` (conformément au prompt).
   - `sections` JSONB riches : `text`, `callout` (⚠️ Point clé), `checklist`, `image` (placeholder `[IMAGE: …]` + légende).
   - `quiz_questions` JSONB : 4 questions QCM à la fin du module, 1 bonne réponse, score minimum 80 %.
   - `is_required = true`, `is_active = true`, `category` adaptée.
2. Insérer l'**examen final** :
   - 50 questions couvrant l'ensemble des 10 modules.
   - Types : QCM, vrai/faux, mises en situation.
   - `question_count = 50`, `time_limit_minutes = 50`, `minimum_score = 80`.
   - Explications pour chaque bonne réponse.

## Phase 3 — Expérience apprenant (`/convoyeur/formation`)
1. Refonte de la vue d'ensemble :
   - Cartes de modules numérotées (1 → 10), avec indicateur d'état (verrouillé / en cours / terminé).
   - Barre de progression globale.
   - Bloc examen final débloqué uniquement quand tous les modules obligatoires sont validés.
   - Section certificat une fois l'examen réussi.
2. Vue module :
   - Affichage continu du contenu pédagogique (pas de quiz interrompant la lecture).
   - Rendu des sections riches : titres, textes, encadrés point clé, checklists, placeholders image avec légende.
   - Quiz de 4 questions en bas de page, avec correction immédiate et blocage du module suivant si score < 80 %.
   - Navigation : précédent / suivant, retour à l'académie.
3. Vue examen final :
   - Chronomètre 50 min, soumission automatique à la fin du temps.
   - 50 questions paginées ou scrollées, indicateur de progression.
   - Bilan détaillé : score, seuil, questions à revoir, délivrance du certificat si réussite.
4. Cohérence visuelle :
   - Respect de la charte premium : navy `#0b1026` / `#111a3d`, crème `#faf7ef` / `#fdfcf8`, doré `#d4af37`, typographies Playfair / Inter.
   - Pas de Framer Motion (CSS/Tailwind uniquement).

## Phase 4 — Administration (`/admin/formation`)
1. Améliorer l'éditeur de modules :
   - Formulaire visuel d'ajout/modification des sections (texte, callout, checklist, image placeholder).
   - Upload d'image pour remplacer un placeholder par une URL/vrai fichier (bucket storage dédié ou URL externe).
   - Éditeur des 4 questions QCM du module.
2. Améliorer l'éditeur d'examen :
   - Interface de gestion du pool de 50 questions (ajout, suppression, réorganisation).
   - Paramètres : nombre de questions tirées, durée, score minimum.
3. Tableau de bord résultats :
   - Progression par convoyeur, tentatives, scores, certificats émis.
   - Actions : réinitialiser un convoyeur, forcer la certification, révoquer/réactiver un certificat.

## Phase 5 — Vérification
1. Build / typecheck du projet.
2. Test visuel de l'académie côté convoyeur (parcours module + quiz + examen).
3. Test de l'admin (édition module, upload image, résultats).
4. Vérification que le reset a bien purgé les anciennes données et que les nouvelles progressions fonctionnent.

## Livrables attendus
- Migrations SQL de reset + injection contenu.
- `src/routes/_authenticated/convoyeur.formation.tsx` refondu.
- `src/routes/_authenticated/admin.formation.tsx` enrichi (éditeur visuel + upload).
- Composants pédagogiques réutilisables dans `src/components/formation/`.
- Examen final 50 questions opérationnel avec certificat PDF.

## Notes
- Le contenu exact des 10 modules et des 50 questions de l'examen sera calqué sur le prompt fourni par l'utilisateur.
- Les images seront des placeholders textuels ; l'upload admin permettra de les remplacer ensuite.
- Le blocage module suivant se fait via le score du quiz (80 % minimum), pas via des questions en cours de lecture.