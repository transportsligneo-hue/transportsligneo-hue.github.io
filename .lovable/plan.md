
# Refonte "Nouvelle mission" Dashboard Pro

Périmètre : `QuickMissionForm` (Pro), fiche client admin, moteur de tarifs personnalisés, propagation vers mission + driver. Aucune autre zone du produit n'est touchée. Estimateur reste exclusivement dans `/dashboard-pro/nouvelle-demande` (l'accueil reste un récap).

## 1. Schéma de données (1 migration)

**Table `client_default_addresses`** (adresses favorites de départ par client)
- `client_user_id` (uuid), `client_email` (text, lower)
- `label` (ex: "Agence Tours"), `address`, `contact_nom`, `contact_tel`, `notes_acces`
- `is_default` (bool), `active` (bool)
- RLS : admin gère ; client lit ses propres entrées (matching `user_id` OU `email`)

**Table `demandes_convoyage`** — colonnes ajoutées :
- `options_meta jsonb default '{}'` (clé/bool : `recharge_electrique`, `plein_essence`, `nettoyage`, `express`, `autre_note`)
- `vehicule_immatriculation`, `vehicule_vin`, `vehicule_marque`, `vehicule_modele`,
  `vehicule_energie`, `vehicule_type`, `vehicule_couleur`, `vehicule_km`, `vehicule_notes`
- `default_address_id` (uuid, nullable) — adresse favorite utilisée
- `pricing_display_mode` (text — `ttc|ht|exempt`) snapshot au moment de la demande

**Table `client_pricing_rules`** — colonnes ajoutées :
- `prix_aller_simple numeric`, `prix_aller_retour numeric`, `prix_express numeric` (optionnels, en plus de `prix_ttc` existant pour rétro-compat)
- `supplements jsonb default '{}'` (ex: `{recharge_electrique:15, plein_essence:10, nettoyage:25, express:50}`)

**Trigger** : `auto_create_trajet_from_devis`-like : copier `options_meta` + champs véhicule dans `trajets` lors de la conversion (ajout colonnes équivalentes sur `trajets` si manquantes).

## 2. Admin — fiche client (`admin.clients.$clientId.tsx`)

Trois nouveaux blocs sous "Facturation" :

**a) Mode d'affichage des prix**
- Radio : TTC / HT / Non soumis TVA → écrit `profiles.pricing_display_mode` (déjà existant)
- Champ `tva_exemption_note` si exempt

**b) Adresses de départ favorites** (nouveau composant `ClientDefaultAddressesBlock`)
- Table CRUD (label, adresse, contact, tel, notes, défaut, actif)
- Bouton "Définir par défaut" radio exclusif

**c) Tarifs personnalisés v2** (refonte de `ClientPricingRulesBlock`)
- Pour chaque règle : ville/zone + prix aller simple / aller-retour / express (3 champs)
- Sous-section "Suppléments options" : 4 inputs numériques mappés sur les checkboxes
- Activation par règle (toggle existant conservé)
- Conserver ancien champ `prix_ttc` comme fallback affiché si nouveaux vides

## 3. Formulaire "Nouvelle mission" (`QuickMissionForm.tsx`)

Réorganisé en 6 sections, design existant conservé (cartes `bg-white rounded-xl border-pro-border`). Mobile : sticky CTA déjà en place.

**Section 1 — Type de prestation** : conservé (aller-simple / aller-retour / express)

**Section 2 — Lieu d'enlèvement** :
- Bandeau "Mes adresses favorites" (chips cliquables) listant `client_default_addresses` du client
- Bouton "Utiliser mon adresse par défaut" si une est marquée `is_default`
- Champs adresse + contact + tel + notes (existant) restent éditables

**Section 3 — Lieu de livraison** : inchangé

**Section 4 — Véhicule** (élargi) :
- Input plaque + bouton "Récupérer les infos" → appelle `lookupPlate` (server fn existante via `src/lib/plate.functions.ts`)
- Spinner pendant lookup, message d'erreur non bloquant si KO
- Préremplit : marque, modèle, énergie, type, VIN si dispo
- Champs : Immatriculation, VIN, Marque, Modèle, Énergie (select : essence/diesel/hybride/hybride-rechargeable/electrique/gpl/autre), Type véhicule, Couleur (optionnel), Km (optionnel), Notes véhicule
- Tous éditables manuellement

**Section 5 — Options & planning** (nouvelle) :
- 4 checkboxes (Recharge électrique, Plein essence, Nettoyage, Express) avec libellé + tarif si supplément configuré ("+15 €")
- Champ texte "Autre / commentaire libre"
- Date / heure (déplacés ici)

**Section 6 — Récap & prix** :
- `priceView` recalculé : prix base via règle perso (`prix_aller_simple|aller_retour|express`) sinon fallback standard
- Ajoute la somme des suppléments des options cochées (`supplements`)
- Affichage détaillé : ligne base + lignes options cochées avec montants, puis total selon mode TTC/HT/exempt
- **Fix contraste** : forcer `text-pro-text` / `text-slate-700` partout sur fond clair (audit visuel du composant `PriceRecap`)

## 4. Resolver de prix (`src/lib/client-pricing.ts`)

Étendre `ResolvedClientPrice` :
```ts
{ prix_base_ttc, prix_base_ht, supplements: Record<string, number>, ruleId, zone_label, ... }
```
- `resolveClientPrice` : lit nouveaux champs `prix_aller_simple|aller_retour|express` selon `tripType` ; tombe sur `prix_ttc` historique si non défini
- Nouvelle fonction `applyOptionSupplements(base, supplements, optionsChecked) → { totalTtc, lines[] }`

## 5. Propagation vers mission + driver

- `demandes_convoyage.options_meta` + champs véhicule copiés dans `trajets` (via trigger ou à la conversion manuelle dans `admin.demandes.tsx`)
- `MissionCockpit` / `MissionContactsBlock` (driver) : afficher un panneau "Prestations demandées" listant les options cochées (chips lisibles : ⚡ Recharge, ⛽ Plein, 🧽 Nettoyage…) et un bloc "Véhicule" complet (plaque, VIN, énergie, etc.)
- Boutons "Appeler" déjà présents sur contacts (vérifier `tel:` href)
- Étape "câble électrique" conditionnelle : afficher uniquement si `vehicule_energie ∈ {electrique, hybride_rechargeable}`

## 6. Vue admin demande (`admin.demandes.tsx` + drawer)

Ajouter blocs "Véhicule détaillé" et "Options demandées" — lecture seule, basés sur les nouveaux champs.

## 7. Détails techniques

- Le composant `QuickMissionForm` passe de ~470 → ~700 lignes, restant maintenable (extraire `VehicleBlock`, `OptionsBlock`, `DefaultAddressPicker` dans `src/components/dashboard-pro/`)
- Lookup plaque : réutilise `lookupPlate` server function existante (pas de nouvelle intégration)
- Validation Zod côté insert (longueurs, format plaque/VIN)
- Aucune modification du parcours B2C ni de l'estimateur public
- Migration backfill : `options_meta = '{}'`, `pricing_display_mode` déjà présent

## 8. Plan de test

Couvre les 37 points listés par l'utilisateur — checklist exécutée manuellement avant livraison (focus : tarifs Tours/Le Mans CAT France, fallback API plaque KO, options propagées au driver, switch TTC/HT/exempt cohérent estimateur→facture).

## 9. Hors scope (à confirmer)

- Pas de Stripe/paiement modifié
- Pas de refonte mobile MissionCockpit additionnelle (déjà faite tour précédent)
- Pas de modification des flux B2B `b2b_transport_requests` (canal distinct)
