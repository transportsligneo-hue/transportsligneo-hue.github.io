ALTER TABLE public.trajets
  ADD COLUMN IF NOT EXISTS lot_id uuid,
  ADD COLUMN IF NOT EXISTS lot_reference text;

CREATE INDEX IF NOT EXISTS trajets_lot_id_idx ON public.trajets(lot_id);

CREATE SEQUENCE IF NOT EXISTS public.mission_lot_seq;

CREATE OR REPLACE FUNCTION public.generate_lot_reference()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE n bigint;
BEGIN
  n := nextval('public.mission_lot_seq');
  RETURN 'LOT-TLG-' || to_char(now(), 'YYYY') || '-#' || lpad((n % 100000)::text, 3, '0');
END;
$$;

-- Regroupement automatique des trajets issus d'un même devis (devis groupé multi-véhicules)
CREATE OR REPLACE FUNCTION public.trajets_autolot_from_devis()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_lot uuid;
  v_ref text;
BEGIN
  IF NEW.devis_id IS NULL OR NEW.lot_id IS NOT NULL THEN RETURN NEW; END IF;

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
       AND coalesce(mission_group_id::text,'') <> coalesce(NEW.mission_group_id::text,'')
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

DROP TRIGGER IF EXISTS trajets_autolot_from_devis_trg ON public.trajets;
CREATE TRIGGER trajets_autolot_from_devis_trg
AFTER INSERT ON public.trajets
FOR EACH ROW EXECUTE FUNCTION public.trajets_autolot_from_devis();

-- Regrouper manuellement des trajets en un lot
CREATE OR REPLACE FUNCTION public.admin_group_trajets_lot(_trajet_ids uuid[])
RETURNS TABLE(lot_id uuid, lot_reference text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_lot uuid;
  v_ref text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT (public.has_role(v_uid,'admin'::public.app_role) OR public.has_role(v_uid,'super_admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF _trajet_ids IS NULL OR array_length(_trajet_ids,1) < 2 THEN
    RAISE EXCEPTION 'Sélectionnez au moins deux missions';
  END IF;

  SELECT t.lot_id, t.lot_reference INTO v_lot, v_ref
    FROM public.trajets t
   WHERE t.id = ANY(_trajet_ids) AND t.lot_id IS NOT NULL
   LIMIT 1;

  IF v_lot IS NULL THEN
    v_lot := gen_random_uuid();
    v_ref := public.generate_lot_reference();
  END IF;

  UPDATE public.trajets SET lot_id = v_lot, lot_reference = v_ref, updated_at = now()
   WHERE id = ANY(_trajet_ids);

  RETURN QUERY SELECT v_lot, v_ref;
END;
$$;

-- Dégrouper
CREATE OR REPLACE FUNCTION public.admin_ungroup_trajets_lot(_trajet_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT (public.has_role(v_uid,'admin'::public.app_role) OR public.has_role(v_uid,'super_admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE public.trajets SET lot_id = NULL, lot_reference = NULL, updated_at = now()
   WHERE id = ANY(_trajet_ids);
END;
$$;

-- Attribuer un lot entier (ou une sélection) à un convoyeur
CREATE OR REPLACE FUNCTION public.admin_assign_lot(_lot_id uuid, _convoyeur_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  r record;
  n integer := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT (public.has_role(v_uid,'admin'::public.app_role) OR public.has_role(v_uid,'super_admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  FOR r IN
    SELECT id FROM public.trajets
     WHERE lot_id = _lot_id AND statut NOT IN ('termine','annule')
  LOOP
    PERFORM public.admin_assign_convoyeur(r.id, _convoyeur_id);
    n := n + 1;
  END LOOP;

  RETURN n;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_group_trajets_lot(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_ungroup_trajets_lot(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_assign_lot(uuid, uuid) TO authenticated;