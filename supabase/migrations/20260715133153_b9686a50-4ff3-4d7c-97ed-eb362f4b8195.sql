
-- === Extend formation_modules with rich sections & metadata ===
ALTER TABLE public.formation_modules
  ADD COLUMN IF NOT EXISTS sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS is_required boolean NOT NULL DEFAULT true;

-- === Formation exams (pool of questions, one active exam) ===
CREATE TABLE IF NOT EXISTS public.formation_exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT 'Examen final Transports Ligneo',
  description text,
  question_pool jsonb NOT NULL DEFAULT '[]'::jsonb,
  question_count integer NOT NULL DEFAULT 20 CHECK (question_count > 0),
  time_limit_minutes integer NOT NULL DEFAULT 20 CHECK (time_limit_minutes > 0),
  minimum_score integer NOT NULL DEFAULT 80 CHECK (minimum_score BETWEEN 0 AND 100),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.formation_exams TO authenticated;
GRANT ALL ON public.formation_exams TO service_role;
ALTER TABLE public.formation_exams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Formation exams readable by authenticated" ON public.formation_exams;
CREATE POLICY "Formation exams readable by authenticated"
ON public.formation_exams FOR SELECT TO authenticated
USING (is_active = true OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
DROP POLICY IF EXISTS "Admins manage formation exams" ON public.formation_exams;
CREATE POLICY "Admins manage formation exams"
ON public.formation_exams FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

DROP TRIGGER IF EXISTS update_formation_exams_updated_at ON public.formation_exams;
CREATE TRIGGER update_formation_exams_updated_at
BEFORE UPDATE ON public.formation_exams
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- === Exam attempts ===
CREATE TABLE IF NOT EXISTS public.formation_exam_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  convoyeur_id uuid NOT NULL REFERENCES public.convoyeurs(id) ON DELETE CASCADE,
  exam_id uuid NOT NULL REFERENCES public.formation_exams(id) ON DELETE CASCADE,
  score integer NOT NULL CHECK (score BETWEEN 0 AND 100),
  passed boolean NOT NULL DEFAULT false,
  duration_seconds integer,
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.formation_exam_attempts TO authenticated;
GRANT ALL ON public.formation_exam_attempts TO service_role;
ALTER TABLE public.formation_exam_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Convoyeurs read own exam attempts" ON public.formation_exam_attempts;
CREATE POLICY "Convoyeurs read own exam attempts"
ON public.formation_exam_attempts FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.convoyeurs c WHERE c.id = convoyeur_id AND c.user_id = auth.uid())
  OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')
);
DROP POLICY IF EXISTS "Convoyeurs create own exam attempts" ON public.formation_exam_attempts;
CREATE POLICY "Convoyeurs create own exam attempts"
ON public.formation_exam_attempts FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.convoyeurs c WHERE c.id = convoyeur_id AND c.user_id = auth.uid()));
DROP POLICY IF EXISTS "Admins manage exam attempts" ON public.formation_exam_attempts;
CREATE POLICY "Admins manage exam attempts"
ON public.formation_exam_attempts FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

-- === Certificates ===
CREATE SEQUENCE IF NOT EXISTS public.formation_certificate_seq START 1;

CREATE TABLE IF NOT EXISTS public.formation_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  convoyeur_id uuid NOT NULL REFERENCES public.convoyeurs(id) ON DELETE CASCADE,
  certificate_number text NOT NULL UNIQUE,
  full_name text NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  verification_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  revoked_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.formation_certificates TO authenticated;
GRANT SELECT ON public.formation_certificates TO anon; -- public verification page
GRANT ALL ON public.formation_certificates TO service_role;
ALTER TABLE public.formation_certificates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Convoyeurs read own certificate" ON public.formation_certificates;
CREATE POLICY "Convoyeurs read own certificate"
ON public.formation_certificates FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.convoyeurs c WHERE c.id = convoyeur_id AND c.user_id = auth.uid())
  OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')
);
DROP POLICY IF EXISTS "Public verify certificate" ON public.formation_certificates;
CREATE POLICY "Public verify certificate"
ON public.formation_certificates FOR SELECT TO anon
USING (revoked_at IS NULL);
DROP POLICY IF EXISTS "Admins manage certificates" ON public.formation_certificates;
CREATE POLICY "Admins manage certificates"
ON public.formation_certificates FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

DROP TRIGGER IF EXISTS update_formation_certificates_updated_at ON public.formation_certificates;
CREATE TRIGGER update_formation_certificates_updated_at
BEFORE UPDATE ON public.formation_certificates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- === Redefine refresh_convoyeur_training_status: require all required modules + passed exam ===
CREATE OR REPLACE FUNCTION public.refresh_convoyeur_training_status(_convoyeur_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  total_required integer;
  total_completed integer;
  has_passed_exam boolean;
  modules_ok boolean;
  fully_done boolean;
BEGIN
  SELECT count(*) INTO total_required FROM public.formation_modules WHERE is_active = true AND is_required = true;
  SELECT count(*) INTO total_completed
  FROM public.formation_progress fp
  JOIN public.formation_modules fm ON fm.id = fp.module_id
  WHERE fp.convoyeur_id = _convoyeur_id
    AND fm.is_active = true AND fm.is_required = true
    AND fp.status = 'completed';

  SELECT EXISTS (
    SELECT 1 FROM public.formation_exam_attempts ea
    JOIN public.formation_exams e ON e.id = ea.exam_id
    WHERE ea.convoyeur_id = _convoyeur_id AND ea.passed = true AND e.is_active = true
  ) INTO has_passed_exam;

  modules_ok := (total_required = 0) OR (total_completed >= total_required);
  fully_done := modules_ok AND (has_passed_exam OR NOT EXISTS (SELECT 1 FROM public.formation_exams WHERE is_active = true));

  UPDATE public.convoyeurs
  SET training_status = CASE
      WHEN fully_done THEN 'completed'
      WHEN total_completed > 0 OR has_passed_exam THEN 'in_progress'
      ELSE 'not_started'
    END,
    has_completed_training = fully_done,
    training_completed_at = CASE
      WHEN fully_done THEN COALESCE(training_completed_at, now())
      ELSE NULL
    END
  WHERE id = _convoyeur_id;
END;
$$;

-- === Trigger: after exam attempt, refresh status + issue certificate on pass ===
CREATE OR REPLACE FUNCTION public.handle_exam_attempt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_full_name text;
  v_user_id uuid;
  v_cert_id uuid;
  v_number text;
BEGIN
  PERFORM public.refresh_convoyeur_training_status(NEW.convoyeur_id);

  IF NEW.passed = true THEN
    SELECT trim(coalesce(prenom,'') || ' ' || coalesce(nom,'')), user_id
      INTO v_full_name, v_user_id
    FROM public.convoyeurs WHERE id = NEW.convoyeur_id;

    IF NOT EXISTS (SELECT 1 FROM public.formation_certificates WHERE convoyeur_id = NEW.convoyeur_id AND revoked_at IS NULL) THEN
      v_number := 'LIGNEO-CERT-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.formation_certificate_seq')::text, 5, '0');
      INSERT INTO public.formation_certificates (convoyeur_id, certificate_number, full_name)
      VALUES (NEW.convoyeur_id, v_number, coalesce(nullif(v_full_name,''),'Convoyeur Ligneo'))
      RETURNING id INTO v_cert_id;

      IF v_user_id IS NOT NULL THEN
        BEGIN
          PERFORM public.create_user_notification(
            v_user_id, 'formation_certifiee', 'Certificat de formation délivré',
            'Félicitations, vous êtes désormais Convoyeur certifié Transports Ligneo. Les missions sont débloquées.',
            '/convoyeur/formation', 'compte', 'high',
            'cert:' || v_cert_id::text, 'formation_certificate', v_cert_id, '{}'::jsonb
          );
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS after_exam_attempt ON public.formation_exam_attempts;
CREATE TRIGGER after_exam_attempt
AFTER INSERT ON public.formation_exam_attempts
FOR EACH ROW EXECUTE FUNCTION public.handle_exam_attempt();

-- === Default exam seed ===
INSERT INTO public.formation_exams (title, description, question_pool, question_count, time_limit_minutes, minimum_score, is_active)
SELECT
  'Examen final Transports Ligneo',
  'Examen de certification obligatoire portant sur la sécurité, la relation client, l''utilisation de l''application et les procédures Ligneo.',
  '[
    {"question":"Avant de démarrer une mission, quelle action est obligatoire ?","choices":["Faire l''état des lieux photo","Uniquement noter le kilométrage","Rien si le client est pressé"],"answer":0},
    {"question":"En cas de dommage constaté au départ, il faut :","choices":["Le photographier et le signaler immédiatement","Attendre l''arrivée pour le noter","Ne rien signaler"],"answer":0},
    {"question":"Quel est le score minimum requis pour valider un module ?","choices":["50%","70%","80%"],"answer":2},
    {"question":"En cas de retard prévisible, le convoyeur doit :","choices":["Prévenir immédiatement le client et Ligneo","Ne rien dire, attendre l''arrivée","Appeler seulement si le retard dépasse 1h"],"answer":0},
    {"question":"L''état des lieux d''arrivée se fait :","choices":["Après remise, avant clôture","Le lendemain","Uniquement si demandé"],"answer":0},
    {"question":"Les documents du véhicule doivent être :","choices":["Photographiés et vérifiés au départ","Ignorés si le client dit qu''ils sont OK","Rangés sans contrôle"],"answer":0},
    {"question":"En cas d''accident, la première action est :","choices":["Sécuriser les personnes puis contacter Ligneo","Continuer la mission","Attendre la police sans rien signaler"],"answer":0},
    {"question":"En cas de panne, il faut :","choices":["Contacter Ligneo et l''assistance","Réparer soi-même le véhicule","Abandonner la mission"],"answer":0},
    {"question":"La signature électronique du client sert à :","choices":["Valider l''état des lieux et la remise","Faire joli sur l''application","Rien d''important"],"answer":0},
    {"question":"Les données du client sont :","choices":["Confidentielles et protégées (RGPD)","Partageables sur les réseaux","Utilisables librement"],"answer":0},
    {"question":"Tenue vestimentaire attendue :","choices":["Correcte, sobre, professionnelle","Libre totalement","Décontractée sans limite"],"answer":0},
    {"question":"Les clés du véhicule sont remises :","choices":["Uniquement à la personne identifiée sur la mission","À toute personne présente","Laissées sur le contact"],"answer":0},
    {"question":"Le carburant / niveau de charge doit être :","choices":["Vérifié et documenté au départ et à l''arrivée","Ignoré","Uniquement noté si vide"],"answer":0},
    {"question":"Vitesse et conduite pendant le convoyage :","choices":["Respect strict du code de la route","Adaptée à l''envie du client","Sportive pour aller plus vite"],"answer":0},
    {"question":"Si le client demande un service hors mission :","choices":["Contacter Ligneo avant d''accepter","Accepter directement","Refuser sans explication"],"answer":0},
    {"question":"Les photos obligatoires à l''arrivée incluent :","choices":["Extérieur 4 faces, intérieur, tableau de bord","Uniquement la plaque","Rien"],"answer":0},
    {"question":"En cas d''absence du contact à l''arrivée :","choices":["Prévenir Ligneo et suivre la procédure","Laisser le véhicule ouvert","Repartir sans prévenir"],"answer":0},
    {"question":"Fumer dans le véhicule du client :","choices":["Strictement interdit","Autorisé fenêtre ouverte","Toléré si le client est absent"],"answer":0},
    {"question":"Le certificat de convoyeur Ligneo est :","choices":["Obligatoire avant d''accepter des missions","Optionnel","Réservé aux salariés"],"answer":0},
    {"question":"En cas de doute sur une procédure :","choices":["Contacter Ligneo avant d''agir","Faire à sa manière","Ignorer la procédure"],"answer":0},
    {"question":"Les incidents mineurs (rayure, éclat) doivent :","choices":["Être photographiés et signalés dans l''app","Être cachés","Être réparés soi-même"],"answer":0},
    {"question":"La ponctualité fait partie :","choices":["Des standards obligatoires Ligneo","D''un choix personnel","D''une option payante"],"answer":0},
    {"question":"Un client mécontent doit être :","choices":["Écouté avec calme et remonté à Ligneo","Ignoré","Contredit fermement"],"answer":0},
    {"question":"Les objets personnels trouvés dans le véhicule :","choices":["Signalés et remis via Ligneo","Gardés","Jetés"],"answer":0},
    {"question":"L''application mobile Ligneo doit être :","choices":["À jour et connectée pendant la mission","Désactivée pour économiser la batterie","Utilisée seulement à la fin"],"answer":0}
  ]'::jsonb,
  20, 20, 80, true
WHERE NOT EXISTS (SELECT 1 FROM public.formation_exams WHERE is_active = true);

-- === Enrich existing modules with richer sections (idempotent) ===
UPDATE public.formation_modules
SET sections = '[
  {"type":"text","content":"Bienvenue sur la formation obligatoire Transports Ligneo. Cette formation garantit un niveau de qualité homogène pour tous nos convoyeurs partenaires."},
  {"type":"callout","tone":"info","content":"La formation est obligatoire avant l''accès aux missions. Vous pouvez reprendre à tout moment là où vous vous êtes arrêté."},
  {"type":"checklist","items":["Lisez chaque section attentivement","Répondez au QCM à la fin du module","Passez l''examen final pour être certifié"]}
]'::jsonb,
    category = coalesce(nullif(category,''),'securite')
WHERE sections = '[]'::jsonb OR sections IS NULL;

-- === Backfill: existing already-validated drivers keep access (no lockout) ===
UPDATE public.convoyeurs
SET has_completed_training = true,
    training_status = 'completed',
    training_completed_at = coalesce(training_completed_at, now())
WHERE statut IN ('valide','actif')
  AND has_completed_training = false
  AND created_at < now();
