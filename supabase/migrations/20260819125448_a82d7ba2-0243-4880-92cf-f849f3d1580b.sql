DO $$
DECLARE v106 uuid; v107 uuid;
BEGIN
  SELECT id INTO v106 FROM public.devis WHERE numero = 'DEV-TLG-2026-#106';
  SELECT id INTO v107 FROM public.devis WHERE numero = 'DEV-TLG-2026-#107';

  UPDATE public.devis SET
    prix_estime = 110,
    prix_manuel = true,
    message = 'Type de trajet : Recharge uniquement (sans livraison)' || E'\n' ||
              'Véhicule 1 : RENAULT SCENIC HM-514-DR (VIN VF1RCB00677550782)' || E'\n' ||
              'Véhicule 2 : RENAULT 5 HK-733-RX (VIN VYSP0100776892422)' || E'\n' ||
              'Options : Recharge électrique (véhicule électrique)' || E'\n' ||
              'Destinataire : CAT FRANCE',
    updated_at = now()
  WHERE id = v106;

  IF v107 IS NOT NULL THEN
    DELETE FROM public.devis WHERE id = v107;
  END IF;

  UPDATE public.mission_sequences
     SET current_value = 106, updated_at = now()
   WHERE prefix = 'DEV-TLG' AND year = 2026;
END $$;