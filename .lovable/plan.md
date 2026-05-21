## Phase 5 — Avancement

### Livré ce tour
- **Migration DB** : `factures.reference_client` + `factures.reference_label`, `profiles.relances_disabled`, `app_settings` (`factures.auto_relances`, `factures.auto_retard`).
- **PDF facture** : ligne "Référence client" en or dans le bloc infos quand renseignée.
- **Admin Factures** : pill éditable inline + bloc drawer "Référence externe" (presets libellés) + prompt automatique avant téléchargement d'une B2B sans référence.
- **Admin Paramètres** : carte "Relances & retards" avec 2 switches persistés dans `app_settings`.

### Reste à faire
- Switch par client (`profiles.relances_disabled`) dans la fiche client admin
- Phase 5 paiement Pro (checkout Stripe + webhook + bouton Payer)
- Refonte mobile MissionCockpit convoyeur
- Cron de relances conditionné par les flags
