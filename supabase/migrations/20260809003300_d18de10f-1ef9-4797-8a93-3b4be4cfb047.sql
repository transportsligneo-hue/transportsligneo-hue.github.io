DO $$
BEGIN
  -- Valeurs temporaires pour respecter l'unicité des numéros d'attribution pendant la correction.
  UPDATE public.attributions
  SET numero_mission = 'TMP-' || id::text
  WHERE trajet_id IN (
    'f669d4b5-d036-45fb-bded-46e279027e1e'::uuid,
    '9680af2e-643f-4296-8c38-3b376cdbb20e'::uuid,
    'beb65225-609d-43d4-88d3-05609fb546ca'::uuid,
    '7ff35b25-d8e9-43aa-b72b-8f2aa3e0f0f3'::uuid,
    '43eaa924-1e07-4cfe-8ecf-4e185bdc9077'::uuid
  );

  -- 1er bloc : #085.
  UPDATE public.trajets
  SET numero_mission = 'MIS-TLG-2026-085'
  WHERE mission_group_id = '0fb6128e-6d50-402b-a9cf-2d2aabd5cf41'::uuid;

  UPDATE public.missions
  SET numero = 'MIS-TLG-2026-085', updated_at = now()
  WHERE mission_group_id = '0fb6128e-6d50-402b-a9cf-2d2aabd5cf41'::uuid;

  UPDATE public.attributions
  SET numero_mission = 'MIS-TLG-2026-085'
  WHERE trajet_id = 'f669d4b5-d036-45fb-bded-46e279027e1e'::uuid;

  -- 2e bloc : #101.
  UPDATE public.trajets
  SET numero_mission = 'MIS-TLG-2026-101'
  WHERE mission_group_id = '86a92377-f668-4af7-afb4-bf673888d204'::uuid;

  UPDATE public.missions
  SET numero = 'MIS-TLG-2026-101', updated_at = now()
  WHERE mission_group_id = '86a92377-f668-4af7-afb4-bf673888d204'::uuid;

  UPDATE public.attributions a
  SET numero_mission = CASE t.leg_type
    WHEN 'retour' THEN 'MIS-TLG-2026-101R'
    ELSE 'MIS-TLG-2026-101L'
  END
  FROM public.trajets t
  WHERE a.trajet_id = t.id
    AND t.mission_group_id = '86a92377-f668-4af7-afb4-bf673888d204'::uuid;

  -- 3e bloc : #083.
  UPDATE public.trajets
  SET numero_mission = 'MIS-TLG-2026-083'
  WHERE mission_group_id = 'a185e956-9939-4570-856d-8697b4d850f5'::uuid;

  UPDATE public.missions
  SET numero = 'MIS-TLG-2026-083', updated_at = now()
  WHERE mission_group_id = 'a185e956-9939-4570-856d-8697b4d850f5'::uuid;

  UPDATE public.attributions a
  SET numero_mission = CASE t.leg_type
    WHEN 'retour' THEN 'MIS-TLG-2026-083R'
    ELSE 'MIS-TLG-2026-083L'
  END
  FROM public.trajets t
  WHERE a.trajet_id = t.id
    AND t.mission_group_id = 'a185e956-9939-4570-856d-8697b4d850f5'::uuid;
END
$$;