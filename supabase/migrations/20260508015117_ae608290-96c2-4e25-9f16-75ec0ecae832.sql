
CREATE OR REPLACE FUNCTION public.create_b2b_transport_request(
  _company_id uuid,
  _pickup_address text,
  _dropoff_address text,
  _scheduled_date date,
  _scheduled_time time,
  _vehicle_type text,
  _vehicle_running boolean,
  _urgency text,
  _notes text,
  _distance_km numeric,
  _estimated_price_ht numeric,
  _estimated_price_ttc numeric
) RETURNS TABLE (id uuid, numero text)
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_numero text;
BEGIN
  -- Basic validation
  IF _company_id IS NULL THEN RAISE EXCEPTION 'Missing company_id'; END IF;
  IF _pickup_address IS NULL OR length(trim(_pickup_address)) = 0 OR length(_pickup_address) > 500
    THEN RAISE EXCEPTION 'Invalid pickup_address'; END IF;
  IF _dropoff_address IS NULL OR length(trim(_dropoff_address)) = 0 OR length(_dropoff_address) > 500
    THEN RAISE EXCEPTION 'Invalid dropoff_address'; END IF;
  IF _notes IS NOT NULL AND length(_notes) > 4000 THEN RAISE EXCEPTION 'Notes too long'; END IF;
  IF _estimated_price_ttc IS NULL OR _estimated_price_ttc < 0 OR _estimated_price_ttc > 1000000
    THEN RAISE EXCEPTION 'Invalid price'; END IF;

  INSERT INTO public.b2b_transport_requests (
    company_id, pickup_address, dropoff_address, scheduled_date, scheduled_time,
    vehicle_type, vehicle_running, urgency, notes, distance_km,
    estimated_price_ht, estimated_price_ttc
  ) VALUES (
    _company_id, trim(_pickup_address), trim(_dropoff_address), _scheduled_date, _scheduled_time,
    _vehicle_type, _vehicle_running, _urgency, _notes, _distance_km,
    _estimated_price_ht, _estimated_price_ttc
  ) RETURNING b2b_transport_requests.id, b2b_transport_requests.numero
  INTO v_id, v_numero;

  id := v_id; numero := v_numero;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.create_b2b_transport_request(uuid,text,text,date,time,text,boolean,text,text,numeric,numeric,numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_b2b_transport_request(uuid,text,text,date,time,text,boolean,text,text,numeric,numeric,numeric) TO anon, authenticated;
