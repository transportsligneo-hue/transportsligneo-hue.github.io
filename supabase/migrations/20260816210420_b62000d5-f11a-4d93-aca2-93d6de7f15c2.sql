ALTER TABLE public.newsletter_abonnes DROP CONSTRAINT IF EXISTS newsletter_abonnes_email_valid;
ALTER TABLE public.newsletter_abonnes
  ADD CONSTRAINT newsletter_abonnes_email_valid
  CHECK (
    email IS NOT NULL
    AND length(email) BETWEEN 5 AND 254
    AND email ~ '^[A-Za-z0-9._+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  ) NOT VALID;

DROP POLICY IF EXISTS "newsletter_public_insert" ON public.newsletter_abonnes;
CREATE POLICY "newsletter_public_insert"
ON public.newsletter_abonnes FOR INSERT TO anon, authenticated
WITH CHECK (
  email IS NOT NULL
  AND length(email) BETWEEN 5 AND 254
  AND email ~ '^[A-Za-z0-9._+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  AND (source IS NULL OR length(source) <= 60)
  AND unsubscribed_at IS NULL
);