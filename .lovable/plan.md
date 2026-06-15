## Lot suivant — corrections critiques & finitions GPS / Missions / Auth

### 1. GPS — overlay & z-index (bug visuel capture 1)
- `GpsMapView` / `MissionLiveTracker` : la carte Leaflet déborde sur les blocs suivants (badge, prix, contacts).
  - Ajouter `position: relative`, `z-index` bas (`z-0`) au conteneur carte, `isolation: isolate` sur la section parente.
  - Forcer une hauteur fixe (`h-[280px]` mobile / `h-[420px]` desktop) avec `overflow: hidden` et `border-radius`.
  - Bottom nav mobile : monter son `z-index` (`z-50`) pour qu'il passe au-dessus de la carte.

### 2. GPS — confidentialité après mission terminée
- Quand `statut ∈ {terminee, en_attente_validation, livree}` :
  - **Client & Driver dashboards** : afficher uniquement une **polyline simplifiée** (start → end + tracé global lissé via `simplify-js` ou décimation 1 pt/2 km), sans markers intermédiaires, sans timestamps, sans bouton "centrer sur position live", sans réactualisation realtime.
  - **Admin dashboard** : conserver le tracé complet, markers détaillés, timeline horodatée (vue actuelle).
- Implémentation : prop `mode: "live" | "summary" | "admin"` sur `GpsMapView` + `MissionLiveTracker`.

### 3. GPS dans Dashboard Admin
- Ajouter un onglet/carte **"Suivi GPS temps réel"** sur `admin.missions.$missionId.tsx` avec `GpsMapView mode="admin"` (réutilisation du composant existant, pas de nouvelle logique métier).
- Ajouter une vue globale `admin.trajets.tsx` (déjà existante) : carte avec tous les convoyeurs actifs en live (markers cliquables → mission).

### 4. Statuts qui ne se mettent pas à jour ("Trajet en attente" sur mission finie)
- Audit du badge de statut dans :
  - `dashboard-client.missions.index.tsx`
  - `dashboard-pro.missions.index.tsx`
  - `convoyeur.missions.tsx` / `convoyeur.historique.tsx`
  - `admin.missions.*`
- Corriger la source : utiliser `attributions.statut` + `attributions.etape_courante` via `useMissionRealtime` (déjà existant) au lieu de `missions.statut` figé.
- Mapping statut → label centralisé (`adminMissionStatus.ts` étendu) pour cohérence dashboard partout.

### 5. Archivage missions terminées
- Section **"Archives"** dédiée (onglet ou filtre `?archived=1`) dans :
  - Admin (`admin.missions` + lien sidebar)
  - Client (`dashboard-client.missions`)
  - Pro / Flotte (`dashboard-pro.missions`, `flotte.missions`)
  - Convoyeur (`convoyeur.historique` — déjà existe, à harmoniser)
- Filtres : par date (range picker), client, convoyeur, ville départ/arrivée, statut final (livrée / annulée / litige), recherche texte (immat, n° mission).
- Tri : date desc par défaut, prix, durée.
- Tableau dense + export CSV (admin uniquement).

### 6. Fusion "Signatures" + "Traçabilité signatures" (capture 2)
- Actuellement 2 blocs distincts dans `ClientMissionDetailView` (galerie 4 images + panneau traçabilité).
- Fusionner en un seul bloc **"Signatures & Traçabilité"** :
  - 2 colonnes par étape (Départ / Arrivée), chaque étape = Convoyeur + Client côte à côte
  - Chaque entrée : vignette image signature + nom signataire + horodatage + statut (✓ signé / ⏳ en attente)
  - Bouton download discret par signature
  - Badge global "Complet / Incomplet" en haut

### 7. Bug confirmation email inscription (client + convoyeur)
- Symptôme : pas de message de confirmation, compte affiché "suspendu".
- Audit `inscription-client.tsx` + `inscription-convoyeur.tsx` + trigger `handle_new_user` + page `auth.email-confirmation.tsx` + flow `/login`.
- Vérifier :
  - Template `signup` actif et bien enregistré dans `registry.ts` (déjà refactor récent — re-vérifier après scaffold)
  - Redirect URL `emailRedirectTo` cohérent avec route existante (`/auth/email-confirmation` ou `/login`)
  - Status profil créé par trigger ≠ `suspendu` par défaut (probable bug : `statut_compte = 'pending'` interprété "suspendu" côté UI)
  - Message UI clair après inscription : "Vérifiez votre email pour activer votre compte"
  - Page de confirmation qui consomme le `token_hash` et redirige proprement
- Fix attendu : corriger le label du badge `suspendu` → `en attente de vérification email` quand `email_confirmed_at IS NULL`, et garantir l'envoi effectif du mail (route `/lovable/email/auth/webhook` opérationnelle).

### Détails techniques
- Aucun changement de logique métier (pricing, paiements, RLS existante intacte).
- Réutilise hooks existants : `useMissionRealtime`, `useGpsTracking`, `useMissionGates`.
- Ajout d'un util `src/lib/mission-display-status.ts` pour le mapping unifié label/couleur.
- Pas de nouvelle table — éventuellement une vue `v_missions_archive` si besoin de perf sur les filtres.

### Ordre d'exécution proposé
1. **Bug bloquant** : statuts "trajet en attente" partout (5) + statut "suspendu" inscription (7) — quick wins prioritaires
2. **Visuel critique** : overlay GPS (1) + fusion signatures (6)
3. **Confidentialité** : mode summary GPS post-mission (2)
4. **Admin** : GPS admin (3) + archivage (5)
