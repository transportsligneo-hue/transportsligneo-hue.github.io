# Migration Transports Ligneo vers transportsligneo-prod + Vercel

## Constat vérifié
- La sauvegarde `transportsligneo_261018.backup.zip` n'est pas présente dans les fichiers partagés : elle doit être déposée dans le chat pour être inspectée.
- Disponible localement : 421 migrations SQL, 3 fonctions Edge (`admin-create-account`, `admin-user-actions`, `edl-document-ocr`), et le dossier `migration-ligneo` (dont `01_schema_consolide.sql`, non testé — il ne sera pas utilisé comme source principale).
- Dépendances propres à Lovable repérées : passerelle IA Lovable (fonctions IA, OCR des documents EDL), envoi d'emails Lovable (routes `lovable/email/*`, `email-send`), Stripe via connecteur, SMS, et 8 migrations planifiant des tâches automatiques (cron).
- Aucun accès à la base cible : rien ne sera importé ni prétendu importé depuis ici.

## Étapes

1. **Inspection de la sauvegarde** (dès dépôt du ZIP) : lister le contenu, identifier le format (dump custom/SQL), vérifier présence du schéma `auth` (comptes + mots de passe), des tables métier, des fonctions, des politiques de sécurité ; produire un rapport de complétude. Rappel : la sauvegarde n'inclut pas les fichiers Storage, le code Edge ni les secrets.
2. **Scripts de restauration** (dans `/mnt/documents/migration-ligneo/v3/`, à exécuter par vous sur votre poste) :
   - `10_restore.sh` : restauration non destructive sur base vide (`pg_restore --no-owner --no-acl`, schémas `public` + `auth` en conservant les UUID utilisateurs), arrêt au premier échec, journal complet.
   - Désactivation temporaire des tâches cron à l'import, réactivation contrôlée ensuite.
   - Le script refuse de s'exécuter si la base cible contient déjà des données.
3. **Storage** : `20_storage_inventory.ts` + `21_storage_copy.ts` (liste les buckets/fichiers source, recrée les buckets dans la cible, copie fichier par fichier avec somme de contrôle, reprise possible). Lecture seule côté source.
4. **Fonctions Edge** : `30_deploy_functions.sh` (déploiement des 3 fonctions via CLI Supabase) ; `edl-document-ocr` adaptée pour accepter une clé IA externe (variable) à la place de la passerelle Lovable.
5. **Incompatibilités à remplacer** (préparées en code, activées seulement après bascule) :
   - IA : clé fournisseur propre (ex. Google Gemini ou OpenAI) au lieu de la passerelle Lovable.
   - Emails : fournisseur propre (Brevo déjà utilisé) au lieu de l'envoi Lovable.
   - Stripe/Revolut : nouvelles URL de webhook vers le domaine Vercel.
   - Cron : URL des tâches réécrites vers le domaine Vercel.
   - Auth : URL de redirection, fournisseurs Google, modèles d'email à reconfigurer.
6. **Vercel** : adaptation de la cible de déploiement TanStack Start (preset Vercel au lieu de Cloudflare), fichier de configuration, et liste `40_vercel_env.md` des variables (URL et clé publique du projet, clé service role, Stripe, Revolut, Brevo, SMS, IA, Yousign, Gmail PO, secrets de webhook) — noms uniquement, aucune valeur.
7. **Vérifications automatiques** `50_verify.ts` : comparaison du nombre de lignes par table source/cible, présence des fonctions, triggers et politiques RLS, connexion test d'un compte, lecture/écriture selon les rôles, nombre et tailles des fichiers Storage, appel de chaque fonction Edge, parcours principal (devis, mission, facture PDF).
8. **Bascule** : uniquement après vérifications réussies et votre accord explicite ; l'application Lovable reste intacte et utilisable comme retour arrière.

Note : le travail en cours sur le chat Vroomy (texte blanc, badge, indicateur de réponse) sera terminé avant.

## Actions qui resteront à votre charge
- Déposer `transportsligneo_261018.backup.zip` dans le chat.
- Exécuter les scripts sur votre poste avec la chaîne de connexion de transportsligneo-prod (jamais dans le chat).
- Télécharger les fichiers Storage via Plus → Storage si la copie automatique n'est pas possible (backend en pause).
- Créer les clés IA/email propres, saisir les variables dans Vercel, mettre à jour les webhooks Stripe/Revolut et le DNS.
