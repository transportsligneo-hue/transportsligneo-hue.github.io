# Espace gestion de flotte & TCO

Objectif : donner aux clients professionnels (concessions, loueurs, entreprises à parc) un vrai outil de gestion de flotte avec coût total de possession (TCO) calculé en temps réel, alertes, exports et cloisonnement par agence.

Le parc véhicules existe déjà (véhicules, documents, entretiens, mouvements, sites). On le complète plutôt que de le refaire.

## 1. Données

Nouvelles tables rattachées à un véhicule :

- **Contrats de financement** : type (comptant, LLD, LOA, crédit-bail), valeur d'acquisition ou loyer mensuel, durée, dates début/fin, valeur résiduelle.
- **Coûts véhicule** (table centrale) : catégorie (carburant, entretien, assurance, pneumatiques, péages, amendes, convoyage, financement, taxes/malus, dépréciation), montant, date, source (mission / saisie manuelle / import), justificatif, statut actif ou archivé.
- **Révisions & contrôles** : type (contrôle technique, révision constructeur, pneus), date prévue, date réalisée, statut, coût rattaché.
- **Journal d'audit** des coûts : qui a créé/modifié/archivé quelle ligne et quand. Jamais de suppression réelle.

Alimentation automatique : dès qu'une mission de convoyage liée à un véhicule passe en terminée, une ligne de coût « convoyage » est créée avec le prix de la mission (pas de ressaisie, pas de doublon si la mission est rejouée).

Ajout des champs manquants sur le véhicule : date de fin de vie prévue, statut étendu (actif / en vente / sorti de flotte), valeur de revente.

## 2. Rôles et cloisonnement

Quatre rôles flotte : lecture seule, gestion missions, gestion financière, admin flotte. Chaque utilisateur est rattaché à un ou plusieurs sites/agences et ne voit que les véhicules de son périmètre ; l'admin flotte voit tout le parc et gère les rôles depuis l'espace société. Les coûts et le TCO ne sont modifiables que par gestion financière et admin flotte.

## 3. Calcul du TCO

Toujours recalculé à la demande à partir des lignes de coûts, jamais figé en base.

```text
TCO total = financement/acquisition + carburant + entretien + assurance
          + pneumatiques + convoyage + amendes/péages + taxes/malus
          − valeur de revente estimée (si sortie de flotte)
```

Indicateurs dérivés : TCO au kilomètre, TCO mensuel moyen depuis la mise en service, écart au TCO moyen des véhicules du même type dans le parc, projection de coût à fin de contrat au rythme actuel.

## 4. Tableau de bord flotte (niveau organisation)

- TCO cumulé du parc sur la période choisie (mois, trimestre, année, personnalisé).
- Répartition du TCO par catégorie (barres empilées).
- Classement des véhicules du plus au moins coûteux au km.
- Alertes actives avec compteur.
- Filtre par site/agence, respectant les permissions.

## 5. Fiche véhicule — onglet « Coûts & TCO »

L'onglet Entretien & TCO actuel est remplacé par une vraie vue coûts : TCO total et TCO/km mis en avant, courbe d'évolution du TCO cumulé, détail ligne par ligne (date, catégorie, montant, justificatif téléchargeable), bouton « Ajouter un coût manuel » avec justificatif obligatoire, et historique des missions de convoyage déjà intégrées au TCO.

## 6. Alertes

Contrôle technique à 30/15/7 jours, révision due (km ou date, au premier atteint), contrat de financement à moins de 3 mois de l'échéance, véhicule dont le TCO/km dépasse la moyenne du parc au-delà d'un seuil configurable par l'admin flotte. Affichage en badge dans le tableau de bord et envoi par email quotidien aux gestionnaires concernés, via le système d'emails déjà en place.

## 7. Exports et reporting

- Export CSV du détail des coûts, filtrable par véhicule, période, catégorie, site.
- Rapport TCO PDF mensuel/trimestriel avec graphiques et synthèse par véhicule, au format des documents Ligneo existants.
- Rattachement des factures Ligneo au bon véhicule pour alimenter le TCO.

## Détails techniques

- Migration Supabase : tables `vehicle_finance_contracts`, `vehicle_costs`, `vehicle_service_events`, `vehicle_cost_audit` ; contraintes de clés étrangères vers `vehicles`, index sur `(vehicle_id, date)` et `categorie` ; GRANTs + RLS scopés à l'organisation et au site via `organization_members`.
- Rôles : extension de `organization_members.member_role` aux 4 valeurs flotte + table de rattachement membre ↔ sites, avec fonctions `security definer` pour les policies (pas de récursion RLS).
- Écriture d'un coût manuel : upload du justificatif puis insertion via server function transactionnelle ; en cas d'échec, aucun fichier ni ligne orpheline.
- Calculs TCO dans une fonction SQL agrégée (`get_vehicle_tco`, `get_fleet_tco`) appelée via `createServerFn`, pour rester rapide même avec plusieurs centaines de lignes par véhicule.
- Alertes : détection SQL réutilisant le mécanisme existant `alertes-documents-vehicules`, endpoint cron `/api/public/*` pour l'envoi email quotidien.
- Aucun framer-motion ; animations en CSS/Tailwind, style aligné sur le parc véhicules actuel.
