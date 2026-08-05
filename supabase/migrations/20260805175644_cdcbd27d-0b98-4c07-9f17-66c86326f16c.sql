CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.api_internal_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.api_internal_config TO service_role;
ALTER TABLE public.api_internal_config ENABLE ROW LEVEL SECURITY;

INSERT INTO public.api_internal_config (key, value)
VALUES
  ('event_secret', encode(gen_random_bytes(32), 'hex')),
  ('event_url', 'https://transportsligneo.lovable.app/api/public/v1/internal/mission-event')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.api_emit_event(_event text, _mission_id uuid, _payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_secret text;
  v_url text;
BEGIN
  SELECT value INTO v_secret FROM public.api_internal_config WHERE key = 'event_secret';
  SELECT value INTO v_url FROM public.api_internal_config WHERE key = 'event_url';
  IF v_secret IS NULL OR v_url IS NULL THEN RETURN; END IF;

  PERFORM extensions.net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-ligneo-internal', v_secret),
    body := jsonb_build_object('event', _event, 'mission_id', _mission_id, 'payload', _payload)
  );
EXCEPTION WHEN OTHERS THEN
  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.api_emit_event(text, uuid, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.api_missions_event_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event text;
BEGIN
  IF NEW.organization_id IS NULL OR NEW.statut IS NOT DISTINCT FROM OLD.statut THEN
    RETURN NEW;
  END IF;

  v_event := CASE NEW.statut
    WHEN 'attribue' THEN 'mission.assigned'
    WHEN 'accepte' THEN 'mission.assigned'
    WHEN 'en_cours' THEN 'mission.started'
    WHEN 'termine' THEN 'mission.delivered'
    WHEN 'validee' THEN 'mission.delivered'
    WHEN 'annule' THEN 'mission.cancelled'
    ELSE NULL
  END;

  IF v_event IS NULL THEN RETURN NEW; END IF;

  PERFORM public.api_emit_event(
    v_event,
    NEW.id,
    jsonb_build_object('reference', NEW.numero, 'organization_id', NEW.organization_id)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_api_missions_event ON public.missions;
CREATE TRIGGER trg_api_missions_event
AFTER UPDATE ON public.missions
FOR EACH ROW EXECUTE FUNCTION public.api_missions_event_trigger();

CREATE OR REPLACE FUNCTION public.api_factures_event_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.mission_id IS NULL THEN RETURN NEW; END IF;
  PERFORM public.api_emit_event(
    'invoice.available',
    NEW.mission_id,
    jsonb_build_object('invoice_id', NEW.id, 'number', NEW.numero, 'amount_ttc', NEW.prix_ttc)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_api_factures_event ON public.factures;
CREATE TRIGGER trg_api_factures_event
AFTER INSERT ON public.factures
FOR EACH ROW EXECUTE FUNCTION public.api_factures_event_trigger();