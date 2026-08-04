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
  res jsonb := '[]'::jsonb;
  uid uuid := auth.uid();
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
END;
$$;

REVOKE ALL ON FUNCTION public.submit_module_quiz(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_module_quiz(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_module_quiz(uuid, jsonb) TO service_role;