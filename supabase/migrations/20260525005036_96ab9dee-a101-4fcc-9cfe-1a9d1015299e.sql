
ALTER TABLE public.demandes_convoyage
  ADD COLUMN IF NOT EXISTS client_pricing_rule_id uuid;

ALTER TABLE public.devis
  ADD COLUMN IF NOT EXISTS client_pricing_rule_id uuid;

CREATE OR REPLACE FUNCTION public.resolve_client_pricing_rule(
  _user_id uuid,
  _email text,
  _depart text,
  _arrivee text,
  _is_aller_retour boolean
) RETURNS TABLE(rule_id uuid, prix_ttc numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_trip_type text := CASE WHEN _is_aller_retour THEN 'aller_retour' ELSE 'aller' END;
  v_email text := lower(coalesce(_email, ''));
  v_depart text := lower(coalesce(_depart, ''));
  v_arrivee text := lower(coalesce(_arrivee, ''));
BEGIN
  IF _user_id IS NULL AND length(v_email) = 0 THEN RETURN; END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT r.id, r.trip_type, r.priority, r.prix_ttc, r.prix_aller_simple, r.prix_aller_retour,
      (r.ville_depart IS NOT NULL) AS has_dep,
      (r.ville_arrivee IS NOT NULL) AS has_arr,
      (r.zone_label IS NOT NULL) AS has_zone,
      (r.ville_depart IS NULL OR position(lower(r.ville_depart) in v_depart) > 0) AS dep_ok,
      (r.ville_arrivee IS NULL OR position(lower(r.ville_arrivee) in v_arrivee) > 0) AS arr_ok
    FROM public.client_pricing_rules r
    WHERE r.active = true
      AND (
        (_user_id IS NOT NULL AND r.client_user_id = _user_id)
        OR (length(v_email) > 0 AND lower(r.client_email) = v_email)
      )
      AND (r.trip_type = 'any' OR r.trip_type = v_trip_type)
  )
  SELECT c.id,
    coalesce(
      CASE WHEN v_trip_type = 'aller_retour' THEN c.prix_aller_retour END,
      CASE WHEN v_trip_type = 'aller' THEN c.prix_aller_simple END,
      c.prix_ttc
    ) AS picked_price
  FROM candidates c
  WHERE c.dep_ok AND c.arr_ok
    AND coalesce(
      CASE WHEN v_trip_type = 'aller_retour' THEN c.prix_aller_retour END,
      CASE WHEN v_trip_type = 'aller' THEN c.prix_aller_simple END,
      c.prix_ttc
    ) > 0
  ORDER BY
    (CASE WHEN c.has_dep AND c.has_arr THEN 100
          WHEN c.has_dep OR c.has_arr OR c.has_zone THEN 50
          ELSE 10 END
     + CASE WHEN c.trip_type = v_trip_type THEN 5 ELSE 0 END
     + coalesce(c.priority, 0)) DESC
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.demandes_apply_client_pricing()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_rule_id uuid;
  v_prix numeric;
  v_is_ar boolean;
BEGIN
  IF NEW.payment_status = 'paid' THEN RETURN NEW; END IF;
  v_is_ar := (NEW.depart_retour IS NOT NULL AND length(trim(NEW.depart_retour)) > 0);
  SELECT rule_id, prix_ttc INTO v_rule_id, v_prix
  FROM public.resolve_client_pricing_rule(NEW.user_id, NEW.email, NEW.depart, NEW.arrivee, v_is_ar);
  IF v_rule_id IS NOT NULL AND v_prix IS NOT NULL THEN
    NEW.prix_estime := v_prix;
    NEW.client_pricing_rule_id := v_rule_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_demandes_apply_pricing ON public.demandes_convoyage;
CREATE TRIGGER trg_demandes_apply_pricing
BEFORE INSERT OR UPDATE OF depart, arrivee, depart_retour, email, user_id
ON public.demandes_convoyage
FOR EACH ROW EXECUTE FUNCTION public.demandes_apply_client_pricing();

CREATE OR REPLACE FUNCTION public.devis_apply_client_pricing()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_rule_id uuid;
  v_prix numeric;
BEGIN
  IF NEW.paid_at IS NOT NULL THEN RETURN NEW; END IF;
  SELECT rule_id, prix_ttc INTO v_rule_id, v_prix
  FROM public.resolve_client_pricing_rule(NEW.user_id, NEW.email, NEW.depart, NEW.arrivee, false);
  IF v_rule_id IS NOT NULL AND v_prix IS NOT NULL THEN
    NEW.prix_estime := v_prix;
    NEW.client_pricing_rule_id := v_rule_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_devis_apply_pricing ON public.devis;
CREATE TRIGGER trg_devis_apply_pricing
BEFORE INSERT OR UPDATE OF depart, arrivee, email, user_id
ON public.devis
FOR EACH ROW EXECUTE FUNCTION public.devis_apply_client_pricing();

-- Backfill via CTE (UPDATE ... FROM target alias is allowed in subqueries)
WITH to_update AS (
  SELECT d.id, r.rule_id, r.prix_ttc
  FROM public.demandes_convoyage d
  CROSS JOIN LATERAL public.resolve_client_pricing_rule(
    d.user_id, d.email, d.depart, d.arrivee,
    (d.depart_retour IS NOT NULL AND length(trim(d.depart_retour)) > 0)
  ) r
  WHERE d.payment_status <> 'paid'
    AND r.rule_id IS NOT NULL
    AND (d.prix_estime IS DISTINCT FROM r.prix_ttc OR d.client_pricing_rule_id IS DISTINCT FROM r.rule_id)
)
UPDATE public.demandes_convoyage d
SET prix_estime = u.prix_ttc,
    client_pricing_rule_id = u.rule_id,
    updated_at = now()
FROM to_update u
WHERE d.id = u.id;

WITH to_update AS (
  SELECT dv.id, r.rule_id, r.prix_ttc
  FROM public.devis dv
  CROSS JOIN LATERAL public.resolve_client_pricing_rule(
    dv.user_id, dv.email, dv.depart, dv.arrivee, false
  ) r
  WHERE dv.paid_at IS NULL
    AND r.rule_id IS NOT NULL
    AND (dv.prix_estime IS DISTINCT FROM r.prix_ttc OR dv.client_pricing_rule_id IS DISTINCT FROM r.rule_id)
)
UPDATE public.devis dv
SET prix_estime = u.prix_ttc,
    client_pricing_rule_id = u.rule_id,
    updated_at = now()
FROM to_update u
WHERE dv.id = u.id;
