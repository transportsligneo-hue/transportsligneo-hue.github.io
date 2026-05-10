
-- 1) Reviews — drop public SELECT, scope to author/admin/assigned convoyeur
DROP POLICY IF EXISTS "Anyone can read reviews" ON public.reviews;

CREATE POLICY "Clients read own reviews" ON public.reviews
  FOR SELECT TO authenticated
  USING (auth.uid() = client_id);

CREATE POLICY "Convoyeurs read reviews of their missions" ON public.reviews
  FOR SELECT TO authenticated
  USING (
    mission_id IN (
      SELECT a.id
      FROM public.attributions a
      JOIN public.convoyeurs c ON c.id = a.convoyeur_id
      WHERE c.user_id = auth.uid()
    )
  );

-- 2) Realtime — restrict broadcast/presence channels to admins only.
-- The app uses postgres_changes subscriptions which flow through the public
-- supabase_realtime publication and per-table RLS, NOT realtime.messages.
DROP POLICY IF EXISTS "Authenticated users only" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated users can send" ON realtime.messages;

CREATE POLICY "Admins can read realtime broadcast"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can send realtime broadcast"
  ON realtime.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 3) Storage inspection-photos — drop weak duplicates that didn't verify
-- attribution ownership. Strict policies (SELECT/UPDATE/DELETE that join
-- inspections + attributions + convoyeurs) remain in place.
DROP POLICY IF EXISTS "Convoyeurs can update own inspection photos" ON storage.objects;
DROP POLICY IF EXISTS "Convoyeurs can view own inspection photos" ON storage.objects;

-- 4) Move admin-only trajet fields to a private companion table
CREATE TABLE IF NOT EXISTS public.trajets_admin_data (
  trajet_id uuid PRIMARY KEY REFERENCES public.trajets(id) ON DELETE CASCADE,
  notes_internes text,
  marge_indicative_pct numeric DEFAULT 35,
  prix_client_ttc numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trajets_admin_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage trajets admin data"
  ON public.trajets_admin_data
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER trajets_admin_data_set_updated_at
  BEFORE UPDATE ON public.trajets_admin_data
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Migrate any existing data
INSERT INTO public.trajets_admin_data (trajet_id, notes_internes, marge_indicative_pct, prix_client_ttc)
SELECT id, notes_internes, marge_indicative_pct, prix_client_ttc
FROM public.trajets
WHERE notes_internes IS NOT NULL
   OR marge_indicative_pct IS NOT NULL
   OR prix_client_ttc IS NOT NULL
ON CONFLICT (trajet_id) DO NOTHING;

-- Drop the now-private columns from the public table.
-- The trajets_publies_safe view referenced these (excluded already), so we
-- recreate it without them to keep the view valid.
DROP VIEW IF EXISTS public.trajets_publies_safe;

ALTER TABLE public.trajets
  DROP COLUMN IF EXISTS notes_internes,
  DROP COLUMN IF EXISTS marge_indicative_pct,
  DROP COLUMN IF EXISTS prix_client_ttc;

CREATE VIEW public.trajets_publies_safe
WITH (security_invoker = true) AS
SELECT
  id,
  depart,
  arrivee,
  date_trajet,
  heure_trajet,
  marque,
  modele,
  prix_suggere,
  statut_publication,
  created_at,
  pricing_mode,
  prix_convoyeur_fixe,
  prix_convoyeur_min,
  prix_convoyeur_max
FROM public.trajets
WHERE statut_publication = 'publie';

GRANT SELECT ON public.trajets_publies_safe TO authenticated;
