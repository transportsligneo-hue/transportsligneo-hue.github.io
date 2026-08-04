UPDATE public.factures f
SET arrivee = (
  SELECT string_agg(p.pt, ' → ' ORDER BY p.ord)
  FROM (
    SELECT DISTINCT ON (x.pt) x.pt, MIN(x.ord) AS ord
    FROM (
      SELECT COALESCE(t.leg_index, 1) AS ord, t.arrivee AS pt
      FROM public.trajets t
      JOIN public.attributions a2 ON a2.trajet_id = t.id
      WHERE t.mission_group_id = (
        SELECT t2.mission_group_id FROM public.attributions a3
        JOIN public.trajets t2 ON t2.id = a3.trajet_id
        WHERE a3.id = f.attribution_id
      )
      AND t.leg_type IN ('aller', 'retour')
      AND t.arrivee IS NOT NULL
    ) x
    GROUP BY x.pt, x.ord
  ) p
),
updated_at = now()
WHERE f.arrivee LIKE '%→%'
  AND f.attribution_id IS NOT NULL;