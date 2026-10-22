-- Formation : correction de l'enregistrement « Terminé » + déblocage du catalogue + mise en situation paiement
-- Cause : le trigger de garde (completed exige quiz_score = 100) annulait le « completed » envoyé par l'app
-- (upsert PostgREST : EXCLUDED est évalué après le trigger BEFORE INSERT, donc completed repassait à false).

-- 1. Garde : ne bloque que si le module a un quiz non réussi
CREATE OR REPLACE FUNCTION public.module_progress_guard_completion()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE has_quiz boolean;
BEGIN
  IF NEW.completed = true THEN
    SELECT COALESCE(jsonb_array_length(quiz_questions),0) > 0 INTO has_quiz FROM public.modules WHERE id = NEW.module_id;
    IF COALESCE(has_quiz,false) AND COALESCE(NEW.quiz_score,0) < 100 THEN
      NEW.completed := false; NEW.completed_at := NULL;
    ELSIF NEW.completed_at IS NULL THEN
      NEW.completed_at := now();
    END IF;
  END IF;
  RETURN NEW;
END; $fn$;

-- 2. Quiz réussi (100 %) => module terminé directement côté serveur
CREATE OR REPLACE FUNCTION public.submit_module_quiz(_module_id uuid, _answers jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  q jsonb;
  i int := 0;
  correct int := 0;
  total int := 0;
  score int;
  ok boolean;
  expected int[];
  given int[];
  res jsonb := '[]'::jsonb;
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  FOR q IN SELECT jsonb_array_elements(quiz_questions) FROM public.modules WHERE id = _module_id LOOP
    total := total + 1;
    IF jsonb_typeof(q->'answers') = 'array' AND jsonb_array_length(q->'answers') > 1 THEN
      SELECT array_agg(v::int ORDER BY v::int) INTO expected FROM jsonb_array_elements_text(q->'answers') v;
      IF jsonb_typeof(_answers->i) = 'array' THEN
        SELECT array_agg(DISTINCT v::int ORDER BY v::int) INTO given FROM jsonb_array_elements_text(_answers->i) v;
      ELSE
        given := NULL;
      END IF;
      ok := given IS NOT DISTINCT FROM expected;
    ELSE
      ok := jsonb_typeof(_answers->i) = 'number' AND (_answers->>i)::int IS NOT DISTINCT FROM (q->>'answer')::int;
    END IF;
    IF ok THEN correct := correct + 1; END IF;
    res := res || jsonb_build_object('index', i, 'correct', ok,
      'answer', (q->>'answer')::int,
      'answers', COALESCE(q->'answers', jsonb_build_array((q->>'answer')::int)),
      'explanation', q->>'explanation');
    i := i + 1;
  END LOOP;
  score := CASE WHEN total = 0 THEN 100 ELSE round(correct::numeric * 100 / total) END;
  INSERT INTO public.module_progress (user_id, module_id, quiz_score, attempts_count, completed, completed_at)
  VALUES (uid, _module_id, score, 1, score >= 100, CASE WHEN score >= 100 THEN now() END)
  ON CONFLICT (user_id, module_id) DO UPDATE
    SET quiz_score = GREATEST(COALESCE(public.module_progress.quiz_score,0), score),
        attempts_count = public.module_progress.attempts_count + 1,
        completed = public.module_progress.completed OR score >= 100,
        completed_at = CASE WHEN public.module_progress.completed THEN public.module_progress.completed_at
                            WHEN score >= 100 THEN now() END,
        updated_at = now();
  RETURN jsonb_build_object('score', score, 'passed', score >= 100, 'results', res);
END;
$$;
REVOKE ALL ON FUNCTION public.submit_module_quiz(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_module_quiz(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_module_quiz(uuid, jsonb) TO service_role;

-- 3. Terminer un module (sans quiz, ou quiz déjà réussi) sans dépendre de l'upsert client
CREATE OR REPLACE FUNCTION public.complete_module(_module_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE uid uuid := auth.uid(); has_quiz boolean; sc int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT COALESCE(jsonb_array_length(quiz_questions),0) > 0 INTO has_quiz FROM public.modules WHERE id = _module_id;
  SELECT quiz_score INTO sc FROM public.module_progress WHERE user_id = uid AND module_id = _module_id;
  IF COALESCE(has_quiz,false) AND COALESCE(sc,0) < 100 THEN RETURN false; END IF;
  INSERT INTO public.module_progress (user_id, module_id, completed, completed_at)
  VALUES (uid, _module_id, true, now())
  ON CONFLICT (user_id, module_id) DO UPDATE
    SET completed = true, completed_at = COALESCE(public.module_progress.completed_at, now()), updated_at = now();
  RETURN true;
END; $fn$;
REVOKE ALL ON FUNCTION public.complete_module(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_module(uuid) TO authenticated;

-- 4. Rattrapage : tous les modules dont le quiz est déjà à 100 % passent en « Terminé » (débloque le catalogue)
UPDATE public.module_progress SET completed = true, completed_at = COALESCE(completed_at, now())
WHERE completed = false AND COALESCE(quiz_score,0) >= 100;
UPDATE public.module_progress mp SET completed = true, completed_at = COALESCE(mp.completed_at, now())
FROM public.modules m
WHERE m.id = mp.module_id AND mp.completed = false AND COALESCE(jsonb_array_length(m.quiz_questions),0) = 0 AND mp.updated_at IS NOT NULL;

-- 5. Liste des modules : garde les mises en situation multiples ET les quiz à réponses multiples
CREATE OR REPLACE FUNCTION public.get_training_modules()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT COALESCE(jsonb_agg(x ORDER BY (x->>'order_index')::int), '[]'::jsonb) FROM (
    SELECT jsonb_build_object(
      'id', m.id, 'order_index', m.order_index, 'title', m.title, 'tag', m.tag,
      'duration_minutes', m.duration_minutes, 'objectives', m.objectives, 'content', m.content,
      'video_url', m.video_url, 'resource_url', m.resource_url, 'resource_label', m.resource_label,
      'checklist_items', m.checklist_items, 'last_updated', m.last_updated,
      'case_study', jsonb_build_object(
        'scenario', m.case_study->'scenario',
        'choices', COALESCE((SELECT jsonb_agg(jsonb_build_object('label', c->>'label')) FROM jsonb_array_elements(COALESCE(m.case_study->'choices','[]'::jsonb)) c), '[]'::jsonb)
      ),
      'case_studies', COALESCE((SELECT jsonb_agg(jsonb_build_object(
          'scenario', cs->>'scenario',
          'choices', COALESCE((SELECT jsonb_agg(jsonb_build_object('label', c->>'label')) FROM jsonb_array_elements(COALESCE(cs->'choices','[]'::jsonb)) c), '[]'::jsonb)
        ) ORDER BY o) FROM jsonb_array_elements(COALESCE(m.case_studies,'[]'::jsonb)) WITH ORDINALITY t(cs, o)), '[]'::jsonb),
      'quiz_questions', COALESCE((SELECT jsonb_agg(jsonb_build_object(
          'question', q->>'question','choices', q->'choices',
          'multiple', (jsonb_typeof(q->'answers') = 'array' AND jsonb_array_length(q->'answers') > 1)))
        FROM jsonb_array_elements(COALESCE(m.quiz_questions,'[]'::jsonb)) q), '[]'::jsonb)
    ) AS x
    FROM public.modules m WHERE m.is_active = true
  ) s;
$fn$;
REVOKE ALL ON FUNCTION public.get_training_modules() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_training_modules() TO authenticated;

-- 6. Mise en situation « mission terminée il y a 5 jours, pas payée » : on paie tous les 15 jours
UPDATE public.modules m SET case_studies = (
  SELECT jsonb_agg(
    CASE WHEN cs->>'scenario' ILIKE '%toujours pas%pay%' OR cs->>'scenario' ILIKE '%espace financier%' THEN
      jsonb_build_object('scenario', cs->>'scenario', 'choices', jsonb_build_array(
        jsonb_build_object('label','C''est normal : Ligneo règle les convoyeurs tous les 15 jours, la mission sera payée au prochain virement','correct',true,'feedback','Exact. Les paiements sont effectués tous les 15 jours : une mission terminée il y a 5 jours n''apparaît pas encore comme payée.'),
        jsonb_build_object('label','Vous contactez immédiatement l''exploitation pour signaler un retard de paiement','correct',false,'feedback','Inutile à ce stade : le paiement est effectué tous les 15 jours, il n''y a pas de retard.'),
        jsonb_build_object('label','Vous refusez les prochaines missions tant que vous n''êtes pas payé','correct',false,'feedback','Non : le délai est normal, la mission sera réglée au prochain cycle de paiement de 15 jours.')))
    ELSE cs END ORDER BY o)
  FROM jsonb_array_elements(m.case_studies) WITH ORDINALITY t(cs, o))
WHERE jsonb_typeof(m.case_studies) = 'array' AND jsonb_array_length(m.case_studies) > 0
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(m.case_studies) x WHERE x->>'scenario' ILIKE '%toujours pas%pay%' OR x->>'scenario' ILIKE '%espace financier%');
