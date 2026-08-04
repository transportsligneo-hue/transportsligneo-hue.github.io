DO $$
DECLARE
  g RECORD;
  keep_id uuid;
  total numeric(10,2);
  dep text;
  itin text;
BEGIN
  FOR g IN
    SELECT t.mission_group_id AS gid
    FROM public.factures f
    JOIN public.attributions a ON a.id = f.attribution_id
    JOIN public.trajets t ON t.id = a.trajet_id
    WHERE t.mission_group_id IS NOT NULL
      AND f.statut <> 'annulee'
    GROUP BY t.mission_group_id
    HAVING COUNT(*) > 1
  LOOP
    SELECT f.id INTO keep_id
    FROM public.factures f
    JOIN public.attributions a ON a.id = f.attribution_id
    JOIN public.trajets t ON t.id = a.trajet_id
    WHERE t.mission_group_id = g.gid AND f.statut <> 'annulee'
    ORDER BY f.numero ASC
    LIMIT 1;

    SELECT COALESCE(SUM(f.prix_ttc), 0) INTO total
    FROM public.factures f
    JOIN public.attributions a ON a.id = f.attribution_id
    JOIN public.trajets t ON t.id = a.trajet_id
    WHERE t.mission_group_id = g.gid AND f.statut <> 'annulee';

    SELECT t.depart INTO dep
    FROM public.trajets t
    WHERE t.mission_group_id = g.gid
    ORDER BY COALESCE(t.leg_index, 1) ASC
    LIMIT 1;

    SELECT string_agg(x.arrivee, ' → ' ORDER BY x.ord) INTO itin
    FROM (
      SELECT COALESCE(t.leg_index, 1) AS ord, t.arrivee
      FROM public.trajets t
      WHERE t.mission_group_id = g.gid
    ) x;

    UPDATE public.factures
    SET prix_ttc = total,
        prix_ht = ROUND(total / 1.2, 2),
        prix_tva = ROUND(total - ROUND(total / 1.2, 2), 2),
        depart = COALESCE(dep, depart),
        arrivee = COALESCE(itin, arrivee),
        designation = 'Convoyage véhicule — livraison + restitution',
        updated_at = now()
    WHERE id = keep_id;

    DELETE FROM public.factures f
    USING public.attributions a, public.trajets t
    WHERE f.attribution_id = a.id
      AND a.trajet_id = t.id
      AND t.mission_group_id = g.gid
      AND f.id <> keep_id
      AND f.statut <> 'annulee';
  END LOOP;
END $$;