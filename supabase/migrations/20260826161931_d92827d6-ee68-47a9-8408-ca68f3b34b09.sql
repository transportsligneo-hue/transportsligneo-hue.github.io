-- 1) Désambiguïser les numéros partagés par des dossiers différents
WITH base AS (
  SELECT t.id,
         coalesce(t.mission_group_id::text, t.id::text) AS dossier,
         public.mission_numero_base(t.numero_mission) AS num
  FROM public.trajets t
  WHERE t.numero_mission IS NOT NULL
),
ranked AS (
  SELECT dossier, num,
         row_number() OVER (PARTITION BY num ORDER BY min(dossier)) AS rn
  FROM base
  GROUP BY dossier, num
)
UPDATE public.trajets t
   SET numero_mission = r.num || '.' || r.rn,
       updated_at = now()
  FROM base b
  JOIN ranked r ON r.dossier = b.dossier AND r.num = b.num
 WHERE t.id = b.id
   AND r.rn > 1
   AND t.numero_mission IS DISTINCT FROM r.num || '.' || r.rn;

-- 2) Réaligner les attributions sur le numéro du trajet
UPDATE public.attributions a
   SET numero_mission = NULL
  FROM public.trajets t
 WHERE a.trajet_id = t.id
   AND t.numero_mission IS NOT NULL;

UPDATE public.attributions a
   SET numero_mission = public.mission_numero_base(t.numero_mission) || public.mission_leg_suffix(t.id),
       updated_at = now()
  FROM public.trajets t
 WHERE a.trajet_id = t.id
   AND t.numero_mission IS NOT NULL;