REVOKE EXECUTE ON FUNCTION public.sync_trajet_prix_from_devis(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.devis_prix_propagate() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT DISTINCT d.id
    FROM public.devis d
    JOIN public.trajets t ON t.devis_id = d.id
    WHERE d.prix_estime IS NOT NULL
      AND d.prix_estime > 0
      AND t.prix_client IS DISTINCT FROM d.prix_estime
  LOOP
    PERFORM public.sync_trajet_prix_from_devis(r.id);
  END LOOP;
END $$;