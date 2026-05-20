## Objectif

Corriger le parcours conducteur sans casser ce qui marche : ordre des étapes, signature au bon moment, photos plus fiables, scan documents réel, ordre des photos demandé, et suppression de photos depuis l'admin.

## Ce qui va changer (vue conducteur)

### 1. Workflow mission — signature au bon moment

Aujourd'hui, en finissant l'EDL d'arrivée, les 2 signatures s'enchaînent dans le même écran et donnent l'impression que la signature s'ouvre "trop tôt". On sépare proprement :

Nouveau parcours :

1. En route pour récupérer le véhicule
2. Arrivé au lieu d'enlèvement → selfie
3. État des lieux d'enlèvement (photos + signatures départ)
4. Démarrer le trajet
5. **Arrivé au lieu de livraison** → on enregistre uniquement l'arrivée, **aucune signature ne s'affiche**
6. **État des lieux d'arrivée — photos uniquement** (plus de signature dans cet écran)
7. **Signatures d'arrivée** (convoyeur + client) — nouvelle étape déclenchée seulement après que l'EDL d'arrivée est cochée complète
8. Selfie final
9. Envoi à l'admin
10. Mission terminée (après réception côté admin)

Sécurités ajoutées :

- bouton "Avancer" verrouillé pendant l'enregistrement (anti double-clic)
- chaque étape vérifie que la précédente est validée
- en cas d'échec, message clair + bouton "Réessayer" sans repartir de zéro
- reprise de l'étape exacte si l'utilisateur ferme/recharge l'app (déjà en place, on consolide)

### 2. Photos d'état des lieux — ordre demandé

Nouvel ordre **identique au cahier des charges** :

1. Avant
2. Trois quarts avant droit
3. Jante avant droite
4. Jante arrière droite
5. Trois quarts arrière droit
6. Arrière
7. Coffre ouvert
8. **Câble électrique** *(uniquement si véhicule électrique — sinon l'étape est sautée automatiquement)*
9. Trois quarts arrière gauche
10. Jante arrière gauche
11. Jante avant gauche
12. Trois quarts avant gauche
13. Siège avant
14. Siège arrière
15. Photos libres optionnel si dégats uniquement
16. Compteur + petit cadran avec cochage oui/non pour Kit sécu, tapis de sol, cable(s) recharge si vh électrique, extincteur, roue de secours ou kit crevaison
17. Kit de sécurité
18. Documents (PV livraison + carte grise) 
19. &nbsp;

Les anciennes étapes "Côté droit" et "Côté gauche" sont retirées du nouveau parcours mais **les photos déjà prises restent visibles** côté admin (rien n'est supprimé en base).

### 3. Photos — fiabilité

- aperçu local immédiat (déjà fait, on garde)
- badges visibles par photo : **en attente / envoyée / erreur**
- bouton "Réessayer" par photo en erreur, sans perdre les autres
- file d'attente locale : si la photo n'arrive pas à partir, on la garde sur l'appareil et on retente automatiquement quand la connexion revient
- protection anti-doublon (une seule photo par zone, on remplace proprement)
- plus besoin d'actualiser la page pour voir une photo apparaître

### 4. Scan documents — vrai mode scan

À la place d'une photo brute, on met un **vrai scanner manuel** :

- cadre guide à l'écran pendant la prise
- détection des 4 coins avec **possibilité d'ajuster** par glisser (poignées)
- redressement automatique (perspective corrigée) → document droit
- filtre lisibilité (contraste + N&B optionnel)
- aperçu avant validation, reprise facile
- badges **scan en attente / scan envoyé / erreur** + bouton réessayer
- les documents déjà scannés restent si un nouveau scan échoue

(Pas de bibliothèque lourde type OpenCV : implémentation légère en canvas natif, pas d'impact perf.)

### 5. Signature

- ne s'ouvre **jamais** automatiquement après "Arrivé au lieu de livraison"
- ne s'ouvre qu'après EDL d'arrivée 100% complète
- confirmation visible dès que la signature est sauvegardée
- une signature déjà enregistrée n'est jamais écrasée silencieusement
- bouton "Refaire la signature" disponible
- en cas d'erreur, on peut réessayer sans bloquer le reste

### 6. Côté admin — suppression de photos

Sur la fiche mission admin : chaque photo d'état des lieux reçoit un petit bouton **🗑 Supprimer** (admin uniquement, avec confirmation). Utile quand le conducteur a mal cadré. La photo est retirée du dossier et de l'espace de stockage, le conducteur peut alors la reprendre.

## Ce qui ne change pas

- design (couleurs, cartes, timeline, navigation) — inchangé
- toutes les missions, statuts, signatures, photos, documents et historiques **existants sont conservés**
- les règles tarifaires, devis, factures, PDF — pas touchés
- les flux côté client, admin, et entreprise — pas touchés en dehors du bouton "supprimer photo" ajouté

## Tests effectués après livraison

Le parcours complet décrit dans le cahier des charges (1→16), plus :

- double-clic boutons / connexion faible / retour arrière / fermeture-réouverture
- véhicule électrique vs thermique (présence/absence de l'étape câble)
- photo en erreur, scan en erreur, signature en erreur

---

## Section technique (pour référence)

**Fichiers modifiés**

- `src/components/inspection/edl-premium-sequence.ts` — réordonner, retirer `cote_droit`/`cote_gauche`, ajouter `cable_electrique` (kind `photo`, conditional), retirer les 2 steps `signature_*_end` du flow arrivée.
- `src/components/inspection/EdlPremiumFlow.tsx` — filtrer `cable_electrique` si type véhicule ≠ électrique (lecture `demandes_convoyage.carburant` ou champ équivalent via le parent), retirer les signatures du filter `phase === "arrivee"`, finaliser sur `edl_arrivee_fait` (déjà le cas) sans déclencher signature.
- `src/components/convoyeur/MissionCockpit.tsx` — insérer une nouvelle action `signature_arrivee` entre `edl_arrivee` et `selfie_final`. Retirer l'auto-open de l'inspection arrivée immédiatement après `arrive_livraison` (ou laisser, mais l'EDL n'embarque plus les signatures donc plus d'effet "signature trop tôt"). Ajouter idempotence `busy` déjà présente, renforcer.
- **Nouveau** `src/components/inspection/ArriveeSignatureSheet.tsx` — modale dédiée qui enchaîne signature convoyeur + client en réutilisant `SignatureCanvas` et écrit dans `mission_signatures` (kinds `driver_end`, `client_end`).
- `src/components/inspection/QuickCameraCapture.tsx` (et le handler photo de `EdlPremiumFlow`) — ajouter file d'attente offline simple en `localStorage` (clé par `attributionId|zoneId`) flushée sur event `online`. Badges déjà présents, on les expose plus clairement.
- **Nouveau** `src/components/inspection/DocumentScanner.tsx` — overlay caméra avec 4 poignées de coins, transform perspective via canvas natif, filtre contraste. Remplace l'input file simple pour les steps `kind === "scan"`.
- `src/routes/_authenticated/admin.missions.$missionId.tsx` — sur chaque vignette photo (bloc inspections, lignes 717-739) ajouter bouton suppression : `supabase.from("inspection_photos").delete().eq(...)` + `supabase.storage.from("inspection-photos").remove([path])` + refetch.

**Aucune migration DB requise.** Les colonnes/tables existantes suffisent. Les nouveaux `vue_type` (`cable_electrique`) sont du texte libre déjà accepté.

**Gardes-fous**

- pas de suppression silencieuse de données existantes
- ID stables conservés (`face_avant`, `coffre_ouvert`, etc.)
- legacy `cote_droit`/`cote_gauche` toujours lisibles côté admin pour les anciennes missions

## Points à confirmer

1. Étape "Documents" (#17) = 2 scans séparés (PV livraison + carte grise) comme aujourd'hui, ou 1 seule entrée "Documents" multi-photos ? *Par défaut je garde les 2 scans pour ne rien casser.*
2. Le champ "véhicule électrique" : utiliser `demandes_convoyage.carburant` (`electrique`/`hybride`) ? S'il est vide, je n'affiche pas l'étape câble (sécurisé).