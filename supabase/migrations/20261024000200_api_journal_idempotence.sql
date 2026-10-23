-- API Développeur : journal des requêtes + clés de non-doublon (Idempotency-Key)
-- Accès uniquement par le serveur (service role) : RLS activée, aucune policy publique.

CREATE TABLE IF NOT EXISTS public.api_request_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id uuid REFERENCES public.api_keys(id) ON DELETE SET NULL,
  organization_id uuid NOT NULL,
  environment text NOT NULL DEFAULT 'live',
  method text NOT NULL,
  path text NOT NULL,
  status_code integer NOT NULL,
  duration_ms integer,
  request_id text,
  idempotency_key text,
  error_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.api_request_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS api_request_logs_org_created_idx
  ON public.api_request_logs (organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.api_idempotency_keys (
  organization_id uuid NOT NULL,
  idem_key text NOT NULL,
  request_hash text NOT NULL,
  status_code integer,
  response_body jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, idem_key)
);
ALTER TABLE public.api_idempotency_keys ENABLE ROW LEVEL SECURITY;

-- Nettoyage : journal gardé 90 jours, clés de non-doublon 24 h
CREATE OR REPLACE FUNCTION public.api_housekeeping() RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.api_request_logs WHERE created_at < now() - interval '90 days';
  DELETE FROM public.api_idempotency_keys WHERE created_at < now() - interval '24 hours';
$$;
REVOKE ALL ON FUNCTION public.api_housekeeping() FROM PUBLIC, anon, authenticated;
