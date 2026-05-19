-- 1) Colonnes supplémentaires sur profiles (facturation B2B)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tva_intra text,
  ADD COLUMN IF NOT EXISTS adresse_facturation text;

-- 2) Permettre aux admins de modifier les profils (édition fiche client)
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
CREATE POLICY "Admins can update profiles"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));

-- 3) Permettre aux clients de voir leurs missions liées par email (en plus de user_id)
DROP POLICY IF EXISTS "Clients read missions by email" ON public.missions;
CREATE POLICY "Clients read missions by email"
  ON public.missions
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR lower(email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))
  );

-- 4) Fonction de backfill : rattache toutes les lignes "orphelines"
--    (devis/demandes/missions avec même email) au nouvel user_id.
CREATE OR REPLACE FUNCTION public.backfill_user_links()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NULL OR length(trim(NEW.email)) = 0 THEN
    RETURN NEW;
  END IF;

  UPDATE public.devis
     SET user_id = NEW.id, updated_at = now()
   WHERE user_id IS NULL
     AND lower(email) = lower(NEW.email);

  UPDATE public.demandes_convoyage
     SET user_id = NEW.id, updated_at = now()
   WHERE user_id IS NULL
     AND lower(email) = lower(NEW.email);

  -- missions.user_id est NOT NULL aujourd'hui — no-op safe
  UPDATE public.missions
     SET user_id = NEW.id, updated_at = now()
   WHERE user_id IS NULL
     AND lower(email) = lower(NEW.email);

  RETURN NEW;
END;
$$;

-- 5) Trigger sur auth.users : à la création + au changement d'email
DROP TRIGGER IF EXISTS trg_backfill_user_links_insert ON auth.users;
CREATE TRIGGER trg_backfill_user_links_insert
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.backfill_user_links();

DROP TRIGGER IF EXISTS trg_backfill_user_links_update ON auth.users;
CREATE TRIGGER trg_backfill_user_links_update
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION public.backfill_user_links();

-- 6) Backfill rétroactif unique pour les comptes existants
UPDATE public.devis d
   SET user_id = u.id, updated_at = now()
  FROM auth.users u
 WHERE d.user_id IS NULL
   AND lower(d.email) = lower(u.email);

UPDATE public.demandes_convoyage dc
   SET user_id = u.id, updated_at = now()
  FROM auth.users u
 WHERE dc.user_id IS NULL
   AND lower(dc.email) = lower(u.email);