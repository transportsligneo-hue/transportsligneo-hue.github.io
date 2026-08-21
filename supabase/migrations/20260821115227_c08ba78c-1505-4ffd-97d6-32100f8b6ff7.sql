CREATE OR REPLACE FUNCTION public.trajets_autolot_from_devis()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_lot uuid;
  v_ref text;
  v_plate text := upper(replace(coalesce(NEW.immatriculation, NEW.vehicule_immatriculation, ''), '-', ''));
BEGIN
  IF NEW.devis_id IS NULL OR NEW.lot_id IS NOT NULL OR v_plate = '' THEN RETURN NEW; END IF;

  SELECT lot_id, lot_reference INTO v_lot, v_ref
    FROM public.trajets
   WHERE devis_id = NEW.devis_id AND lot_id IS NOT NULL AND id <> NEW.id
   LIMIT 1;

  IF v_lot IS NOT NULL THEN
    UPDATE public.trajets SET lot_id = v_lot, lot_reference = v_ref WHERE id = NEW.id;
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.trajets
     WHERE devis_id = NEW.devis_id
       AND id <> NEW.id
       AND upper(replace(coalesce(immatriculation, vehicule_immatriculation, ''), '-', '')) NOT IN ('', v_plate)
  ) THEN
    v_lot := gen_random_uuid();
    v_ref := public.generate_lot_reference();
    UPDATE public.trajets
       SET lot_id = v_lot, lot_reference = v_ref
     WHERE devis_id = NEW.devis_id AND lot_id IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.trajets_autolot_from_devis() FROM public, anon;