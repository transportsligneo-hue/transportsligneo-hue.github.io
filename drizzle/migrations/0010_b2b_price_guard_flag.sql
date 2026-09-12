CREATE OR REPLACE FUNCTION public.create_b2b_transport_request(
  _company_id uuid,
  _pickup_address text,
  _dropoff_address text,
  _scheduled_date date,
  _scheduled_time time without time zone,
  _vehicle_type text,
  _vehicle_running boolean,
  _urgency text,
  _notes text,
  _distance_km numeric,
  _estimated_price_ht numeric,
  _estimated_price_ttc numeric
)
RETURNS TABLE(id uuid, numero text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
  v_numero text;
  v_dist numeric;
  v_rate numeric;
  v_base numeric;
  v_ht numeric;
  v_ttc numeric;
BEGIN
  IF _company_id IS NULL THEN RAISE EXCEPTION 'Missing company_id'; END IF;
  IF _pickup_address IS NULL OR length(trim(_pickup_address)) = 0 OR length(_pickup_address) > 500
    THEN RAISE EXCEPTION 'Invalid pickup_address'; END IF;
  IF _dropoff_address IS NULL OR length(trim(_dropoff_address)) = 0 OR length(_dropoff_address) > 500
    THEN RAISE EXCEPTION 'Invalid dropoff_address'; END IF;
  IF _notes IS NOT NULL AND length(_notes) > 4000 THEN RAISE EXCEPTION 'Notes too long'; END IF;
  IF _urgency IS NOT NULL AND _urgency NOT IN ('immediat','aujourdhui','planifie')
    THEN RAISE EXCEPTION 'Invalid urgency'; END IF;
  IF _vehicle_type IS NOT NULL AND _vehicle_type NOT IN ('leger','utilitaire','premium','electrique')
    THEN RAISE EXCEPTION 'Invalid vehicle_type'; END IF;

  v_dist := COALESCE(_distance_km, 0);
  IF v_dist <= 0 OR v_dist > 5000 THEN RAISE EXCEPTION 'Invalid distance'; END IF;

  v_rate := CASE WHEN v_dist < 200 THEN 1.30 ELSE 0.95 END;
  v_base := v_dist * v_rate;
  v_base := v_base * CASE _vehicle_type
    WHEN 'utilitaire' THEN 1.20
    WHEN 'premium'    THEN 1.30
    WHEN 'electrique' THEN 1.10
    ELSE 1.0 END;
  v_base := v_base * CASE _urgency
    WHEN 'immediat'   THEN 1.30
    WHEN 'aujourdhui' THEN 1.15
    ELSE 1.0 END;
  IF COALESCE(_vehicle_running, true) = false THEN
    v_base := v_base * 1.40;
  END IF;

  v_ht  := GREATEST(round(v_base), 89);
  v_ttc := round(v_ht * 1.20, 2);

  PERFORM set_config('ligneo.b2b_price_ok', 'on', true);

  INSERT INTO public.b2b_transport_requests (
    company_id, pickup_address, dropoff_address, scheduled_date, scheduled_time,
    vehicle_type, vehicle_running, urgency, notes, distance_km,
    estimated_price_ht, estimated_price_ttc
  ) VALUES (
    _company_id, trim(_pickup_address), trim(_dropoff_address), _scheduled_date, _scheduled_time,
    _vehicle_type, _vehicle_running, _urgency, _notes, round(v_dist),
    v_ht, v_ttc
  ) RETURNING b2b_transport_requests.id, b2b_transport_requests.numero
  INTO v_id, v_numero;

  PERFORM set_config('ligneo.b2b_price_ok', 'off', true);

  id := v_id; numero := v_numero;
  RETURN NEXT;
END;
$function$;