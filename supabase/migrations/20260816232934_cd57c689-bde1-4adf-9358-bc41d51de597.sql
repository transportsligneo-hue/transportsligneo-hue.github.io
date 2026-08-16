-- ============ CAMPAGNES ============
CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subject text NOT NULL DEFAULT '',
  sender_name text NOT NULL DEFAULT 'Transports Ligneo',
  title text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  cta_text text,
  cta_url text,
  visual_url text,
  preheader text,
  status text NOT NULL DEFAULT 'draft',
  scheduled_at timestamptz,
  sent_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;
GRANT ALL ON public.campaigns TO service_role;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage campaigns" ON public.campaigns FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE TABLE public.campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  client_id uuid,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  email text NOT NULL,
  display_name text,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, email)
);
CREATE INDEX idx_campaign_recipients_campaign ON public.campaign_recipients(campaign_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_recipients TO authenticated;
GRANT ALL ON public.campaign_recipients TO service_role;
ALTER TABLE public.campaign_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage campaign recipients" ON public.campaign_recipients FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE TABLE public.campaign_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.campaign_recipients(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  link_url text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_campaign_events_campaign ON public.campaign_events(campaign_id);
CREATE INDEX idx_campaign_events_recipient ON public.campaign_events(recipient_id);
CREATE UNIQUE INDEX idx_campaign_events_unique_open ON public.campaign_events(recipient_id)
  WHERE event_type = 'open';
GRANT SELECT ON public.campaign_events TO authenticated;
GRANT ALL ON public.campaign_events TO service_role;
ALTER TABLE public.campaign_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read campaign events" ON public.campaign_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE TABLE public.client_unsubscribes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid,
  email text NOT NULL UNIQUE,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  unsubscribed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, DELETE ON public.client_unsubscribes TO authenticated;
GRANT ALL ON public.client_unsubscribes TO service_role;
ALTER TABLE public.client_unsubscribes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage unsubscribes" ON public.client_unsubscribes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ COMPTE KILOMETRES ============
CREATE TABLE public.km_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  min_km numeric NOT NULL DEFAULT 0,
  color text NOT NULL DEFAULT '#2f5fff',
  benefit text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.km_tiers TO authenticated;
GRANT ALL ON public.km_tiers TO service_role;
ALTER TABLE public.km_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage km tiers" ON public.km_tiers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Authenticated read km tiers" ON public.km_tiers FOR SELECT TO authenticated USING (true);

INSERT INTO public.km_tiers (name, min_km, color, benefit, sort_order) VALUES
  ('Bronze', 0, '#a97142', 'Accès au suivi temps réel', 1),
  ('Argent', 2000, '#9aa5b1', 'Support prioritaire', 2),
  ('Or', 10000, '#d4af37', 'Tarif préférentiel -5%', 3),
  ('Platine', 30000, '#0b1026', 'Interlocuteur dédié et -10%', 4);

CREATE TABLE public.client_km_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  client_id uuid,
  total_km numeric NOT NULL DEFAULT 0,
  missions_count int NOT NULL DEFAULT 0,
  tier_name text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.client_km_accounts TO authenticated;
GRANT ALL ON public.client_km_accounts TO service_role;
ALTER TABLE public.client_km_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read km accounts" ON public.client_km_accounts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE OR REPLACE FUNCTION public.refresh_client_km_accounts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.client_km_accounts (email, total_km, missions_count, tier_name, updated_at)
  SELECT lower(t.client_email),
         COALESCE(SUM(d.distance_km), 0),
         COUNT(*),
         (SELECT k.name FROM public.km_tiers k
            WHERE k.min_km <= COALESCE(SUM(d.distance_km), 0)
            ORDER BY k.min_km DESC LIMIT 1),
         now()
  FROM public.trajets t
  LEFT JOIN public.devis d ON d.id = t.devis_id
  WHERE t.client_email IS NOT NULL
    AND t.statut IN ('termine', 'terminee', 'termine_valide', 'livre')
    AND COALESCE(t.is_test_data, false) = false
  GROUP BY lower(t.client_email)
  ON CONFLICT (email) DO UPDATE
    SET total_km = EXCLUDED.total_km,
        missions_count = EXCLUDED.missions_count,
        tier_name = EXCLUDED.tier_name,
        updated_at = now();
END;
$$;

SELECT public.refresh_client_km_accounts();

CREATE OR REPLACE FUNCTION public.trg_refresh_km_on_trajet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_total numeric; v_count int; v_email text;
BEGIN
  v_email := lower(NEW.client_email);
  IF v_email IS NULL THEN RETURN NEW; END IF;
  SELECT COALESCE(SUM(d.distance_km), 0), COUNT(*)
    INTO v_total, v_count
    FROM public.trajets t
    LEFT JOIN public.devis d ON d.id = t.devis_id
   WHERE lower(t.client_email) = v_email
     AND t.statut IN ('termine', 'terminee', 'termine_valide', 'livre')
     AND COALESCE(t.is_test_data, false) = false;
  INSERT INTO public.client_km_accounts (email, total_km, missions_count, tier_name, updated_at)
  VALUES (v_email, v_total, v_count,
    (SELECT k.name FROM public.km_tiers k WHERE k.min_km <= v_total ORDER BY k.min_km DESC LIMIT 1), now())
  ON CONFLICT (email) DO UPDATE
    SET total_km = EXCLUDED.total_km,
        missions_count = EXCLUDED.missions_count,
        tier_name = EXCLUDED.tier_name,
        updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_trajets_km_account
AFTER INSERT OR UPDATE OF statut, devis_id, client_email ON public.trajets
FOR EACH ROW EXECUTE FUNCTION public.trg_refresh_km_on_trajet();

CREATE TRIGGER update_km_tiers_updated_at BEFORE UPDATE ON public.km_tiers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ STORAGE (bucket campaign-assets, privé) ============
CREATE POLICY "Admins read campaign assets" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'campaign-assets' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')));
CREATE POLICY "Admins upload campaign assets" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'campaign-assets' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')));
CREATE POLICY "Admins update campaign assets" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'campaign-assets' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')));
CREATE POLICY "Admins delete campaign assets" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'campaign-assets' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')));