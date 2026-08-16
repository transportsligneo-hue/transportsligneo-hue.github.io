CREATE OR REPLACE FUNCTION public.missions_protect_operational_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('app.normalizing_group', true) = '1'
     OR auth.role() = 'service_role'
     OR public.has_role(auth.uid(), 'admin'::public.app_role)
     OR public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RETURN NEW;
  END IF;
  NEW.prix_total           := OLD.prix_total;
  NEW.prix_locked          := OLD.prix_locked;
  NEW.statut               := OLD.statut;
  NEW.numero               := OLD.numero;
  NEW.user_id              := OLD.user_id;
  NEW.organization_id      := OLD.organization_id;
  NEW.fleet_organization_id := OLD.fleet_organization_id;
  NEW.mission_group_id     := OLD.mission_group_id;
  NEW.leg_type             := OLD.leg_type;
  NEW.leg_index            := OLD.leg_index;
  NEW.archived_at          := OLD.archived_at;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_mission_group_prices(_group uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_devis uuid;
  v_total numeric;
  v_sum numeric;
  v_locked boolean;
  v_legs int;
  v_split record;
  v_aller numeric;
  v_retour numeric;
  v_prev text;
BEGIN
  IF _group IS NULL THEN RETURN; END IF;

  SELECT count(*), bool_or(COALESCE(prix_locked,false)), sum(COALESCE(prix_total,0)),
         max(devis_id::text)::uuid
    INTO v_legs, v_locked, v_sum, v_devis
  FROM public.missions
  WHERE mission_group_id = _group AND COALESCE(statut,'') <> 'annulee';

  IF v_legs < 2 OR v_locked OR v_devis IS NULL THEN RETURN; END IF;

  SELECT COALESCE(prix_estime, total_ttc, 0),
         COALESCE(prix_aller, 0), COALESCE(prix_retour, 0)
    INTO v_total, v_aller, v_retour
  FROM public.devis WHERE id = v_devis;

  IF COALESCE(v_total,0) <= 0 THEN RETURN; END IF;
  IF abs(COALESCE(v_sum,0) - v_total) < 0.01 THEN RETURN; END IF;

  IF NOT (v_aller > 0 AND v_retour > 0 AND abs((v_aller + v_retour) - v_total) < 0.01) THEN
    SELECT * INTO v_split FROM public.split_ar_prices(v_total);
    v_aller := v_split.aller;
    v_retour := v_split.retour;
  END IF;

  v_prev := COALESCE(current_setting('app.normalizing_group', true), '0');
  PERFORM set_config('app.normalizing_group', '1', true);

  UPDATE public.missions
     SET prix_total = CASE WHEN leg_type = 'retour' THEN v_retour ELSE v_aller END
   WHERE mission_group_id = _group
     AND COALESCE(statut,'') <> 'annulee'
     AND COALESCE(prix_locked,false) = false;

  UPDATE public.trajets t
     SET prix_client = CASE WHEN t.leg_type = 'retour' THEN v_retour ELSE v_aller END,
         prix = CASE WHEN t.leg_type = 'retour' THEN v_retour ELSE v_aller END
   WHERE t.devis_id = v_devis
     AND COALESCE(t.prix_client, 0) <> CASE WHEN t.leg_type = 'retour' THEN v_retour ELSE v_aller END;

  PERFORM set_config('app.normalizing_group', v_prev, true);
END;
$$;

DO $$
DECLARE g uuid;
BEGIN
  FOR g IN SELECT DISTINCT mission_group_id FROM public.missions WHERE mission_group_id IS NOT NULL LOOP
    PERFORM public.normalize_mission_group_prices(g);
  END LOOP;
END $$;