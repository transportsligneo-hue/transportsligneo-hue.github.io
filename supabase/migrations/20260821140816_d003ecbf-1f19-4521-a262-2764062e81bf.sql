INSERT INTO public.trajets
SELECT (jsonb_populate_record(
  NULL::public.trajets,
  to_jsonb(t)
  || jsonb_build_object(
       'id', gen_random_uuid(),
       'immatriculation', 'HJ-743-XA',
       'vehicule_immatriculation', 'HJ-743-XA',
       'vin', 'VF1RFK00876680883',
       'vehicule_vin', 'VF1RFK00876680883',
       'modele', 'KANGOO',
       'marque', 'RENAULT',
       'statut', 'attribue',
       'created_at', now(),
       'updated_at', now()
     )
)).*
FROM public.trajets t
WHERE t.id = '0b44403f-3820-4658-96fc-c91b76eb4f2f'
  AND NOT EXISTS (SELECT 1 FROM public.trajets x WHERE x.immatriculation = 'HJ-743-XA');

UPDATE public.trajets
SET numero_mission = 'MIS-TLG-2026-#108',
    lot_id = 'f072d404-13f7-4e94-b020-dcf524246bbd',
    lot_reference = 'LOT-TLG-2026-#001'
WHERE immatriculation = 'HJ-743-XA';