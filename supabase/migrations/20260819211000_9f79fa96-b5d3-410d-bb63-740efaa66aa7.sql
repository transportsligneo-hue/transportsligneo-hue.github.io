
REVOKE ALL ON FUNCTION public.remu_refresh_totals(uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.remu_ajustement_after() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_trajet_termine_remuneration() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_attribution_termine_remuneration() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.calculer_remuneration_mission(uuid, boolean) FROM anon;

DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT id FROM public.trajets WHERE statut = 'termine' AND COALESCE(is_test_data,false) = false LOOP
    PERFORM public.calculer_remuneration_mission(t.id, false);
  END LOOP;
END $$;
