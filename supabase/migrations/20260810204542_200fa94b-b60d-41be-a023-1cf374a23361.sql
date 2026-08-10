CREATE OR REPLACE FUNCTION public.next_document_number(_doc_prefix text, _year int DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    SELECT COALESCE(MAX((regexp_replace(numero_mission, '^MIS-TLG-[0-9]{4}-#?', ''))::int), 0)
      INTO v_max
      FROM public.missions
     WHERE numero_mission ~ ('^MIS-TLG-' || v_year::text || '-#?[0-9]{3,}$');
  END IF;

  INSERT INTO public.mission_sequences (prefix, year, current_value)
  VALUES (v_clean, v_year, v_max + 1)
  ON CONFLICT (prefix, year)
  DO UPDATE SET current_value = GREATEST(mission_sequences.current_value, v_max) + 1,
                updated_at = now()
  RETURNING current_value INTO v_value;

  RETURN v_clean || '-' || v_year::text || '-#' || lpad(v_value::text, 3, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.devis_set_numero()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.numero IS NULL OR NEW.numero !~ '^DEV-TLG-[0-9]{4}-#?[0-9]{3}$' THEN
    NEW.numero := public.next_document_number(
      'DEV-TLG',
      EXTRACT(YEAR FROM COALESCE(NEW.created_at, now()))::int
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.factures_set_numero()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.numero IS NULL OR NEW.numero !~ '^FAC-TLG-[0-9]{4}-#?[0-9]{3}$' THEN
    NEW.numero := public.next_document_number(
      'FAC-TLG',
      EXTRACT(YEAR FROM COALESCE(NEW.created_at, now()))::int
    );
  END IF;
  IF NEW.prix_tva = 0 AND NEW.prix_ht > 0 THEN
    NEW.prix_tva := round(NEW.prix_ht * NEW.tva_taux / 100, 2);
  END IF;
  IF NEW.prix_ttc = 0 AND NEW.prix_ht > 0 THEN
    NEW.prix_ttc := NEW.prix_ht + NEW.prix_tva;
  END IF;
  RETURN NEW;
END;
$$;