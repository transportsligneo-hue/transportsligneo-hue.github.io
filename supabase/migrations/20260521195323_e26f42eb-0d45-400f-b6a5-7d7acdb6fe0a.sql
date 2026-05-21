
-- Address types + extra columns for client_default_addresses
ALTER TABLE public.client_default_addresses
  ADD COLUMN IF NOT EXISTS address_type text NOT NULL DEFAULT 'depart',
  ADD COLUMN IF NOT EXISTS ville text,
  ADD COLUMN IF NOT EXISTS code_postal text,
  ADD COLUMN IF NOT EXISTS pays text DEFAULT 'France',
  ADD COLUMN IF NOT EXISTS contact_email text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'client_default_addresses_address_type_check'
  ) THEN
    ALTER TABLE public.client_default_addresses
      ADD CONSTRAINT client_default_addresses_address_type_check
      CHECK (address_type IN ('depart','arrivee','both'));
  END IF;
END$$;

-- Allow Partner clients to manage their own addresses
DROP POLICY IF EXISTS "Clients insert own default addresses" ON public.client_default_addresses;
CREATE POLICY "Clients insert own default addresses"
  ON public.client_default_addresses FOR INSERT TO authenticated
  WITH CHECK (
    client_user_id = auth.uid()
    OR lower(client_email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
  );

DROP POLICY IF EXISTS "Clients update own default addresses" ON public.client_default_addresses;
CREATE POLICY "Clients update own default addresses"
  ON public.client_default_addresses FOR UPDATE TO authenticated
  USING (
    client_user_id = auth.uid()
    OR lower(client_email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
  )
  WITH CHECK (
    client_user_id = auth.uid()
    OR lower(client_email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
  );

DROP POLICY IF EXISTS "Clients delete own default addresses" ON public.client_default_addresses;
CREATE POLICY "Clients delete own default addresses"
  ON public.client_default_addresses FOR DELETE TO authenticated
  USING (
    client_user_id = auth.uid()
    OR lower(client_email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
  );

-- Optional priority on pricing rules
ALTER TABLE public.client_pricing_rules
  ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 0;
