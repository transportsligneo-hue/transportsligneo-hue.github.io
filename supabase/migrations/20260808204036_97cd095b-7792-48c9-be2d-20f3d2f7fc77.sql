-- 1. Générateur de code confidentiel (6 caractères sans caractères ambigus)
CREATE OR REPLACE FUNCTION public.gen_tracking_code()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $$
DECLARE
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  i int;
  exists_already boolean;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..6 LOOP
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    SELECT EXISTS(SELECT 1 FROM public.missions WHERE tracking_code = code) INTO exists_already;
    EXIT WHEN NOT exists_already;
  END LOOP;
  RETURN code;
END;
$$;

-- 2. Colonne sur missions
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS tracking_code text;

-- 3. Backfill des missions existantes
UPDATE public.missions SET tracking_code = public.gen_tracking_code() WHERE tracking_code IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS missions_tracking_code_key ON public.missions (tracking_code);

-- 4. Trigger de génération automatique
CREATE OR REPLACE FUNCTION public.missions_set_tracking_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.tracking_code IS NULL OR btrim(NEW.tracking_code) = '' THEN
    NEW.tracking_code := public.gen_tracking_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_missions_set_tracking_code ON public.missions;
CREATE TRIGGER trg_missions_set_tracking_code
BEFORE INSERT ON public.missions
FOR EACH ROW EXECUTE FUNCTION public.missions_set_tracking_code();

-- 5. Table de limitation des tentatives de suivi public
CREATE TABLE IF NOT EXISTS public.public_tracking_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint text NOT NULL,
  failed_count integer NOT NULL DEFAULT 0,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  blocked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS public_tracking_attempts_fp_key ON public.public_tracking_attempts (fingerprint);

GRANT ALL ON public.public_tracking_attempts TO service_role;

ALTER TABLE public.public_tracking_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view tracking attempts"
ON public.public_tracking_attempts
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));