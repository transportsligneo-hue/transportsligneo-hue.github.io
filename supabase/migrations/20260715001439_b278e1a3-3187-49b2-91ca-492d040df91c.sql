CREATE TABLE IF NOT EXISTS public.formation_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  content_type text NOT NULL DEFAULT 'text' CHECK (content_type IN ('text','video','quiz')),
  content_url text,
  content_body text,
  quiz_questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  minimum_score integer NOT NULL DEFAULT 80 CHECK (minimum_score BETWEEN 0 AND 100),
  estimated_minutes integer NOT NULL DEFAULT 10 CHECK (estimated_minutes > 0),
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.formation_modules TO authenticated;
GRANT ALL ON public.formation_modules TO service_role;
ALTER TABLE public.formation_modules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Formation modules readable by authenticated drivers" ON public.formation_modules;
CREATE POLICY "Formation modules readable by authenticated drivers"
ON public.formation_modules
FOR SELECT
TO authenticated
USING (is_active = true OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
DROP POLICY IF EXISTS "Admins manage formation modules" ON public.formation_modules;
CREATE POLICY "Admins manage formation modules"
ON public.formation_modules
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE TABLE IF NOT EXISTS public.formation_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  convoyeur_id uuid NOT NULL REFERENCES public.convoyeurs(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES public.formation_modules(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','in_progress','completed')),
  score integer CHECK (score BETWEEN 0 AND 100),
  completed_at timestamptz,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (convoyeur_id, module_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.formation_progress TO authenticated;
GRANT ALL ON public.formation_progress TO service_role;
ALTER TABLE public.formation_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Convoyeurs read own formation progress" ON public.formation_progress;
CREATE POLICY "Convoyeurs read own formation progress"
ON public.formation_progress
FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.convoyeurs c WHERE c.id = convoyeur_id AND c.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'super_admin')
);
DROP POLICY IF EXISTS "Convoyeurs write own formation progress" ON public.formation_progress;
CREATE POLICY "Convoyeurs write own formation progress"
ON public.formation_progress
FOR INSERT
TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.convoyeurs c WHERE c.id = convoyeur_id AND c.user_id = auth.uid()));
DROP POLICY IF EXISTS "Convoyeurs update own formation progress" ON public.formation_progress;
CREATE POLICY "Convoyeurs update own formation progress"
ON public.formation_progress
FOR UPDATE
TO authenticated
USING (EXISTS (SELECT 1 FROM public.convoyeurs c WHERE c.id = convoyeur_id AND c.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.convoyeurs c WHERE c.id = convoyeur_id AND c.user_id = auth.uid()));
DROP POLICY IF EXISTS "Admins manage formation progress" ON public.formation_progress;
CREATE POLICY "Admins manage formation progress"
ON public.formation_progress
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE TABLE IF NOT EXISTS public.formation_quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  convoyeur_id uuid NOT NULL REFERENCES public.convoyeurs(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES public.formation_modules(id) ON DELETE CASCADE,
  score integer NOT NULL CHECK (score BETWEEN 0 AND 100),
  passed boolean NOT NULL DEFAULT false,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.formation_quiz_attempts TO authenticated;
GRANT ALL ON public.formation_quiz_attempts TO service_role;
ALTER TABLE public.formation_quiz_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Convoyeurs read own quiz attempts" ON public.formation_quiz_attempts;
CREATE POLICY "Convoyeurs read own quiz attempts"
ON public.formation_quiz_attempts
FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.convoyeurs c WHERE c.id = convoyeur_id AND c.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'super_admin')
);
DROP POLICY IF EXISTS "Convoyeurs create own quiz attempts" ON public.formation_quiz_attempts;
CREATE POLICY "Convoyeurs create own quiz attempts"
ON public.formation_quiz_attempts
FOR INSERT
TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.convoyeurs c WHERE c.id = convoyeur_id AND c.user_id = auth.uid()));
DROP POLICY IF EXISTS "Admins manage quiz attempts" ON public.formation_quiz_attempts;
CREATE POLICY "Admins manage quiz attempts"
ON public.formation_quiz_attempts
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

ALTER TABLE public.convoyeurs
  ADD COLUMN IF NOT EXISTS training_status text NOT NULL DEFAULT 'not_started' CHECK (training_status IN ('not_started','in_progress','completed')),
  ADD COLUMN IF NOT EXISTS has_completed_training boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS training_completed_at timestamptz;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_formation_modules_updated_at ON public.formation_modules;
CREATE TRIGGER update_formation_modules_updated_at
BEFORE UPDATE ON public.formation_modules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_formation_progress_updated_at ON public.formation_progress;
CREATE TRIGGER update_formation_progress_updated_at
BEFORE UPDATE ON public.formation_progress
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.refresh_convoyeur_training_status(_convoyeur_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  total_active integer;
  total_completed integer;
BEGIN
  SELECT count(*) INTO total_active FROM public.formation_modules WHERE is_active = true;
  SELECT count(*) INTO total_completed
  FROM public.formation_progress fp
  JOIN public.formation_modules fm ON fm.id = fp.module_id
  WHERE fp.convoyeur_id = _convoyeur_id
    AND fm.is_active = true
    AND fp.status = 'completed';

  UPDATE public.convoyeurs
  SET training_status = CASE
      WHEN total_active > 0 AND total_completed >= total_active THEN 'completed'
      WHEN total_completed > 0 THEN 'in_progress'
      ELSE 'not_started'
    END,
    has_completed_training = (total_active > 0 AND total_completed >= total_active),
    training_completed_at = CASE
      WHEN total_active > 0 AND total_completed >= total_active THEN COALESCE(training_completed_at, now())
      ELSE NULL
    END
  WHERE id = _convoyeur_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.has_completed_driver_training(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.convoyeurs c
    WHERE c.user_id = _user_id
      AND c.statut IN ('valide','actif')
      AND c.has_completed_training = true
  )
$$;

CREATE OR REPLACE FUNCTION public.update_training_status_after_progress()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.refresh_convoyeur_training_status(NEW.convoyeur_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS refresh_training_status_on_progress ON public.formation_progress;
CREATE TRIGGER refresh_training_status_on_progress
AFTER INSERT OR UPDATE ON public.formation_progress
FOR EACH ROW EXECUTE FUNCTION public.update_training_status_after_progress();

INSERT INTO public.formation_modules (slug, title, description, content_type, content_body, quiz_questions, minimum_score, estimated_minutes, sort_order, is_active)
VALUES
('securite-prise-en-charge', 'Sécurité prise en charge', 'Contrôles obligatoires avant départ, photo-preuves et posture professionnelle.', 'quiz', 'Vérifier identité du contact, état visuel, carburant/charge, kilométrage, documents véhicule et consignes client avant tout déplacement.', '[{"question":"Avant de démarrer, quel élément est obligatoire ?","choices":["Inspection et photos","Appeler uniquement le client","Renseigner seulement le kilométrage"],"answer":0},{"question":"En cas de dommage visible au départ, que faut-il faire ?","choices":["Continuer sans preuve","Photographier et signaler immédiatement","Attendre la livraison"],"answer":1}]'::jsonb, 80, 12, 10, true),
('edl-signatures', 'État des lieux & signatures', 'Méthode d’inspection numérique, signatures et validation finale.', 'quiz', 'Chaque mission doit produire des preuves claires : photos, état des lieux au départ et à l’arrivée, signatures et transmission pour validation administrative.', '[{"question":"Quand l’état des lieux d’arrivée doit-il être fait ?","choices":["Après livraison, avant clôture mission","Le lendemain","Uniquement si le client le demande"],"answer":0},{"question":"Une signature manquante doit être :","choices":["Ignorée","Signalée avant clôture","Remplacée par une note libre"],"answer":1}]'::jsonb, 80, 10, 20, true),
('relation-client-premium', 'Relation client premium', 'Ponctualité, communication et standards Transports Ligneo.', 'quiz', 'Le convoyeur représente la marque : ponctualité, tenue, communication claire, discrétion et respect strict des consignes sont obligatoires.', '[{"question":"En cas de retard prévisible, il faut :","choices":["Prévenir immédiatement","Attendre que le client appelle","Ne rien faire si le retard est court"],"answer":0},{"question":"Les consignes client sont :","choices":["Optionnelles","Prioritaires sauf risque sécurité","À suivre seulement si elles sont écrites"],"answer":1}]'::jsonb, 80, 8, 30, true)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  content_type = EXCLUDED.content_type,
  content_body = EXCLUDED.content_body,
  quiz_questions = EXCLUDED.quiz_questions,
  minimum_score = EXCLUDED.minimum_score,
  estimated_minutes = EXCLUDED.estimated_minutes,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;

CREATE OR REPLACE FUNCTION public.accept_mission_fixe(_trajet_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_convoyeur_id uuid;
  v_trajet RECORD;
  v_attribution_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT id INTO v_convoyeur_id
  FROM public.convoyeurs
  WHERE user_id = auth.uid()
    AND statut = 'valide'
    AND has_completed_training = true
  LIMIT 1;

  IF v_convoyeur_id IS NULL THEN
    RAISE EXCEPTION 'Formation obligatoire non terminée ou convoyeur non validé';
  END IF;

  SELECT * INTO v_trajet
  FROM public.trajets
  WHERE id = _trajet_id
  FOR UPDATE;

  IF v_trajet.id IS NULL THEN
    RAISE EXCEPTION 'Trajet introuvable';
  END IF;

  IF v_trajet.pricing_mode <> 'fixe' THEN
    RAISE EXCEPTION 'Ce trajet est en enchère';
  END IF;

  IF v_trajet.statut_publication <> 'publie' THEN
    RAISE EXCEPTION 'Trajet non disponible';
  END IF;

  INSERT INTO public.attributions (trajet_id, convoyeur_id, statut)
  VALUES (_trajet_id, v_convoyeur_id, 'accepte')
  RETURNING id INTO v_attribution_id;

  UPDATE public.trajets
  SET statut_publication = 'attribue', statut = 'attribue'
  WHERE id = _trajet_id;

  RETURN v_attribution_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.driver_apply_to_mission(_trajet_id uuid, _proposed_price numeric DEFAULT NULL::numeric, _message text DEFAULT NULL::text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_conv_id uuid;
  v_trajet RECORD;
  v_type text;
  v_final_price numeric;
  v_offre_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  SELECT id INTO v_conv_id
  FROM public.convoyeurs
  WHERE user_id = v_uid
    AND statut = 'valide'
    AND has_completed_training = true;
  IF v_conv_id IS NULL THEN RAISE EXCEPTION 'Formation obligatoire non terminée ou convoyeur non validé'; END IF;

  SELECT * INTO v_trajet FROM public.trajets WHERE id = _trajet_id;
  IF v_trajet.id IS NULL THEN RAISE EXCEPTION 'Trajet introuvable'; END IF;
  IF v_trajet.statut_publication <> 'publie' OR v_trajet.attribution_mode NOT IN ('catalogue','mixte') THEN
    RAISE EXCEPTION 'Mission indisponible au catalogue';
  END IF;

  v_final_price := COALESCE(_proposed_price, v_trajet.prix_convoyeur_fixe, v_trajet.prix_convoyeur, v_trajet.prix_suggere, 0);

  IF _proposed_price IS NOT NULL AND _proposed_price <> COALESCE(v_trajet.prix_convoyeur_fixe, v_trajet.prix_convoyeur, v_trajet.prix_suggere, 0) THEN
    IF NOT v_trajet.allow_counter_offer THEN
      RAISE EXCEPTION 'Les contre-offres ne sont pas autorisées sur cette mission';
    END IF;
    v_type := 'contre_proposition';
  ELSE
    v_type := 'acceptation';
  END IF;

  INSERT INTO public.mission_offres (
    trajet_id, convoyeur_id, prix_propose, prix_suggere_snapshot,
    type_offre, statut, message
  ) VALUES (
    _trajet_id, v_conv_id, v_final_price,
    COALESCE(v_trajet.prix_convoyeur_fixe, v_trajet.prix_convoyeur, v_trajet.prix_suggere),
    v_type, 'en_attente', NULLIF(trim(COALESCE(_message,'')),'')
  ) RETURNING id INTO v_offre_id;

  PERFORM public.create_admin_notification(
    CASE WHEN v_type='contre_proposition' THEN 'mission_offre' ELSE 'mission_offre' END,
    CASE WHEN v_type='contre_proposition' THEN 'Contre-offre reçue' ELSE 'Nouvelle candidature reçue' END,
    COALESCE(v_trajet.depart,'') || ' → ' || COALESCE(v_trajet.arrivee,'') || ' — ' || v_final_price::text || ' €',
    '/admin/candidatures', 'mission_offre', v_offre_id,
    jsonb_build_object('trajet_id', _trajet_id, 'convoyeur_id', v_conv_id, 'prix', v_final_price)
  );

  RETURN v_offre_id;
END;
$function$;
