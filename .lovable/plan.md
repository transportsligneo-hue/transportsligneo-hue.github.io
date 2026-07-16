## Objectif

Faire du cockpit v3 (dark cyan/bleu néon) **l'écran entier** de la mission convoyeur, avec les 3 onglets Action / Informations / Documents intégrés au design, tout en supprimant le double bandeau "MISSION PLANIFIÉE …" et la carte "À faire sur cette mission" que tu as entourés en rouge.

**Aucun changement métier** : selfie, EDL, signatures, incident, tracking GPS, envoi admin, RLS, `useMissionGates`, `MissionWorkflow`. Uniquement présentation.

## Ce qui est supprimé

1. Le bandeau navy compact "MISSION PLANIFIÉE / MIS-TLG-…/ La Riche → Route de Palluau" affiché au-dessus des onglets sur Action et Documents (`convoyeur.missions.tsx` lignes 563–585) → supprimé.
2. La carte "À FAIRE SUR CETTE MISSION / Brancher pour le trajet / 0/1 effectuée" du cockpit (`MissionCockpit.tsx` lignes 577–603) → supprimée intégralement (plus de state `checklistDone`, plus d'import `Zap`/`Fuel`).
3. Les onglets externes actuels (`sticky top-[44px]` styliés `pro-bg-soft`) → sortis du route file et déplacés à l'intérieur du cockpit v3.
4. Le `PremiumMissionHero` séparé sur l'onglet Info → supprimé du rendu (le hero du cockpit devient la seule "identité" mission). Composant conservé sur disque (utilisable ailleurs).

## Ce qui devient plein écran

Dans `convoyeur.missions.tsx`, la vue mission ouverte (`openMission`) rend uniquement :

- la sticky back-bar existante (`← Missions` + pill EN COURS)
- puis `<MissionCockpit … />` qui occupe tout l'espace restant, avec `min-h-[calc(100vh-…)]` et fond `#060B24` qui s'étend au-delà du padding parent (`-mx-4 sm:-mx-6 lg:-mx-8`).

Plus aucun autre wrapper visuel entre la back-bar et le cockpit.

## Onglets Action / Informations / Documents (dans le cockpit)

Ajoutés dans `MissionCockpit.tsx` juste après le hero, avant les panes. State local `activeTab: "action" | "info" | "docs"` (défaut "action"). Style raccord :

```text
.mv3-tabs { display: flex; gap: 8px; padding: 0 14px; margin-top: 4px; }
.mv3-tab  { flex: 1; padding: 11px 14px; border-radius: 14px;
            background: rgba(255,255,255,0.04); border: 1px solid rgba(120,180,255,0.12);
            color: #9098AE; font-size: 13px; font-weight: 700; }
.mv3-tab.active { background: linear-gradient(120deg,#0E1740,#182559); color: #EAF3FF;
                  border-color: rgba(47,216,255,0.35); box-shadow: 0 6px 18px rgba(47,107,255,0.25) inset; }
```

Dynamique : clic sur un tab change `activeTab`, transition douce (fade CSS 180 ms sur les panes). Les 3 panes sont rendues conditionnellement, pas de router.

## Contenu des 3 panes (design v3 conforme au plan initial)

### Action (existant, nettoyé)
- next-card (progression ring + libellé étape + CTA `currentDef.cta` + dots + chips) — inchangé.
- MissionContactsBlock existant, dans le wrapper `.mv3-contacts-wrap`.
- Bouton "Signaler un incident" (mv3-incident) — inchangé.
- **Ajout** : dans le hero, sous le titre étape, une ligne adresse **Départ → Arrivée** (villes uniquement, tronquées) tirée du trajet passé en props (`departVille`, `arriveeVille`). C'est ce qui remplace visuellement le bandeau qu'on supprime.

### Informations (à créer, style v3)
- **vehicle-card** glass : marque + modèle + immatriculation + type + énergie + VIN (si dispo) avec bouton copier ; scan-line CSS animée.
- **client-card** glass : nom client réceptionnaire + téléphone (`tel:` cliquable) + mini route SVG (ville départ • ligne • ville arrivée).
- **quick-grid** 3 cases : Ouvrir GPS (lien Google Maps vers adresse départ/arrivée selon étape courante), Appeler contact (tel:), Aide (ouvre email support ou mailto).
- **timeline** verticale des étapes basée sur `STEPS` avec dots done / current / todo (mêmes couleurs cyan/gris que dots existants).

Data : props `vehicule` (marque/modele/immat/type/energie/vin), `client` (nom, tel), `departFull`, `arriveeFull` passées depuis `convoyeur.missions.tsx` (déjà accessibles via `t`).

### Documents (à créer, style v3)
- **docs-summary** glass : progress bar catégories requises (permis, CG, attestation…) avec pourcentage.
- **doc-list** : items avec icône fichier + nom + date + statut (uploadé / manquant).
- **dropzone** upload + sélecteur catégorie.

Data : requête `mission_documents` par attribution (comme aujourd'hui). Handler upload : `supabase.storage.from("mission-documents").upload(...)` puis insert row (schéma existant, non modifié).

## Fichiers touchés

- `src/components/convoyeur/MissionCockpit.tsx`
  - Supprimer bloc À faire (l.577–603) + imports `Zap`/`Fuel` + state `checklistDone`.
  - Ajouter props `departVille`, `arriveeVille`, `departFull`, `arriveeFull`, `vehicule`, `client`.
  - Ajouter state `activeTab`, barre `.mv3-tabs` sous le hero, wrappers `.mv3-pane-action`, `.mv3-pane-info`, `.mv3-pane-docs`.
  - Ajouter styles CSS scoped pour tabs, vehicle-card, client-card, quick-grid, timeline, docs-summary, dropzone.
  - Ligne adresses "Départ → Arrivée" dans le hero.

- `src/routes/_authenticated/convoyeur.missions.tsx`
  - Retirer bloc `PremiumMissionHero` (l.532–561).
  - Retirer bandeau compact navy (l.563–585).
  - Retirer barre d'onglets externe (l.588–~640).
  - Remplacer le contenu de la vue ouverte par `<div className="min-h-screen -mx-4 sm:-mx-6 lg:-mx-8" style={{background:"#060B24"}}> …back-bar + MissionCockpit… </div>`.
  - Passer les nouvelles props (`departVille`, `arriveeVille`, `vehicule`, `client`) au cockpit.
  - Conserver `inspectionOverlay`, `DriverSelfieCapture`, `IncidentReportSheet`, `ArriveeSignatureSheet` (déclenchés par le cockpit).

- `src/components/convoyeur/PremiumMissionHero.tsx` : **inchangé** (non rendu, mais conservé).
- `MissionWorkflow.tsx` : **inchangé**.

## Guardrails

- Framer-motion interdit → toutes animations en CSS/SVG.
- Aucun changement de schéma DB, RLS, hook métier.
- Le thème dark reste scoped à la vue mission ouverte du convoyeur (pas propagé au reste de l'espace convoyeur — liste des missions, sidebar, header restent identiques).
- Tap targets ≥ 44 px, focus visibles, aria-labels sur tabs, gpsTarget respecte `depart` ou `arrivee` selon l'étape courante.
- Sécurité : upload documents passe par les policies existantes de `mission_documents` (aucune nouvelle RLS).

## Livrable

Ouvrir une mission convoyeur → un seul écran cockpit dark v3 plein écran :
- Hero avec ring + road + `MIS-TLG-…` en eyebrow + adresses Départ → Arrivée
- 3 onglets cyan dynamiques directement sous le hero
- Panes Action / Informations / Documents conformes au design v3 (glass, chips, timeline, vehicle-card, docs-list)
- Plus aucun bandeau navy ni carte "À faire" en double.

Comportement métier strictement identique (selfie, EDL, signatures, incident, envoi admin).