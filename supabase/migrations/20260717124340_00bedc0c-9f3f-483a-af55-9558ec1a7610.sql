
-- ============================================================================
-- AI Settings (singleton) + Usage Events
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ai_settings (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_enabled                  boolean NOT NULL DEFAULT true,
  assistance_level            text    NOT NULL DEFAULT 'standard' CHECK (assistance_level IN ('minimal','standard','avance')),
  -- Capacités individuelles
  ocr_documents               boolean NOT NULL DEFAULT true,
  ocr_odometer                boolean NOT NULL DEFAULT true,
  detect_fuel_level           boolean NOT NULL DEFAULT true,
  detect_battery_level        boolean NOT NULL DEFAULT true,
  detect_warning_lights       boolean NOT NULL DEFAULT true,
  detect_scratches            boolean NOT NULL DEFAULT true,
  detect_dents                boolean NOT NULL DEFAULT true,
  detect_impacts              boolean NOT NULL DEFAULT true,
  detect_rims                 boolean NOT NULL DEFAULT true,
  detect_windshield           boolean NOT NULL DEFAULT true,
  detect_mirrors              boolean NOT NULL DEFAULT true,
  detect_lights               boolean NOT NULL DEFAULT true,
  detect_equipment            boolean NOT NULL DEFAULT true,
  compare_departure_arrival   boolean NOT NULL DEFAULT true,
  auto_report                 boolean NOT NULL DEFAULT true,
  mission_prefill             boolean NOT NULL DEFAULT true,
  smart_suggestions           boolean NOT NULL DEFAULT true,
  photo_assistant             boolean NOT NULL DEFAULT true,
  -- Mapping capacité -> modèle (édition libre en admin)
  model_overrides             jsonb   NOT NULL DEFAULT '{}'::jsonb,
  is_singleton                boolean NOT NULL DEFAULT true UNIQUE,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ai_settings TO authenticated;
GRANT ALL    ON public.ai_settings TO service_role;

ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read ai_settings"
  ON public.ai_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage ai_settings"
  ON public.ai_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_ai_settings_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_ai_settings_updated_at ON public.ai_settings;
CREATE TRIGGER trg_ai_settings_updated_at
  BEFORE UPDATE ON public.ai_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_ai_settings_updated_at();

-- Seed singleton
INSERT INTO public.ai_settings (is_singleton)
SELECT true
WHERE NOT EXISTS (SELECT 1 FROM public.ai_settings);

-- RPC lecture publique (authentifiés)
CREATE OR REPLACE FUNCTION public.get_ai_settings()
RETURNS public.ai_settings
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM public.ai_settings ORDER BY created_at ASC LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_ai_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_ai_settings() TO authenticated;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_settings;

-- ============================================================================
-- ai_usage_events (append-only)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ai_usage_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  capability   text NOT NULL,
  model_id     text,
  latency_ms   integer,
  success      boolean NOT NULL,
  cost_credits numeric(10,4),
  error_code   text,
  metadata     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_events_created_at ON public.ai_usage_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_events_capability ON public.ai_usage_events (capability, created_at DESC);

GRANT SELECT ON public.ai_usage_events TO authenticated; -- filtré par RLS
GRANT ALL    ON public.ai_usage_events TO service_role;

ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read ai_usage_events"
  ON public.ai_usage_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

-- Aucun INSERT/UPDATE/DELETE côté client : les server fns utilisent service_role.
