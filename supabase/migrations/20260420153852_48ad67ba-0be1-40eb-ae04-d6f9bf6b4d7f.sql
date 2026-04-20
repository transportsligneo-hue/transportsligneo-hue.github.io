-- ============================================
-- 1) PURGE COMPLÈTE DES DONNÉES UTILISATEURS
-- ============================================
-- Tables métier dépendantes
TRUNCATE TABLE public.mission_locations CASCADE;
TRUNCATE TABLE public.inspection_photos CASCADE;
TRUNCATE TABLE public.inspections CASCADE;
TRUNCATE TABLE public.mission_documents CASCADE;
TRUNCATE TABLE public.attributions CASCADE;
TRUNCATE TABLE public.trajets CASCADE;
TRUNCATE TABLE public.disponibilites_convoyeurs CASCADE;
TRUNCATE TABLE public.documents_convoyeurs CASCADE;
TRUNCATE TABLE public.missions CASCADE;
TRUNCATE TABLE public.devis CASCADE;
TRUNCATE TABLE public.demandes_convoyage CASCADE;
TRUNCATE TABLE public.convoyeurs CASCADE;
TRUNCATE TABLE public.user_roles CASCADE;
TRUNCATE TABLE public.profiles CASCADE;
TRUNCATE TABLE public.email_send_log CASCADE;
TRUNCATE TABLE public.email_unsubscribe_tokens CASCADE;
TRUNCATE TABLE public.suppressed_emails CASCADE;

-- Suppression des comptes auth (cascade vers identités/sessions/refresh tokens)
DELETE FROM auth.users;

-- ============================================
-- 2) AJOUT colonne statut sur profiles
-- ============================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS statut text NOT NULL DEFAULT 'actif';

-- ============================================
-- 3) TRIGGER d'auto-création profil + rôle
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.app_role;
  v_role_text text;
BEGIN
  -- Profil
  INSERT INTO public.profiles (user_id, email, prenom, nom, telephone, statut)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'prenom', ''),
    COALESCE(NEW.raw_user_meta_data->>'nom', ''),
    COALESCE(NEW.raw_user_meta_data->>'telephone', ''),
    'actif'
  )
  ON CONFLICT (user_id) DO NOTHING;

  -- Rôle (depuis metadata, défaut = client)
  v_role_text := COALESCE(NEW.raw_user_meta_data->>'role', 'client');
  IF v_role_text NOT IN ('admin', 'convoyeur', 'client') THEN
    v_role_text := 'client';
  END IF;
  v_role := v_role_text::public.app_role;

  INSERT INTO public.user_roles (user_id, role, actif)
  VALUES (NEW.id, v_role, true)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- Recréer le trigger sur auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 4) Index unicité user_id sur profiles
-- ============================================
CREATE UNIQUE INDEX IF NOT EXISTS profiles_user_id_unique
  ON public.profiles(user_id);

-- ============================================
-- 5) TABLE reviews (avis clients)
-- ============================================
CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  note integer NOT NULL CHECK (note >= 1 AND note <= 5),
  commentaire text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mission_id, client_id)
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Lecture publique (avis affichables sur le site)
DROP POLICY IF EXISTS "Anyone can read reviews" ON public.reviews;
CREATE POLICY "Anyone can read reviews"
  ON public.reviews FOR SELECT
  TO anon, authenticated
  USING (true);

-- Client : créer son avis (uniquement sur ses propres missions terminées)
DROP POLICY IF EXISTS "Clients can create own reviews" ON public.reviews;
CREATE POLICY "Clients can create own reviews"
  ON public.reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = client_id
    AND mission_id IN (SELECT id FROM public.missions WHERE user_id = auth.uid())
  );

-- Client : modifier/supprimer son avis
DROP POLICY IF EXISTS "Clients can update own reviews" ON public.reviews;
CREATE POLICY "Clients can update own reviews"
  ON public.reviews FOR UPDATE
  TO authenticated
  USING (auth.uid() = client_id);

DROP POLICY IF EXISTS "Clients can delete own reviews" ON public.reviews;
CREATE POLICY "Clients can delete own reviews"
  ON public.reviews FOR DELETE
  TO authenticated
  USING (auth.uid() = client_id);

-- Admin : tout
DROP POLICY IF EXISTS "Admins manage all reviews" ON public.reviews;
CREATE POLICY "Admins manage all reviews"
  ON public.reviews FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Trigger updated_at
DROP TRIGGER IF EXISTS update_reviews_updated_at ON public.reviews;
CREATE TRIGGER update_reviews_updated_at
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS reviews_mission_idx ON public.reviews(mission_id);
CREATE INDEX IF NOT EXISTS reviews_client_idx ON public.reviews(client_id);