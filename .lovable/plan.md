# Remise en état globale de Transports Ligneo (Vercel + nouveau backend)

Une seule intervention groupée. Rien n'est supprimé, le design ne change pas, les règles de sécurité restent actives.

## 1. Déploiement Vercel
- Vérifier la configuration de build, les dépendances, les routes serveur, les webhooks et les tâches planifiées.
- Ajouter une configuration Vercel à côté de l'actuelle, sans casser l'hébergement en cours.
- Lister toutes les variables réellement lues par le code et classer chacune : publique ou secrète.
- Corriger les erreurs de build, d'import et de typage confirmées.

## 2. Backend et connexion
- Rechercher toute référence restante à l'ancien projet et la remplacer par le nouveau.
- Vérifier que la clé secrète d'administration n'est jamais envoyée au navigateur.
- Contrôler en lecture le parcours connexion, inscription, mot de passe oublié et redirection par rôle (admin, client, convoyeur, flotte).
- Ne changer aucune règle d'accès.

## 3. Cartes, adresses et distances
- Identifier le moteur de carte réellement utilisé, le nom exact de la clé Google attendue et les services Google appelés.
- Corriger les problèmes de chargement confirmés. Ajouter un repli sûr si la clé manque.

## 4. Vroomy, e-mails, SMS et connexions externes
- Vroomy dépend aujourd'hui du service IA de Lovable. Hors Lovable, il faut une clé IA à vous. Je prépare le changement de fournisseur par simple variable, sans modifier son comportement.
- E-mails, SMS (Brevo) et synchronisation Gmail passent eux aussi par Lovable. Je prépare des appels directs, activés uniquement quand vos clés sont présentes.

## 5. Livraison
- Build vérifié. Archive ZIP des fichiers modifiés dans vos Documents, pour votre copie Windows.
- Une seule liste des actions manuelles : Vercel, backend, Google Cloud, Brevo, fournisseur IA.

## Limites
- Je ne peux pas tester les services externes (Google, Brevo, IA, nouveau backend) sans vos clés. Ces tests seront marqués « à vérifier ».
- Coût estimé : 1 à 2 crédits.

## Détails techniques
- Variables : VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_PLACES_BROWSER_KEY, plus une clé de fournisseur IA et BREVO_API_KEY.
- Le passage par la passerelle IA et le connecteur Lovable reste par défaut ; le mode direct s'active seulement si la variable correspondante est définie.
