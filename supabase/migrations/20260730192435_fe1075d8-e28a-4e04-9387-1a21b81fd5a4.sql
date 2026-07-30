UPDATE public.devis dv
SET demande_id = d.id,
    updated_at = now()
FROM public.demandes_convoyage d
WHERE d.id IN (
  '6d29554c-9d94-4448-bbe9-59a685bffab6'::uuid,
  'c5cc95eb-9ceb-4eb7-a131-41aa207fd227'::uuid,
  '1e6bd86c-c3a2-419e-9498-c253756f643b'::uuid
)
AND d.devis_id = dv.id
AND dv.demande_id IS NULL;

UPDATE public.demandes_convoyage
SET statut = 'a_traiter',
    devis_genere_at = COALESCE(devis_genere_at, now()),
    updated_at = now()
WHERE id IN (
  '6d29554c-9d94-4448-bbe9-59a685bffab6'::uuid,
  'c5cc95eb-9ceb-4eb7-a131-41aa207fd227'::uuid,
  '1e6bd86c-c3a2-419e-9498-c253756f643b'::uuid
)
AND devis_id IS NOT NULL
AND statut = 'nouvelle';