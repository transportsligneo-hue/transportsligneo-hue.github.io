CREATE OR REPLACE FUNCTION public.sync_grouped_devis_trajets(_devis_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  d public.devis%ROWTYPE;
  v_vehicle jsonb;
  v_plate text;
  v_first public.trajets%ROWTYPE;
  v_lot uuid;
  v_lot_ref text;
  v_count integer := 0;
  v_index integer := 0;
  v_price numeric;
  v_is_recharge boolean;
BEGIN
  SELECT * INTO d FROM public.devis WHERE id = _devis_id FOR UPDATE;
  IF d.id IS NULL OR jsonb_typeof(d.vehicules) <> 'array' OR jsonb_array_length(d.vehicules) < 2 THEN
    RETURN 0;
  END IF;

  SELECT * INTO v_first
    FROM public.trajets
   WHERE devis_id = d.id
   ORDER BY created_at, id
   LIMIT 1;

  IF v_first.id IS NULL THEN RETURN 0; END IF;

  v_is_recharge := lower(coalesce(d.option_trajet, '') || ' ' || coalesce(d.prestation, '')) LIKE '%recharge%';

  SELECT t.lot_id, t.lot_reference INTO v_lot, v_lot_ref
    FROM public.trajets t
   WHERE t.devis_id = d.id AND t.lot_id IS NOT NULL
   LIMIT 1;

  IF v_lot IS NULL THEN
    v_lot := gen_random_uuid();
    v_lot_ref := public.generate_lot_reference();
  END IF;

  FOR v_vehicle IN SELECT value FROM jsonb_array_elements(d.vehicules)
  LOOP
    v_index := v_index + 1;
    v_plate := upper(btrim(coalesce(v_vehicle->>'immatriculation', '')));
    IF v_plate = '' THEN CONTINUE; END IF;
    v_price := CASE WHEN coalesce(v_vehicle->>'prix', '') ~ '^[0-9]+([.,][0-9]+)?$'
      THEN replace(v_vehicle->>'prix', ',', '.')::numeric ELSE NULL END;

    IF v_index = 1 THEN
      UPDATE public.trajets SET
        immatriculation = v_plate,
        vehicule_immatriculation = v_plate,
        marque = NULLIF(btrim(v_vehicle->>'marque'), ''),
        modele = NULLIF(btrim(v_vehicle->>'modele'), ''),
        vin = NULLIF(upper(btrim(v_vehicle->>'vin')), ''),
        vehicule_vin = NULLIF(upper(btrim(v_vehicle->>'vin')), ''),
        arrivee = COALESCE(NULLIF(btrim(v_vehicle->>'arrivee'), ''), d.arrivee),
        prix = COALESCE(v_price, prix),
        prix_client = COALESCE(v_price, prix_client),
        lot_id = v_lot,
        lot_reference = v_lot_ref,
        mission_group_id = NULL,
        leg_type = 'simple',
        leg_index = 1,
        type_mission = CASE WHEN v_is_recharge THEN 'rechargement' ELSE 'livraison' END,
        options_meta = CASE WHEN v_is_recharge
          THEN coalesce(options_meta, '{}'::jsonb) || jsonb_build_object('recharge_seule', true)
          ELSE coalesce(options_meta, '{}'::jsonb) END,
        updated_at = now()
      WHERE id = v_first.id;
      v_count := v_count + 1;
    ELSIF NOT EXISTS (
      SELECT 1 FROM public.trajets t
       WHERE t.devis_id = d.id
         AND upper(replace(coalesce(t.immatriculation, t.vehicule_immatriculation, ''), '-', '')) = upper(replace(v_plate, '-', ''))
    ) THEN
      INSERT INTO public.trajets (
        devis_id, depart, arrivee, date_trajet, heure_trajet,
        marque, modele, immatriculation, vehicule_immatriculation, vin, vehicule_vin,
        client_nom, client_email, client_telephone,
        prix_client, prix, commission_convoyeur_pct,
        statut, statut_publication, pricing_mode, attribution_mode,
        contact_depart_nom, contact_depart_tel, contact_depart_note,
        contact_arrivee_nom, contact_arrivee_tel, contact_arrivee_note,
        type_mission, commande_ref, leg_type, leg_index,
        lot_id, lot_reference, options_meta
      ) VALUES (
        d.id, d.depart, COALESCE(NULLIF(btrim(v_vehicle->>'arrivee'), ''), d.arrivee), d.date_souhaitee, COALESCE(d.heure_souhaitee, ''),
        NULLIF(btrim(v_vehicle->>'marque'), ''), NULLIF(btrim(v_vehicle->>'modele'), ''), v_plate, v_plate,
        NULLIF(upper(btrim(v_vehicle->>'vin')), ''), NULLIF(upper(btrim(v_vehicle->>'vin')), ''),
        trim(COALESCE(d.prenom, '') || ' ' || COALESCE(d.nom, '')), d.email, COALESCE(d.telephone, ''),
        COALESCE(v_price, 0), COALESCE(v_price, 0), 65,
        v_first.statut, v_first.statut_publication, v_first.pricing_mode, v_first.attribution_mode,
        d.contact_depart_nom, d.contact_depart_tel, d.contact_depart_note,
        d.contact_arrivee_nom, d.contact_arrivee_tel, d.contact_arrivee_note,
        CASE WHEN v_is_recharge THEN 'rechargement' ELSE 'livraison' END,
        d.numero, 'simple', 1, v_lot, v_lot_ref,
        CASE WHEN v_is_recharge THEN jsonb_build_object('recharge_seule', true) ELSE '{}'::jsonb END
      );
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_grouped_devis_trajets(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_grouped_devis_trajets(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.devis_sync_grouped_trajets_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF jsonb_typeof(NEW.vehicules) = 'array' AND jsonb_array_length(NEW.vehicules) > 1 THEN
    PERFORM public.sync_grouped_devis_trajets(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.devis_sync_grouped_trajets_trigger() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_devis_sync_grouped_trajets ON public.devis;
CREATE TRIGGER trg_devis_sync_grouped_trajets
AFTER INSERT OR UPDATE OF paid_at, statut, mission_id, vehicules ON public.devis
FOR EACH ROW
WHEN (NEW.vehicules IS NOT NULL)
EXECUTE FUNCTION public.devis_sync_grouped_trajets_trigger();

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT d.id FROM public.devis d
     WHERE jsonb_typeof(d.vehicules) = 'array'
       AND jsonb_array_length(d.vehicules) > 1
       AND EXISTS (SELECT 1 FROM public.trajets t WHERE t.devis_id = d.id)
  LOOP
    PERFORM public.sync_grouped_devis_trajets(r.id);
  END LOOP;
END $$;