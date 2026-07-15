
# Formation obligatoire convoyeur — plan de mise à niveau

Base déjà en place : tables `formation_modules`, `formation_progress`, `formation_quiz_attempts`, colonnes `has_completed_training` / `training_status`, gate SQL sur `accept_mission_fixe` et `driver_apply_to_mission`, écran `/convoyeur/formation`. On étend sans casser l'existant.

## 1. Schéma DB (migration additive)

Nouvelles colonnes / tables — aucun DROP, aucune modification de logique existante :

- `formation_modules` : ajouter `sections jsonb` (blocs riches : texte, image, vidéo, checklist, callout), `passing_time_seconds int`, `is_required bool default true`, `category text` (metier, securite, app, rgpd…).
- `formation_exams` : examen final unique et versionné (`id`, `title`, `question_count`, `time_limit_minutes`, `minimum_score`, `is_active`, `questions jsonb` — pool de 40-60 questions dans lesquelles on tire N aléatoirement).
- `formation_exam_attempts` : `convoyeur_id`, `exam_id`, `score`, `passed`, `duration_seconds`, `answers jsonb`, `started_at`, `finished_at`.
- `formation_certificates` : `convoyeur_id`, `certificate_number` (format `LIGNEO-CERT-YYYY-XXXX`), `issued_at`, `full_name`, `verification_token`, `pdf_url` (nullable).
- Étendre `refresh_convoyeur_training_status` pour exiger : tous les modules `is_required=true` complétés **ET** un `formation_exam_attempts.passed=true` existant. `has_completed_training` reste la source de vérité utilisée par les gates SQL (aucun changement API).
- Trigger : à l'insert d'un `formation_exam_attempts` passed, appeler `refresh_convoyeur_training_status` + créer la ligne `formation_certificates` (numéro auto via séquence), + `create_user_notification` "Certificat disponible" et "Missions débloquées".
- RLS : mêmes patterns que l'existant (convoyeur voit le sien, admin/super_admin tout).
- Route publique de vérif certificat : lecture par `verification_token` via server fn (pas d'auth requise).

## 2. Espace convoyeur — parcours e-learning

Refonte `/convoyeur/formation` (sans casser l'URL) :

- Vue d'ensemble : progression globale, temps estimé restant, statut certificat, CTA "Reprendre".
- Liste de modules groupés par catégorie, badges (Non commencé / En cours / Validé), barre de progression par module.
- Lecteur de module : rendu des `sections` (paragraphes, images, vidéos YouTube/MP4, checklists, callouts) + scroll tracking → auto-marque `in_progress`, sauvegarde `last_seen_at` toutes les 5 s, reprise au dernier bloc lu (localStorage + DB).
- QCM module : questions tirées aléatoirement dans le pool, feedback par question après soumission, ≥ 80 % pour valider, sinon rejeu illimité avec explication des erreurs.
- Écran examen final : verrouillé tant que tous les modules requis ne sont pas validés. Timer visible, autosave des réponses, soumission auto à l'échéance, écran de résultat (score, questions ratées avec bonne réponse). Rejeu illimité de l'examen seul en cas d'échec.
- Écran certificat : aperçu HTML (identité + n° certificat + date + QR vers URL publique de vérif + signature Ligneo), bouton "Télécharger PDF" (génération client via `jspdf` déjà présent dans le projet si dispo, sinon `@react-pdf/renderer` léger — à confirmer selon deps existantes).
- Bandeau global convoyeur (déjà présent dans le layout) : "Formation à compléter — missions verrouillées" tant que `has_completed_training = false`. Les routes `/convoyeur/catalogue`, `/convoyeur/disponibles`, `/convoyeur/missions` continuent d'afficher leur alerte existante (aucun changement de logique).

## 3. Espace admin — CMS formation

Nouvelle section `/admin/formation` avec onglets :

- **Modules** : liste triable par `sort_order`, CRUD complet (titre, description, catégorie, durée estimée, score min, actif, obligatoire). Éditeur de sections en blocs (ajouter/réordonner texte, image URL, vidéo URL, checklist, callout). Éditeur de pool QCM avec import/export JSON.
- **Examen final** : édition du pool de questions, nombre de questions tirées, durée, score min, activation.
- **Résultats** : tableau des convoyeurs (statut formation, % avancement, dernier module, tentatives QCM, tentatives examen, temps total, date de certification). Filtres + export CSV. Vue détail par convoyeur : timeline des tentatives, réponses, possibilité de **réinitialiser** un module ou l'examen, bouton **certifier manuellement** (bypass admin déjà supporté via `has_completed_training`).
- **Certificats** : liste, téléchargement PDF, révocation (soft — `revoked_at`), lien de vérification.
- **Tableau de bord** : compteurs (certifiés, en cours, non commencés), taux de réussite examen, temps moyen, derniers certificats — cards Tailwind, cohérent avec le style admin existant.

## 4. Notifications

Via `create_user_notification` (in-app) + queue email + push existants :

- Formation disponible (à la validation des documents).
- Module validé, QCM échoué (avec conseils), examen réussi/échoué.
- Certificat délivré + "Missions désormais accessibles".

Templates email légers réutilisant `LigneoEmailShell` (`formation-disponible`, `formation-certifie`, `formation-examen-echoue`).

## 5. Gate & compatibilité

- Les fonctions SQL `accept_mission_fixe`, `driver_apply_to_mission` restent inchangées (elles vérifient déjà `has_completed_training`).
- Aucun changement des API existantes (attributions, missions, documents).
- Le hook front continue d'utiliser `has_completed_training` — la seule évolution est que ce flag n'est mis à `true` qu'après examen réussi.
- Un utilitaire de migration one-shot marque `has_completed_training = true` pour les convoyeurs déjà `valide` et actifs afin de ne pas verrouiller les comptes existants (opt-in via flag SQL, à confirmer avec toi).

## 6. Séquencement de livraison (3 tours agent)

1. **Migration DB** (schéma étendu, examen, certificats, trigger, seeds pool QCM ≥ 50 questions couvrant les 20 thèmes demandés).
2. **Espace convoyeur** (lecteur riche, QCM amélioré, examen, écran certificat + PDF, notifications in-app).
3. **Espace admin CMS + dashboard + templates email**.

## Détails techniques

- Stack : TanStack Start + Supabase, Tailwind, pas de framer-motion (contrainte projet).
- PDF certificat : utilisation prioritaire d'une lib déjà présente ; sinon `@react-pdf/renderer` (client only) importé dynamiquement dans le composant certificat.
- QR code : `qrcode` (léger, side-effect free) ou rendu SVG local.
- Sécurité : RLS strictes, `verification_token` en `gen_random_uuid()`, URL de vérif publique en `/verify-certificat/$token` avec fetch server fn `TO anon` renvoyant uniquement nom/prénom/date/numéro.
- Design : tokens existants (`.card-premium-light`, navy/cream/gold), pas de couleurs hors palette.

## Question avant lancement

Aucune si tu valides ; sinon dis-moi si :
- (a) on active le bypass pour les convoyeurs actuellement `valide` (recommandé pour ne bloquer personne), ou
- (b) tout le monde repasse la nouvelle formation.
