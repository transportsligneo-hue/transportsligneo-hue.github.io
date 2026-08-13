CREATE OR REPLACE FUNCTION public.next_document_number(_doc_prefix text, _year integer DEFAULT NULL::integer)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_year int := COALESCE(_year, EXTRACT(YEAR FROM now())::int);
  v_value int;
  v_max int := 0;
  v_clean text := upper(trim(_doc_prefix));
BEGIN
  IF v_clean NOT IN ('DEV-TLG','FAC-TLG','MIS-TLG') THEN
    RAISE EXCEPTION 'Invalid document prefix: %', _doc_prefix;
  END IF;

  IF v_clean = 'DEV-TLG' THEN
    SELECT COALESCE(MAX((regexp_replace(numero, '^DEV-TLG-[0-9]{4}-#?', ''))::int), 0)
      INTO v_max
      FROM public.devis
     WHERE numero ~ ('^DEV-TLG-' || v_year::text || '-#?[0-9]{3,}$');
  ELSIF v_clean = 'FAC-TLG' THEN
    SELECT COALESCE(MAX((regexp_replace(numero, '^FAC-TLG-[0-9]{4}-#?', ''))::int), 0)
      INTO v_max
      FROM public.factures
     WHERE numero ~ ('^FAC-TLG-' || v_year::text || '-#?[0-9]{3,}$');
  ELSIF v_clean = 'MIS-TLG' THEN
    SELECT COALESCE(MAX(n), 0) INTO v_max FROM (
      SELECT (regexp_replace(numero, '^MIS-TLG-[0-9]{4}-#?', ''))::int AS n
        FROM public.missions
       WHERE numero ~ ('^MIS-TLG-' || v_year::text || '-#?[0-9]{3,}$')
      UNION ALL
      SELECT (regexp_replace(numero_mission, '^MIS-TLG-[0-9]{4}-#?', ''))::int
        FROM public.trajets
       WHERE numero_mission ~ ('^MIS-TLG-' || v_year::text || '-#?[0-9]{3,}$')
      UNION ALL
      SELECT (regexp_replace(numero_mission, '^MIS-TLG-[0-9]{4}-#?', ''))::int
        FROM public.attributions
       WHERE numero_mission ~ ('^MIS-TLG-' || v_year::text || '-#?[0-9]{3,}$')
    ) s;
  END IF;

  INSERT INTO public.mission_sequences (prefix, year, current_value)
  VALUES (v_clean, v_year, v_max + 1)
  ON CONFLICT (prefix, year)
  DO UPDATE SET current_value = GREATEST(mission_sequences.current_value, v_max) + 1,
                updated_at = now()
  RETURNING current_value INTO v_value;

  RETURN v_clean || '-' || v_year::text || '-#' || lpad(v_value::text, 3, '0');
END;
$function$;