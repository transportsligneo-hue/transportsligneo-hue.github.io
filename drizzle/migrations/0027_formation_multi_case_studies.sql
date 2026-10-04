ALTER TABLE public.modules ADD COLUMN IF NOT EXISTS case_studies jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.module_progress ADD COLUMN IF NOT EXISTS case_answers jsonb NOT NULL DEFAULT '{}'::jsonb;

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
        ) ORDER BY o) FROM jsonb_array_elements(m.case_studies) WITH ORDINALITY t(cs, o)), '[]'::jsonb),
      'quiz_questions', COALESCE((SELECT jsonb_agg(jsonb_build_object('question', q->>'question','choices', q->'choices'))
        FROM jsonb_array_elements(COALESCE(m.quiz_questions,'[]'::jsonb)) q), '[]'::jsonb)
    ) AS x
    FROM public.modules m WHERE m.is_active = true
  ) s;
$fn$;

CREATE OR REPLACE FUNCTION public.submit_case_study_at(_module_id uuid, _case_index integer, _choice integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE c jsonb; uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT (case_studies->_case_index->'choices'->_choice) INTO c FROM public.modules WHERE id = _module_id;
  IF c IS NULL THEN RAISE EXCEPTION 'Invalid choice'; END IF;
  INSERT INTO public.module_progress (user_id, module_id, case_study_answer, case_answers)
  VALUES (uid, _module_id, CASE WHEN _case_index = 0 THEN _choice END, jsonb_build_object(_case_index::text, _choice))
  ON CONFLICT (user_id, module_id) DO UPDATE SET
    case_answers = COALESCE(public.module_progress.case_answers,'{}'::jsonb) || jsonb_build_object(_case_index::text, _choice),
    case_study_answer = COALESCE(public.module_progress.case_study_answer, _choice),
    updated_at = now();
  RETURN jsonb_build_object('correct', COALESCE((c->>'correct')::boolean,false), 'feedback', c->>'feedback');
END; $fn$;
REVOKE ALL ON FUNCTION public.submit_case_study_at(uuid, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_case_study_at(uuid, integer, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_module_quiz(_module_id uuid, _answers jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE q jsonb; i int := 0; correct int := 0; total int := 0; score int; res jsonb := '[]'::jsonb; uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  FOR q IN SELECT jsonb_array_elements(quiz_questions) FROM public.modules WHERE id = _module_id LOOP
    total := total + 1;
    IF (_answers->>i)::int IS NOT DISTINCT FROM (q->>'answer')::int THEN correct := correct + 1; END IF;
    res := res || jsonb_build_object('index', i,
      'correct', (_answers->>i)::int IS NOT DISTINCT FROM (q->>'answer')::int,
      'answer', (q->>'answer')::int, 'explanation', q->>'explanation');
    i := i + 1;
  END LOOP;
  score := CASE WHEN total = 0 THEN 100 ELSE round(correct::numeric * 100 / total) END;
  INSERT INTO public.module_progress (user_id, module_id, quiz_score, attempts_count)
  VALUES (uid, _module_id, score, 1)
  ON CONFLICT (user_id, module_id) DO UPDATE
    SET quiz_score = GREATEST(COALESCE(public.module_progress.quiz_score,0), score),
        attempts_count = public.module_progress.attempts_count + 1,
        updated_at = now();
  RETURN jsonb_build_object('score', score, 'passed', score >= 100, 'results', res);
END; $fn$;