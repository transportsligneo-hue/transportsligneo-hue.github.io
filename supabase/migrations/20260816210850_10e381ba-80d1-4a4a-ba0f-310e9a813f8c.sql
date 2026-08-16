
CREATE OR REPLACE FUNCTION public.backfill_missions_from_trajets()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _n integer;
BEGIN
  PERFORM set_config('app.normalizing_group', '1', true);
  WITH best AS (
    SELECT DISTINCT ON (m.id)
      m.id AS target_mission,
      t.statut AS t_statut,
      coalesce(nullif(t.immatriculation,''), nullif(t.vehicule_immatriculation,'')) AS t_imm,
      coalesce(nullif(t.vin,''), nullif(t.vehicule_vin,'')) AS t_vin,
      nullif(t.vehicule_energie,'') AS t_energie,
      nullif(t.marque,'') AS t_marque,
      nullif(t.modele,'') AS t_modele
    FROM public.missions m
    JOIN public.trajets t
      ON t.mission_id = m.id
      OR (t.numero_mission = m.numero
          AND coalesce(t.leg_type,'simple') = coalesce(m.leg_type,'simple'))
    ORDER BY m.id,
             (t.mission_id = m.id) DESC,
             t.updated_at DESC NULLS LAST,
             t.created_at DESC
  )
  UPDATE public.missions m
     SET statut = public.map_trajet_statut_to_mission(b.t_statut),
         immatriculation = coalesce(b.t_imm, m.immatriculation),
         vin = coalesce(b.t_vin, m.vin),
         carburant = coalesce(b.t_energie, m.carburant),
         marque = coalesce(b.t_marque, m.marque),
         modele = coalesce(b.t_modele, m.modele),
         updated_at = now()
    FROM best b
   WHERE m.id = b.target_mission;
  GET DIAGNOSTICS _n = ROW_COUNT;
  PERFORM set_config('app.normalizing_group', '0', true);
  RETURN _n;
END;
$$;

REVOKE ALL ON FUNCTION public.backfill_missions_from_trajets() FROM PUBLIC, anon, authenticated;

SELECT public.backfill_missions_from_trajets();
