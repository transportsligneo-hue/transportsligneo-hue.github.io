
-- 1. Nouveau trigger devis : format DEV-TLG-YYYY-###
CREATE OR REPLACE FUNCTION public.devis_set_numero()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.numero IS NULL OR NEW.numero !~ '^DEV-TLG-[0-9]{4}-[0-9]{3}$' THEN
    NEW.numero := public.next_document_number(
      'DEV-TLG',
      EXTRACT(YEAR FROM COALESCE(NEW.created_at, now()))::int
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- 2. Autoriser DEV-TLG dans next_document_number
CREATE OR REPLACE FUNCTION public.next_document_number(_doc_prefix text, _year integer DEFAULT NULL::integer)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_year int := COALESCE(_year, EXTRACT(YEAR FROM now())::int);
  v_value int;
  v_clean text := upper(trim(_doc_prefix));
BEGIN
  IF v_clean NOT IN ('DEV-TLG','FAC-TLG','MIS-TLG') THEN
    RAISE EXCEPTION 'Invalid document prefix: %', _doc_prefix;
  END IF;

  INSERT INTO public.mission_sequences (prefix, year, current_value)
  VALUES (v_clean, v_year, 1)
  ON CONFLICT (prefix, year)
  DO UPDATE SET current_value = mission_sequences.current_value + 1,
                updated_at = now()
  RETURNING current_value INTO v_value;

  RETURN v_clean || '-' || v_year::text || '-' || lpad(v_value::text, 3, '0');
END;
$function$;

-- 3. Aligner les séquences 2026 pour que le prochain numéro soit 081
UPDATE public.mission_sequences
SET current_value = 80, updated_at = now()
WHERE prefix IN ('DEV-TLG','FAC-TLG') AND year = 2026;
