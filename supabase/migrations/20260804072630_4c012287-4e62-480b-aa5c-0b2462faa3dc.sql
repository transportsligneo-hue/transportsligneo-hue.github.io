ALTER TABLE public.email_send_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_send_state FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage send state" ON public.email_send_state;

CREATE POLICY "Service role can manage send state"
ON public.email_send_state
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

REVOKE ALL ON public.email_send_state FROM anon, authenticated, PUBLIC;
GRANT ALL ON public.email_send_state TO service_role;