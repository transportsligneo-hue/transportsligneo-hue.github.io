# Audit & refonte plateforme convoyage — plan en 6 phases

## Constats de l'audit (déjà vérifiés en base)

- **Acceptation devis cassée** : aucune acceptation enregistrée en base (tous les devis sont passés directement à « convertit » sans signature ni verrouillage). L'étape d'acceptation existe mais n'est pas déclenchée au bon moment dans le parcours client.
- **Écart de prix 95 € / 79 €** : l'estimateur calcule le tarif standard dans le navigateur, puis la base applique le tarif personnalisé du client au moment de la création du devis. Deux calculs différents → deux montants. Il faut un calcul serveur unique.
- **Devis invisibles côté admin** : la page admin charge bien les données ; le bug est dans l'affichage/filtrage de la liste (sera corrigé en Phase 1).
- **Numérotation** : format actuel `DEV-TLG-2026-011` avec trous dans la séquence (008 manquant). Passage au format `DEV-YYYY-000001` sans réutilisation.
- Déjà en place et réutilisé : table de preuves d'acceptation, versioning des devis, bucket sécurisé `devis-acceptes`, composant d'acceptation avec CGV.

---

## Phase 1 — Devis : cycle de vie, visibilité, numérotation (Priorités 1, 4)

**Base de données**
- Statuts complets : brouillon → généré → envoyé → en attente d'acceptation → accepté → refusé → expiré → transformé en mission. Migration des statuts existants sans perte.
- Nouvelle séquence `DEV-YYYY-000001` (unique, sans doublon ni réutilisation) ; les anciens numéros sont conservés tels quels.
- Champ `expire_le` (durée de validité) + passage automatique à « expiré ».
- Interdiction de suppression : les devis ne disparaissent jamais (archivage au lieu de suppression).

**Admin — liste complète des devis**
- Colonnes : numéro, client, date, montant, statut, PDF, signature, historique.
- Filtres date / statut / client / numéro, tri et recherche.

**Client — « Mes Devis » permanent**
- Historique complet conservé indéfiniment, y compris devis convertis en mission : numéro, date, montant, statut, PDF, signer, historique.

## Phase 2 — Signature électronique + preuves (Priorités 2, 3, 12, 13)

- Ajout de la **signature manuscrite** (canvas tactile, déjà utilisé pour les états des lieux) à l'étape d'acceptation : devis → CGV → case obligatoire → signature → validation.
- Enregistrement complet : devis, version, client, date/heure, IP, navigateur, image de signature, version CGV — dans la table de preuves existante (renforcée).
- **PDF figé à l'acceptation** : généré automatiquement, stocké dans le bucket sécurisé, non modifiable. Toute modification ultérieure → nouvelle version + nouvelle signature obligatoire. Historique de toutes les versions.
- **Admin « Preuves d'acceptation »** : devis, client, signature, horodatage, IP, PDF signé + exports CSV et PDF.

## Phase 3 — Moteur tarifaire unique (Priorités 6, 7)

- **Une seule source de vérité** : fonction de calcul côté serveur utilisée partout (estimateur, devis, PDF, dashboards, emails, missions). Écart toléré : 0 €.
- L'estimateur d'un client connecté affiche directement **son** tarif personnalisé (fini le 95 €/79 €).
- Tarification étendue : ville→ville, ville→département, département→ville, département→département.
- Ordre de priorité : tarif client personnalisé > tarif professionnel > tarif ville > tarif département > tarif standard.
- Interface admin pour gérer ces règles (choix ville/département au départ et à l'arrivée).

## Phase 4 — Aller-retour + missions automatiques (Priorités 8, 9)

**Formulaire de commande**
- Mode Aller simple (inchangé) / **Aller-Retour** :
  - Livraison : adresse récupération, adresse livraison, immatriculation.
  - Restitution : adresse récupération restitution, adresse restitution finale, immatriculation indépendante, case « Même adresse de récupération que la livraison ».
  - Date + heure de restitution (si vides → « En attente de planification »).

**Création automatique**
- À la validation d'une commande aller-retour : création automatique de **2 missions liées** (Livraison + Restitution) sous une même commande, visibles immédiatement dans les 3 dashboards (client, chauffeur, admin).
- Attribution : même chauffeur ou chauffeur différent (réglage admin).

## Phase 5 — Suivi temps réel + espace client (Priorités 10, 11)

- **Timeline Livraison** : commande créée → devis accepté → mission planifiée → convoyeur affecté → véhicule récupéré → en transport → livré.
- **Timeline Restitution** : restitution planifiée → convoyeur affecté → véhicule récupéré → en transport → restitué.
- Espace client consolidé : Mes Devis / Mes Missions (livraison + restitution, documents, progression) / Mes Factures (PDF, historique).

## Phase 6 — PDF, emails, notifications, UI (Priorités 5, 14, 15)

**PDF professionnel A4**
- Mise en page : logo → coordonnées société → client → détails mission → tarification → conditions → signature → pied de page. Adresses, CGV, durée de validité et mentions légales corrigées.

**Emails & notifications**
- Page `/auth/email-confirmation` : « Email validé ✓ » + bouton vers l'espace.
- Notifications automatiques client (devis généré/accepté, mission planifiée, livraison, restitution) et admin (signature reçue, devis accepté, nouvelle mission), par email + push, toutes historisées.

**UI / UX**
- Contraste du thème crème renforcé, lisibilité des prix, responsive mobile/tablette/desktop.
- Chargeur animé avec le logo (connexion, calcul tarifaire, génération PDF, signature, upload) — animations CSS pures.

---

## Tests de non-régression (Priorité 16)

À chaque phase : génération + numérotation devis, signature, 3 dashboards, missions aller simple et aller-retour, mission retour automatique, cohérence des prix, PDF, notifications, emails, exports CSV/PDF. Aucune donnée existante n'est supprimée ; les migrations préservent tout.

## Détails techniques

- Migrations base séparées par phase (rollback facile), aucune suppression de données.
- Calcul tarifaire : fonction serveur unique réutilisant `resolve_client_pricing_rule` étendue aux départements ; le trigger en base reste comme filet de sécurité mais ne peut plus créer d'écart.
- Signature : réutilisation du composant canvas existant, image stockée dans le bucket privé.
- Missions liées : champ `commande_id` + `type_mission` (livraison/restitution) sur les missions, lien parent.
- PDF : génération côté client à l'acceptation puis upload dans le bucket (compatible avec l'environnement serveur).

## Ordre de livraison

Phase 1 → 2 → 3 → 4 → 5 → 6. Je commence par la Phase 1 dès validation.