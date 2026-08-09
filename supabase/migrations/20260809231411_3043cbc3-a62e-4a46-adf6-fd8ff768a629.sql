ALTER TABLE public.mission_review_requests
  ADD COLUMN IF NOT EXISTS recipient_phone text;

ALTER TABLE public.mission_review_requests
  ALTER COLUMN recipient_email DROP NOT NULL;

ALTER TABLE public.mission_review_requests
  DROP CONSTRAINT IF EXISTS mission_review_requests_attribution_id_recipient_type_key;

ALTER TABLE public.mission_review_requests
  ALTER COLUMN channel SET DEFAULT 'email';

UPDATE public.mission_review_requests SET channel = 'email' WHERE channel IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS mission_review_requests_unique_channel
  ON public.mission_review_requests (attribution_id, recipient_type, channel);

CREATE TABLE IF NOT EXISTS public.short_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  target_url text NOT NULL,
  purpose text,
  hits integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.short_links TO authenticated;
GRANT ALL ON public.short_links TO service_role;

ALTER TABLE public.short_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "short_links_admin_all" ON public.short_links;
CREATE POLICY "short_links_admin_all" ON public.short_links
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));