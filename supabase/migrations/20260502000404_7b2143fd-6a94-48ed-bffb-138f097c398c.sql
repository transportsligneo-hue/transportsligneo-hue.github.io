-- 1) Table de séquences par préfixe + année
CREATE TABLE IF NOT EXISTS public.mission_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prefix text NOT NULL,
  year int NOT NULL,
  current_value int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (prefix, year)
);

ALTER TABLE public.mission_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage sequences"
ON public.mission_sequences
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 2) Fonction atomique next_mission_number
CREATE OR REPLACE FUNCTION public.next_mission_number(_prefix text, _year int DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year int := COALESCE(_year, EXTRACT(YEAR FROM now())::int);
  v_value int;
BEGIN
  INSERT INTO public.mission_sequences (prefix, year, current_value)
  VALUES (_prefix, v_year, 1)
  ON CONFLICT (prefix, year)
  DO UPDATE SET current_value = mission_sequences.current_value + 1,
                updated_at = now()
  RETURNING current_value INTO v_value;

  RETURN _prefix || '-' || v_year::text || '-' || lpad(v_value::text, 3, '0');
END;
$$;

-- 3) Colonne numero_mission sur attributions
ALTER TABLE public.attributions
  ADD COLUMN IF NOT EXISTS numero_mission text UNIQUE;

-- 4) Trigger d'auto-numérotation
CREATE OR REPLACE FUNCTION public.attributions_set_numero()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.numero_mission IS NULL THEN
    NEW.numero_mission := public.next_mission_number('TLG', EXTRACT(YEAR FROM COALESCE(NEW.created_at, now()))::int);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_attributions_set_numero ON public.attributions;
CREATE TRIGGER trg_attributions_set_numero
  BEFORE INSERT ON public.attributions
  FOR EACH ROW
  EXECUTE FUNCTION public.attributions_set_numero();

-- 5) Backfill chronologique des attributions existantes
DO $$
DECLARE
  r record;
  v_year int;
  v_value int;
BEGIN
  FOR r IN
    SELECT id, EXTRACT(YEAR FROM created_at)::int AS y
    FROM public.attributions
    WHERE numero_mission IS NULL
    ORDER BY created_at ASC
  LOOP
    v_year := r.y;
    INSERT INTO public.mission_sequences (prefix, year, current_value)
    VALUES ('TLG', v_year, 1)
    ON CONFLICT (prefix, year)
    DO UPDATE SET current_value = mission_sequences.current_value + 1,
                  updated_at = now()
    RETURNING current_value INTO v_value;

    UPDATE public.attributions
       SET numero_mission = 'TLG-' || v_year::text || '-' || lpad(v_value::text, 3, '0')
     WHERE id = r.id;
  END LOOP;
END $$;