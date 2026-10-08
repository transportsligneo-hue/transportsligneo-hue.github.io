CREATE TABLE public.admin_mfa_phones (
  user_id uuid PRIMARY KEY,
  phone text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.admin_mfa_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_id text NOT NULL,
  code_hash text NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_mfa_challenges_user_idx ON public.admin_mfa_challenges(user_id, created_at DESC);
CREATE TABLE public.admin_mfa_sessions (
  user_id uuid NOT NULL,
  session_id text NOT NULL,
  verified_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (user_id, session_id)
);
GRANT ALL ON public.admin_mfa_phones, public.admin_mfa_challenges, public.admin_mfa_sessions TO service_role;
ALTER TABLE public.admin_mfa_phones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_mfa_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_mfa_sessions ENABLE ROW LEVEL SECURITY;