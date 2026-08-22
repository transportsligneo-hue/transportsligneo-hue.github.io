CREATE OR REPLACE FUNCTION public.sync_legacy_mission_from_trajet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mapped_status text;
  v_mission_id uuid;
  v_plate text;
BEGIN
  mapped_status := CASE NEW.statut
    WHEN 'termine' THEN 'terminee'
    WHEN 'validee' THEN 'terminee'
    WHEN 'livre' THEN 'livree'
    WHEN 'annule' THEN 'annulee'
    WHEN 'attribue' THEN 'confirmee'
    WHEN 'en_route' THEN 'en_cours'
    ELSE NEW.statut
  END;

  v_plate := upper(replace(coalesce(nullif(NEW.immatriculation,''), NEW.vehicule_immatriculation, ''), '-', ''));

  -- 1. Lien direct trajet -> mission
  v_mission_id := NEW.mission_id;

  -- 2. Sinon, mission du même devis ET du même véhicule (jamais toutes les missions du devis)
  IF v_mission_id IS NULL AND NEW.devis_id IS NOT NULL AND v_plate <> '' THEN
    SELECT m.id INTO v_mission_id
    FROM public.missions m
    WHERE m.devis_id = NEW.devis_id
      AND upper(replace(coalesce(m.immatriculation,''), '-', '')) = v_plate
    ORDER BY m.created_at
    LIMIT 1;
  END IF;

  -- 3. Sinon, mission unique du devis (aucune ambiguïté possible)
  IF v_mission_id IS NULL AND NEW.devis_id IS NOT NULL THEN
    SELECT m.id INTO v_mission_id
    FROM public.missions m
    WHERE m.devis_id = NEW.devis_id
    GROUP BY m.id
    HAVING (SELECT count(*) FROM public.missions m2 WHERE m2.devis_id = NEW.devis_id) = 1;
  END IF;

  IF v_mission_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.missions m
  SET statut = mapped_status,
      prix_total = COALESCE(NEW.prix_client, NEW.prix_total, m.prix_total),
      updated_at = now()
  WHERE m.id = v_mission_id;

  RETURN NEW;
END;
$$;