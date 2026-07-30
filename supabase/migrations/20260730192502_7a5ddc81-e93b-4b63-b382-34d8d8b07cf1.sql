UPDATE public.demandes_convoyage d
SET statut = 'a_traiter', updated_at = now()
WHERE d.devis_id IS NOT NULL
  AND d.statut = 'nouvelle'
  AND EXISTS (SELECT 1 FROM public.devis dv WHERE dv.id = d.devis_id AND dv.demande_id = d.id);