
ALTER TABLE public.missions DROP CONSTRAINT IF EXISTS missions_statut_check;
ALTER TABLE public.missions ADD CONSTRAINT missions_statut_check
  CHECK (statut = ANY (ARRAY['en_attente','confirmee','en_cours','livree','terminee','annulee']));

CREATE OR REPLACE FUNCTION public.backfill_missions_from_trajets()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _n integer;
BEGIN
  PERFORM set_config('app.normalizing_group', '1', true);
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
  GET DIAGNOSTICS _n = ROW_COUNT;
  PERFORM set_config('app.normalizing_group', '0', true);
  RETURN _n;
END;
$$;

REVOKE ALL ON FUNCTION public.backfill_missions_from_trajets() FROM PUBLIC, anon, authenticated;

SELECT public.backfill_missions_from_trajets();
