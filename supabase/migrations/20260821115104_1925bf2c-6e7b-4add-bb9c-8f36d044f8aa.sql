CREATE OR REPLACE FUNCTION public.get_my_mission_lots(_trajet_ids uuid[])
RETURNS TABLE(trajet_id uuid, lot_id uuid, lot_reference text, plaques text[], total integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH mine AS (
    SELECT t.id, t.lot_id, t.lot_reference
      FROM public.trajets t
     WHERE t.id = ANY(_trajet_ids)
       AND t.lot_id IS NOT NULL
       AND EXISTS (
         SELECT 1
           FROM public.attributions a
           JOIN public.convoyeurs c ON c.id = a.convoyeur_id
          WHERE a.trajet_id = t.id
            AND c.user_id = auth.uid()
            AND a.statut NOT IN ('annule')
       )
  )
  SELECT m.id,
         m.lot_id,
         m.lot_reference,
         (SELECT array_agg(DISTINCT coalesce(x.immatriculation, x.vehicule_immatriculation))
            FROM public.trajets x
           WHERE x.lot_id = m.lot_id
             AND coalesce(x.immatriculation, x.vehicule_immatriculation) IS NOT NULL),
         (SELECT count(*)::int FROM public.trajets x WHERE x.lot_id = m.lot_id)
    FROM mine m;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_mission_lots(uuid[]) TO authenticated;