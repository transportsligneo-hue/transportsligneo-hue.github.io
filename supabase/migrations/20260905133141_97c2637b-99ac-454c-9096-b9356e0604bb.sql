ALTER TABLE public.signature_handoff_sessions ADD COLUMN IF NOT EXISTS short_code text;
CREATE UNIQUE INDEX IF NOT EXISTS signature_handoff_sessions_short_code_key
  ON public.signature_handoff_sessions (short_code) WHERE short_code IS NOT NULL;