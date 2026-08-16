
CREATE OR REPLACE FUNCTION public.map_trajet_statut_to_mission(_statut text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE lower(coalesce(_statut,''))
    WHEN 'termine' THEN 'terminee'
    WHEN 'terminee' THEN 'terminee'
    WHEN 'livree' THEN 'livree'
    WHEN 'livre' THEN 'livree'
    WHEN 'annule' THEN 'annulee'
    WHEN 'annulee' THEN 'annulee'
    WHEN 'en_cours' THEN 'en_cours'
    WHEN 'attribue' THEN 'confirmee'
    WHEN 'attribuee' THEN 'confirmee'
    ELSE 'en_attente'
  END
$$;

CREATE OR REPLACE FUNCTION public.sync_mission_from_trajet()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _mission_id uuid;
BEGIN
  SELECT m.id INTO _mission_id
  FROM public.missions m
  WHERE (NEW.mission_id IS NOT NULL AND m.id = NEW.mission_id)
     OR (NEW.numero_mission IS NOT NULL
         AND m.numero = NEW.numero_mission
         AND coalesce(m.leg_type,'simple') = coalesce(NEW.leg_type,'simple'))
  ORDER BY (NEW.mission_id IS NOT NULL AND m.id = NEW.mission_id) DESC
  LIMIT 1;

  IF _mission_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.missions m
     SET statut = public.map_trajet_statut_to_mission(NEW.statut),
         immatriculation = coalesce(nullif(NEW.immatriculation,''), nullif(NEW.vehicule_immatriculation,''), m.immatriculation),
         vin = coalesce(nullif(NEW.vin,''), nullif(NEW.vehicule_vin,''), m.vin),
         carburant = coalesce(nullif(NEW.vehicule_energie,''), m.carburant),
         marque = coalesce(nullif(NEW.marque,''), m.marque),
         modele = coalesce(nullif(NEW.modele,''), m.modele),
         updated_at = now()
   WHERE m.id = _mission_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_mission_from_trajet ON public.trajets;
CREATE TRIGGER trg_sync_mission_from_trajet
AFTER INSERT OR UPDATE OF statut, immatriculation, vehicule_immatriculation, vin, vehicule_vin, vehicule_energie, marque, modele, mission_id, numero_mission
ON public.trajets
FOR EACH ROW EXECUTE FUNCTION public.sync_mission_from_trajet();

-- Backfill rétroactif : dernier trajet connu par (numéro, type de trajet)
WITH ranked AS (
  SELECT t.*, row_number() OVER (
    PARTITION BY t.numero_mission, coalesce(t.leg_type,'simple')
    ORDER BY t.updated_at DESC NULLS LAST, t.created_at DESC
  ) AS rn
  FROM public.trajets t
  WHERE t.numero_mission IS NOT NULL
)
UPDATE public.missions m
   SET statut = public.map_trajet_statut_to_mission(r.statut),
       immatriculation = coalesce(nullif(r.immatriculation,''), nullif(r.vehicule_immatriculation,''), m.immatriculation),
       vin = coalesce(nullif(r.vin,''), nullif(r.vehicule_vin,''), m.vin),
       carburant = coalesce(nullif(r.vehicule_energie,''), m.carburant),
       marque = coalesce(nullif(r.marque,''), m.marque),
       modele = coalesce(nullif(r.modele,''), m.modele),
       updated_at = now()
  FROM ranked r
 WHERE r.rn = 1
   AND m.numero = r.numero_mission
   AND coalesce(m.leg_type,'simple') = coalesce(r.leg_type,'simple');
