-- Mises à jour OBLIGATOIRES de l'appli Ligneo Driver, publiées depuis l'admin.
-- Une seule mise à jour active à la fois : les convoyeurs dont l'appli est plus ancienne
-- sont bloqués par une fenêtre jusqu'à la mise à jour (site PC / navigateur : rechargement).
CREATE TABLE IF NOT EXISTS public.driver_app_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL CHECK (version ~ '^[0-9]+(\.[0-9]+){0,2}$'),
  titre text NOT NULL DEFAULT 'Nouvelle version disponible',
  message text NOT NULL DEFAULT '',
  store_url text NOT NULL DEFAULT 'https://play.google.com/store/apps/details?id=com.transportsligneo.driver',
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS driver_app_updates_one_active ON public.driver_app_updates ((true)) WHERE active;
ALTER TABLE public.driver_app_updates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "driver_updates_read_active" ON public.driver_app_updates;
CREATE POLICY "driver_updates_read_active" ON public.driver_app_updates FOR SELECT TO authenticated
  USING (active = true);
DROP POLICY IF EXISTS "driver_updates_admin_all" ON public.driver_app_updates;
CREATE POLICY "driver_updates_admin_all" ON public.driver_app_updates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
DROP TRIGGER IF EXISTS trg_driver_app_updates_updated ON public.driver_app_updates;
CREATE TRIGGER trg_driver_app_updates_updated BEFORE UPDATE ON public.driver_app_updates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Publier = désactiver l'ancienne et activer la nouvelle en une seule opération (admin uniquement).
CREATE OR REPLACE FUNCTION public.publish_driver_app_update(p_version text, p_titre text, p_message text, p_store_url text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.driver_app_updates SET active = false WHERE active;
  INSERT INTO public.driver_app_updates (version, titre, message, store_url, active, created_by)
  VALUES (p_version, COALESCE(NULLIF(p_titre,''),'Nouvelle version disponible'), COALESCE(p_message,''),
          COALESCE(NULLIF(p_store_url,''),'https://play.google.com/store/apps/details?id=com.transportsligneo.driver'), true, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.publish_driver_app_update(text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_driver_app_update(text,text,text,text) TO authenticated;
