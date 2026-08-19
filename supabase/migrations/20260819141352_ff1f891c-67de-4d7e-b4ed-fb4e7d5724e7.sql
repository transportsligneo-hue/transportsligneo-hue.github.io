UPDATE public.devis
SET option_trajet = 'Recharge uniquement (sans livraison) — devis groupé (2 véhicules)',
    prestation = 'Recharge véhicule uniquement (sans livraison) — devis groupé multi-véhicules'
WHERE numero = 'DEV-TLG-2026-#108';