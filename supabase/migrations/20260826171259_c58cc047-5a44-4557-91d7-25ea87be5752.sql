UPDATE public.trajets t
SET statut = 'termine'
WHERE t.statut = 'annule'
  AND EXISTS (
    SELECT 1 FROM public.attributions a
    WHERE a.trajet_id = t.id AND a.statut IN ('termine', 'validee')
  );