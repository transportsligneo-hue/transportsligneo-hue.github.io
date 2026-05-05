
-- ============================================================
-- Table mission_incidents
-- ============================================================
CREATE TABLE IF NOT EXISTS public.mission_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attribution_id uuid NOT NULL REFERENCES public.attributions(id) ON DELETE CASCADE,
  convoyeur_user_id uuid NOT NULL,
  titre text NOT NULL,
  description text NOT NULL,
  gravite text NOT NULL DEFAULT 'moyen' CHECK (gravite IN ('mineur','moyen','grave','critique')),
  statut text NOT NULL DEFAULT 'ouvert' CHECK (statut IN ('ouvert','en_cours','resolu','annule')),
  photos jsonb DEFAULT '[]'::jsonb,
  latitude double precision,
  longitude double precision,
  reponse_admin text,
  resolu_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mission_incidents_attribution ON public.mission_incidents(attribution_id);
CREATE INDEX IF NOT EXISTS idx_mission_incidents_statut ON public.mission_incidents(statut);

ALTER TABLE public.mission_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage incidents" ON public.mission_incidents
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Convoyeurs create own incidents" ON public.mission_incidents
  FOR INSERT TO authenticated
  WITH CHECK (convoyeur_user_id = auth.uid());

CREATE POLICY "Convoyeurs read own incidents" ON public.mission_incidents
  FOR SELECT TO authenticated
  USING (convoyeur_user_id = auth.uid());

CREATE POLICY "Convoyeurs update own incidents" ON public.mission_incidents
  FOR UPDATE TO authenticated
  USING (convoyeur_user_id = auth.uid() AND statut = 'ouvert');

CREATE POLICY "Clients read incidents own missions" ON public.mission_incidents
  FOR SELECT TO authenticated
  USING (attribution_id IN (
    SELECT a.id FROM attributions a
    JOIN trajets t ON t.id = a.trajet_id
    JOIN demandes_convoyage d ON d.id = t.demande_id
    JOIN profiles p ON p.email = d.email
    WHERE p.user_id = auth.uid()
  ));

CREATE TRIGGER trg_mission_incidents_updated
  BEFORE UPDATE ON public.mission_incidents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.mission_incidents;

-- ============================================================
-- Table admin_notifications
-- ============================================================
CREATE TABLE IF NOT EXISTS public.admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  titre text NOT NULL,
  message text,
  link text,
  entity_type text,
  entity_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  lu boolean NOT NULL DEFAULT false,
  lu_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_notifications_lu ON public.admin_notifications(lu, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_type ON public.admin_notifications(type);

ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read notifications" ON public.admin_notifications
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins update notifications" ON public.admin_notifications
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Authenticated insert notifications" ON public.admin_notifications
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins delete notifications" ON public.admin_notifications
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_notifications;
