
-- =====================================================
-- TABLE: companies
-- =====================================================
CREATE TABLE public.companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'autre',
  siret TEXT,
  size TEXT,
  sector TEXT,
  contact_name TEXT NOT NULL,
  contact_function TEXT,
  contact_email TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  score_category TEXT NOT NULL DEFAULT 'cold',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_companies_email ON public.companies(contact_email);
CREATE INDEX idx_companies_score ON public.companies(score DESC);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage companies"
  ON public.companies FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can create company"
  ON public.companies FOR INSERT TO anon, authenticated
  WITH CHECK (
    length(trim(name)) BETWEEN 1 AND 200
    AND length(trim(contact_name)) BETWEEN 1 AND 200
    AND length(trim(contact_email)) BETWEEN 3 AND 254
    AND contact_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
    AND length(trim(contact_phone)) BETWEEN 1 AND 50
  );

CREATE POLICY "Anyone can read company by email"
  ON public.companies FOR SELECT TO anon, authenticated
  USING (true);

-- =====================================================
-- TABLE: b2b_transport_requests
-- =====================================================
CREATE TABLE public.b2b_transport_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero TEXT NOT NULL DEFAULT ('B2B-' || to_char(now(), 'YYYYMMDD') || '-' || substr(gen_random_uuid()::text, 1, 6)),
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  pickup_address TEXT NOT NULL,
  dropoff_address TEXT NOT NULL,
  scheduled_date DATE NOT NULL,
  scheduled_time TEXT NOT NULL,
  vehicle_type TEXT NOT NULL DEFAULT 'leger',
  vehicle_running BOOLEAN NOT NULL DEFAULT true,
  urgency TEXT NOT NULL DEFAULT 'planifie',
  notes TEXT,
  distance_km INTEGER,
  estimated_price_ht NUMERIC(10,2),
  estimated_price_ttc NUMERIC(10,2),
  payment_status TEXT NOT NULL DEFAULT 'pending',
  stripe_session_id TEXT,
  stripe_payment_intent_id TEXT,
  operational_status TEXT NOT NULL DEFAULT 'nouveau',
  assigned_convoyeur_id UUID,
  internal_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_b2b_tr_company ON public.b2b_transport_requests(company_id);
CREATE INDEX idx_b2b_tr_status ON public.b2b_transport_requests(operational_status);
CREATE INDEX idx_b2b_tr_payment ON public.b2b_transport_requests(payment_status);
CREATE INDEX idx_b2b_tr_session ON public.b2b_transport_requests(stripe_session_id);

ALTER TABLE public.b2b_transport_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage b2b transport requests"
  ON public.b2b_transport_requests FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can create transport request"
  ON public.b2b_transport_requests FOR INSERT TO anon, authenticated
  WITH CHECK (
    length(trim(pickup_address)) BETWEEN 1 AND 500
    AND length(trim(dropoff_address)) BETWEEN 1 AND 500
  );

CREATE POLICY "Anyone can read own session request"
  ON public.b2b_transport_requests FOR SELECT TO anon, authenticated
  USING (true);

-- =====================================================
-- TABLE: b2b_fleet_leads
-- =====================================================
CREATE TABLE public.b2b_fleet_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero TEXT NOT NULL DEFAULT ('LEAD-' || to_char(now(), 'YYYYMMDD') || '-' || substr(gen_random_uuid()::text, 1, 6)),
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  structure_type TEXT NOT NULL DEFAULT 'autre',
  need_type TEXT NOT NULL DEFAULT 'autre',
  estimated_vehicle_count INTEGER NOT NULL DEFAULT 0,
  frequency TEXT,
  geography TEXT,
  vehicle_types TEXT,
  start_delay TEXT,
  budget TEXT,
  description TEXT,
  constraints TEXT,
  lead_score INTEGER NOT NULL DEFAULT 0,
  score_category TEXT NOT NULL DEFAULT 'cold',
  status TEXT NOT NULL DEFAULT 'nouveau',
  assigned_to UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_b2b_leads_company ON public.b2b_fleet_leads(company_id);
CREATE INDEX idx_b2b_leads_status ON public.b2b_fleet_leads(status);
CREATE INDEX idx_b2b_leads_score ON public.b2b_fleet_leads(lead_score DESC);

ALTER TABLE public.b2b_fleet_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage b2b fleet leads"
  ON public.b2b_fleet_leads FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can create fleet lead"
  ON public.b2b_fleet_leads FOR INSERT TO anon, authenticated
  WITH CHECK (
    estimated_vehicle_count >= 0
    AND length(coalesce(description, '')) <= 5000
  );

-- =====================================================
-- TABLE: b2b_notes
-- =====================================================
CREATE TABLE public.b2b_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  related_type TEXT NOT NULL,
  related_id UUID NOT NULL,
  note TEXT NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_b2b_notes_related ON public.b2b_notes(related_type, related_id);
CREATE INDEX idx_b2b_notes_company ON public.b2b_notes(company_id);

ALTER TABLE public.b2b_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage b2b notes"
  ON public.b2b_notes FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- TABLE: b2b_actions_history
-- =====================================================
CREATE TABLE public.b2b_actions_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  related_type TEXT NOT NULL,
  related_id UUID NOT NULL,
  metadata JSONB,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_b2b_actions_related ON public.b2b_actions_history(related_type, related_id);
CREATE INDEX idx_b2b_actions_company ON public.b2b_actions_history(company_id);

ALTER TABLE public.b2b_actions_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage b2b actions history"
  ON public.b2b_actions_history FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can insert action"
  ON public.b2b_actions_history FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- =====================================================
-- TRIGGERS updated_at
-- =====================================================
CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_b2b_transport_requests_updated_at
  BEFORE UPDATE ON public.b2b_transport_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_b2b_fleet_leads_updated_at
  BEFORE UPDATE ON public.b2b_fleet_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- FONCTION: Recalcul score entreprise
-- =====================================================
CREATE OR REPLACE FUNCTION public.recalculate_company_score(_company_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_score INTEGER := 0;
  v_paid_count INTEGER;
  v_total_requests INTEGER;
  v_max_lead_score INTEGER;
  v_lead_volume INTEGER;
  v_company_size TEXT;
  v_lead_delay TEXT;
  v_lead_budget TEXT;
  v_category TEXT;
BEGIN
  -- Demandes ponctuelles
  SELECT COUNT(*) FILTER (WHERE payment_status = 'paid'),
         COUNT(*)
  INTO v_paid_count, v_total_requests
  FROM b2b_transport_requests
  WHERE company_id = _company_id;

  IF v_paid_count > 0 THEN v_score := v_score + 20; END IF;
  IF v_total_requests >= 3 THEN v_score := v_score + 40; END IF;

  -- Urgence immédiate récente
  IF EXISTS (
    SELECT 1 FROM b2b_transport_requests
    WHERE company_id = _company_id AND urgency = 'immediat'
    AND created_at > now() - interval '90 days'
  ) THEN
    v_score := v_score + 30;
  END IF;

  -- Lead flotte
  SELECT MAX(estimated_vehicle_count), MAX(start_delay), MAX(budget)
  INTO v_lead_volume, v_lead_delay, v_lead_budget
  FROM b2b_fleet_leads
  WHERE company_id = _company_id;

  IF v_lead_volume > 50 THEN v_score := v_score + 80;
  ELSIF v_lead_volume > 10 THEN v_score := v_score + 50;
  END IF;

  IF v_lead_delay = 'immediat' THEN v_score := v_score + 30; END IF;
  IF v_lead_budget IS NOT NULL AND length(trim(v_lead_budget)) > 0 THEN v_score := v_score + 20; END IF;

  -- Taille entreprise
  SELECT size INTO v_company_size FROM companies WHERE id = _company_id;
  IF v_company_size IN ('51-250', '250+') THEN v_score := v_score + 30; END IF;

  IF v_score > 100 THEN v_score := 100; END IF;

  IF v_score >= 80 THEN v_category := 'hot';
  ELSIF v_score >= 40 THEN v_category := 'warm';
  ELSE v_category := 'cold';
  END IF;

  UPDATE companies
  SET score = v_score, score_category = v_category, updated_at = now()
  WHERE id = _company_id;
END;
$$;

-- Trigger pour recalculer le score sur insert/update de demandes
CREATE OR REPLACE FUNCTION public.trigger_recalc_score()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.company_id IS NOT NULL THEN
    PERFORM public.recalculate_company_score(NEW.company_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER recalc_score_on_transport_request
  AFTER INSERT OR UPDATE ON public.b2b_transport_requests
  FOR EACH ROW EXECUTE FUNCTION public.trigger_recalc_score();

CREATE TRIGGER recalc_score_on_fleet_lead
  AFTER INSERT OR UPDATE ON public.b2b_fleet_leads
  FOR EACH ROW EXECUTE FUNCTION public.trigger_recalc_score();
