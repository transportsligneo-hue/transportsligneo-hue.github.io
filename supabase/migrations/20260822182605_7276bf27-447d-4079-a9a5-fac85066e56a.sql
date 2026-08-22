ALTER TABLE public.attributions DISABLE TRIGGER USER;

UPDATE public.attributions a
SET numero_mission = t.numero_mission, updated_at = now()
FROM public.trajets t
WHERE t.id = a.trajet_id
  AND t.lot_id = 'f072d404-13f7-4e94-b020-dcf524246bbd'
  AND a.numero_mission IS DISTINCT FROM t.numero_mission;

ALTER TABLE public.attributions ENABLE TRIGGER USER;
