-- 1. Niveau requis sur les missions publiées
ALTER TABLE public.trajets ADD COLUMN IF NOT EXISTS niveau_requis text NOT NULL DEFAULT 'debutant';
DO $$ BEGIN
  ALTER TABLE public.trajets ADD CONSTRAINT trajets_niveau_requis_chk
    CHECK (niveau_requis IN ('debutant','confirme','expert')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Progression convoyeur
ALTER TABLE public.convoyeurs
  ADD COLUMN IF NOT EXISTS niveau text NOT NULL DEFAULT 'debutant',
  ADD COLUMN IF NOT EXISTS missions_terminees integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS note_moyenne numeric(3,2);
DO $$ BEGIN
  ALTER TABLE public.convoyeurs ADD CONSTRAINT convoyeurs_niveau_chk
    CHECK (niveau IN ('debutant','confirme','expert')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Rang numérique d'un niveau
CREATE OR REPLACE FUNCTION public.convoyeur_level_rank(_n text)
RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE lower(coalesce(_n,'debutant'))
    WHEN 'expert' THEN 3 WHEN 'confirme' THEN 2 ELSE 1 END;
$$;

-- 4. Recalcul du niveau
CREATE OR REPLACE FUNCTION public.recompute_convoyeur_niveau(_convoyeur_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_done int := 0;
  v_cancel int := 0;
  v_note numeric;
  v_niveau text := 'debutant';
BEGIN
  IF _convoyeur_id IS NULL THEN RETURN; END IF;

  SELECT count(*) FILTER (WHERE a.statut IN ('termine','terminee','validee','livree')),
         count(*) FILTER (WHERE a.statut IN ('annule','refuse'))
    INTO v_done, v_cancel
  FROM public.attributions a
  WHERE a.convoyeur_id = _convoyeur_id;

  SELECT avg(r.note) INTO v_note
  FROM public.attributions a
  JOIN public.trajets t ON t.id = a.trajet_id
  JOIN public.reviews r ON r.mission_id = t.mission_id
  WHERE a.convoyeur_id = _convoyeur_id;

  IF v_done >= 50 AND coalesce(v_note, 5) >= 4.7 AND v_cancel = 0 THEN
    v_niveau := 'expert';
  ELSIF v_done >= 15 AND coalesce(v_note, 5) >= 4.0 THEN
    v_niveau := 'confirme';
  END IF;

  UPDATE public.convoyeurs
     SET missions_terminees = v_done,
         note_moyenne = round(v_note, 2),
         niveau = v_niveau,
         updated_at = now()
   WHERE id = _convoyeur_id;
END;
$$;

-- 5. Triggers de recalcul
CREATE OR REPLACE FUNCTION public.tg_recompute_convoyeur_niveau()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM public.recompute_convoyeur_niveau(COALESCE(NEW.convoyeur_id, OLD.convoyeur_id));
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS attributions_recompute_niveau ON public.attributions;
CREATE TRIGGER attributions_recompute_niveau
AFTER INSERT OR UPDATE OF statut OR DELETE ON public.attributions
FOR EACH ROW EXECUTE FUNCTION public.tg_recompute_convoyeur_niveau();

CREATE OR REPLACE FUNCTION public.tg_reviews_recompute_niveau()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_conv uuid;
BEGIN
  SELECT a.convoyeur_id INTO v_conv
  FROM public.attributions a
  JOIN public.trajets t ON t.id = a.trajet_id
  WHERE t.mission_id = COALESCE(NEW.mission_id, OLD.mission_id)
  LIMIT 1;
  PERFORM public.recompute_convoyeur_niveau(v_conv);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS reviews_recompute_niveau ON public.reviews;
CREATE TRIGGER reviews_recompute_niveau
AFTER INSERT OR UPDATE OR DELETE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.tg_reviews_recompute_niveau();

-- 6. Empêcher l'auto-promotion
CREATE OR REPLACE FUNCTION public.convoyeurs_protect_privileged_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin')
     OR auth.role() = 'service_role'
     OR public.has_role(auth.uid(), 'admin'::public.app_role)
     OR public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RETURN NEW;
  END IF;
  NEW.statut                 := OLD.statut;
  NEW.account_status         := OLD.account_status;
  NEW.type_convoyeur         := OLD.type_convoyeur;
  NEW.user_id                := OLD.user_id;
  NEW.email                  := OLD.email;
  NEW.training_status        := OLD.training_status;
  NEW.has_completed_training := OLD.has_completed_training;
  NEW.training_completed_at  := OLD.training_completed_at;
  NEW.organization_id        := OLD.organization_id;
  NEW.niveau                 := OLD.niveau;
  NEW.missions_terminees     := OLD.missions_terminees;
  NEW.note_moyenne           := OLD.note_moyenne;
  RETURN NEW;
END;
$$;

-- 7. Exposer niveau requis + énergie véhicule au catalogue
DROP VIEW IF EXISTS public.trajets_publies_safe;
DROP FUNCTION IF EXISTS public._trajets_publies_safe_rows();

CREATE FUNCTION public._trajets_publies_safe_rows()
RETURNS TABLE(id uuid, depart text, arrivee text, date_trajet date, heure_trajet text,
  marque text, modele text, prix_suggere numeric, prix_convoyeur numeric,
  prix_convoyeur_fixe numeric, prix_convoyeur_min numeric, prix_convoyeur_max numeric,
  pricing_mode text, attribution_mode text, allow_counter_offer boolean,
  proposal_expires_at timestamptz, statut_publication text, published_at timestamptz,
  created_at timestamptz, mission_group_id uuid, leg_type text, bidding_enabled boolean,
  is_test_data boolean, niveau_requis text, vehicule_energie text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT
    t.id, t.depart, t.arrivee, t.date_trajet, t.heure_trajet,
    t.marque, t.modele, t.prix_suggere, t.prix_convoyeur,
    t.prix_convoyeur_fixe, t.prix_convoyeur_min, t.prix_convoyeur_max,
    t.pricing_mode, t.attribution_mode, t.allow_counter_offer,
    t.proposal_expires_at, t.statut_publication, t.published_at,
    t.created_at, t.mission_group_id, t.leg_type,
    COALESCE(t.bidding_enabled, false),
    COALESCE(t.is_test_data, false),
    COALESCE(t.niveau_requis, 'debutant'),
    t.vehicule_energie
  FROM public.trajets t
  WHERE t.statut_publication = 'publie'
    AND t.attribution_mode IN ('catalogue', 'mixte')
    AND (t.proposal_expires_at IS NULL OR t.proposal_expires_at > now())
    AND public.is_validated_convoyeur(auth.uid());
$$;

CREATE VIEW public.trajets_publies_safe
WITH (security_invoker = true) AS
SELECT * FROM public._trajets_publies_safe_rows();

GRANT SELECT ON public.trajets_publies_safe TO authenticated;
GRANT EXECUTE ON FUNCTION public._trajets_publies_safe_rows() TO authenticated;
GRANT EXECUTE ON FUNCTION public.convoyeur_level_rank(text) TO authenticated;
