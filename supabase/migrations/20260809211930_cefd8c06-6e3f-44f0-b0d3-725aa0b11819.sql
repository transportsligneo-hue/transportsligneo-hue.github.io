CREATE OR REPLACE FUNCTION public.copy_demande_to_trajet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_demande RECORD;
BEGIN
  IF NEW.demande_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO v_demande FROM public.demandes_convoyage WHERE id = NEW.demande_id;
  IF v_demande IS NULL THEN RETURN NEW; END IF;

  NEW.options_meta := COALESCE(NEW.options_meta, '{}'::jsonb) || COALESCE(v_demande.options_meta, '{}'::jsonb);
  NEW.vehicule_immatriculation := COALESCE(NEW.vehicule_immatriculation, v_demande.vehicule_immatriculation, v_demande.immatriculation);
  NEW.vehicule_vin := COALESCE(NEW.vehicule_vin, v_demande.vehicule_vin);
  NEW.vehicule_energie := COALESCE(NEW.vehicule_energie, v_demande.vehicule_energie, v_demande.carburant);
  NEW.vehicule_type := COALESCE(NEW.vehicule_type, v_demande.vehicule_type);
  NEW.vehicule_couleur := COALESCE(NEW.vehicule_couleur, v_demande.vehicule_couleur);
  NEW.vehicule_km := COALESCE(NEW.vehicule_km, v_demande.vehicule_km);
  NEW.vehicule_notes := COALESCE(NEW.vehicule_notes, v_demande.vehicule_notes);

  -- colonnes historiques utilisées par l'app convoyeur / PDF
  NEW.marque := COALESCE(NULLIF(NEW.marque, ''), NULLIF(v_demande.vehicule_marque, ''), NULLIF(v_demande.marque, ''));
  NEW.modele := COALESCE(NULLIF(NEW.modele, ''), NULLIF(v_demande.vehicule_modele, ''), NULLIF(v_demande.modele, ''));
  NEW.immatriculation := COALESCE(NULLIF(NEW.immatriculation, ''), NULLIF(v_demande.vehicule_immatriculation, ''), NULLIF(v_demande.immatriculation, ''));
  NEW.vin := COALESCE(NULLIF(NEW.vin, ''), NULLIF(v_demande.vehicule_vin, ''));

  IF NEW.leg_type = 'retour' THEN
    NEW.marque := COALESCE(NULLIF(v_demande.marque_retour, ''), NEW.marque);
    NEW.modele := COALESCE(NULLIF(v_demande.modele_retour, ''), NEW.modele);
    NEW.immatriculation := COALESCE(NULLIF(v_demande.immatriculation_retour, ''), NEW.immatriculation);
    NEW.vin := COALESCE(NULLIF(v_demande.vin_retour, ''), NEW.vin);
  END IF;

  RETURN NEW;
END;
$$;

UPDATE public.trajets t
SET marque = COALESCE(NULLIF(t.marque,''), NULLIF(d.vehicule_marque,''), NULLIF(d.marque,'')),
    modele = COALESCE(NULLIF(t.modele,''), NULLIF(d.vehicule_modele,''), NULLIF(d.modele,'')),
    immatriculation = COALESCE(NULLIF(t.immatriculation,''), NULLIF(t.vehicule_immatriculation,''), NULLIF(d.vehicule_immatriculation,''), NULLIF(d.immatriculation,'')),
    vin = COALESCE(NULLIF(t.vin,''), NULLIF(t.vehicule_vin,''), NULLIF(d.vehicule_vin,'')),
    vehicule_immatriculation = COALESCE(NULLIF(t.vehicule_immatriculation,''), NULLIF(d.vehicule_immatriculation,''), NULLIF(d.immatriculation,'')),
    vehicule_vin = COALESCE(NULLIF(t.vehicule_vin,''), NULLIF(d.vehicule_vin,''))
FROM public.demandes_convoyage d
WHERE t.demande_id = d.id;

UPDATE public.missions m
SET marque = COALESCE(NULLIF(m.marque,''), NULLIF(t.marque,'')),
    modele = COALESCE(NULLIF(m.modele,''), NULLIF(t.modele,'')),
    immatriculation = COALESCE(NULLIF(m.immatriculation,''), NULLIF(t.immatriculation,'')),
    vin = COALESCE(NULLIF(m.vin,''), NULLIF(t.vin,''))
FROM public.trajets t
WHERE t.mission_id = m.id;