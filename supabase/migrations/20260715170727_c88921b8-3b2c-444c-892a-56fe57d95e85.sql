
-- 1. Revoke EXECUTE from anon/PUBLIC on internal trigger SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.enforce_anon_b2b_fleet_rl() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_anon_b2b_fleet_rl() FROM anon;
REVOKE EXECUTE ON FUNCTION public.enforce_anon_b2b_fleet_rl() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_anon_b2b_transport_rl() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_anon_b2b_transport_rl() FROM anon;
REVOKE EXECUTE ON FUNCTION public.enforce_anon_b2b_transport_rl() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_anon_companies_rate_limit() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_anon_companies_rate_limit() FROM anon;
REVOKE EXECUTE ON FUNCTION public.enforce_anon_companies_rate_limit() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_convoyeur_sensitive_fields() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.protect_convoyeur_sensitive_fields() FROM anon;
REVOKE EXECUTE ON FUNCTION public.protect_convoyeur_sensitive_fields() FROM authenticated;

-- 2. Restrict direct SELECT on formation content to admins/super_admins only
DROP POLICY IF EXISTS "Formation modules readable by authenticated drivers" ON public.formation_modules;
DROP POLICY IF EXISTS "Formation exams readable by authenticated" ON public.formation_exams;

CREATE POLICY "Formation modules readable by admins"
  ON public.formation_modules FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Formation exams readable by admins"
  ON public.formation_exams FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- 3. Sanitized read RPCs (strip 'answer' and 'explanation' from questions)
CREATE OR REPLACE FUNCTION public.get_formation_modules_for_driver()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(row_data ORDER BY sort_order_val), '[]'::jsonb)
  FROM (
    SELECT
      jsonb_build_object(
        'id', id,
        'slug', slug,
        'title', title,
        'description', description,
        'content_type', content_type,
        'content_url', content_url,
        'content_body', content_body,
        'minimum_score', minimum_score,
        'estimated_minutes', estimated_minutes,
        'sort_order', sort_order,
        'category', category,
        'is_required', is_required,
        'sections', COALESCE(sections, '[]'::jsonb),
        'quiz_questions', COALESCE((
          SELECT jsonb_agg(jsonb_build_object('question', q->>'question', 'choices', q->'choices'))
          FROM jsonb_array_elements(COALESCE(quiz_questions, '[]'::jsonb)) AS q
        ), '[]'::jsonb)
      ) AS row_data,
      sort_order AS sort_order_val
    FROM public.formation_modules
    WHERE is_active = true
  ) s;
$$;
GRANT EXECUTE ON FUNCTION public.get_formation_modules_for_driver() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_formation_exam_for_driver()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT to_jsonb(x) FROM (
    SELECT
      id,
      title,
      description,
      question_count,
      time_limit_minutes,
      minimum_score,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object('question', q->>'question', 'choices', q->'choices'))
        FROM jsonb_array_elements(COALESCE(question_pool, '[]'::jsonb)) AS q
      ), '[]'::jsonb) AS question_pool
    FROM public.formation_exams
    WHERE is_active = true
    ORDER BY created_at
    LIMIT 1
  ) x;
$$;
GRANT EXECUTE ON FUNCTION public.get_formation_exam_for_driver() TO authenticated;

-- 4. Server-side scoring: module quiz
CREATE OR REPLACE FUNCTION public.submit_module_quiz(_module_id uuid, _answers jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m record;
  conv_id uuid;
  qs jsonb;
  total int;
  correct_count int := 0;
  score int;
  passed boolean;
  i int;
  ans int;
  review jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  SELECT id INTO conv_id FROM public.convoyeurs WHERE user_id = auth.uid();
  IF conv_id IS NULL THEN
    RAISE EXCEPTION 'Convoyeur profile not found';
  END IF;
  SELECT * INTO m FROM public.formation_modules WHERE id = _module_id AND is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Module not found';
  END IF;
  qs := COALESCE(m.quiz_questions, '[]'::jsonb);
  total := jsonb_array_length(qs);
  IF total = 0 THEN
    RETURN jsonb_build_object('score', 100, 'passed', true, 'review', '[]'::jsonb);
  END IF;
  FOR i IN 0..total-1 LOOP
    ans := NULLIF(_answers->>(i::text), '')::int;
    IF ans IS NOT NULL AND ans = (qs->i->>'answer')::int THEN
      correct_count := correct_count + 1;
    END IF;
  END LOOP;
  score := ROUND(correct_count::numeric * 100 / total);
  passed := score >= m.minimum_score;

  INSERT INTO public.formation_quiz_attempts (convoyeur_id, module_id, score, passed, answers)
  VALUES (conv_id, _module_id, score, passed, _answers);

  IF passed THEN
    INSERT INTO public.formation_progress (convoyeur_id, module_id, status, score, completed_at, last_seen_at)
    VALUES (conv_id, _module_id, 'completed', score, now(), now())
    ON CONFLICT (convoyeur_id, module_id) DO UPDATE
      SET status = 'completed',
          score = EXCLUDED.score,
          completed_at = now(),
          last_seen_at = now();
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'question', q->>'question',
    'choices', q->'choices',
    'answer', (q->>'answer')::int,
    'explanation', q->>'explanation'
  )) INTO review
  FROM jsonb_array_elements(qs) AS q;

  RETURN jsonb_build_object('score', score, 'passed', passed, 'review', COALESCE(review, '[]'::jsonb));
END $$;
GRANT EXECUTE ON FUNCTION public.submit_module_quiz(uuid, jsonb) TO authenticated;

-- 5. Server-side scoring: final exam (client sends chosen indexes into the sanitized pool)
CREATE OR REPLACE FUNCTION public.submit_formation_exam(
  _exam_id uuid,
  _question_indexes int[],
  _answers jsonb,
  _started_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  e record;
  conv_id uuid;
  qs jsonb;
  total int;
  correct_count int := 0;
  score int;
  passed boolean;
  i int;
  idx int;
  ans int;
  q_snapshot jsonb := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  SELECT id INTO conv_id FROM public.convoyeurs WHERE user_id = auth.uid();
  IF conv_id IS NULL THEN
    RAISE EXCEPTION 'Convoyeur profile not found';
  END IF;
  SELECT * INTO e FROM public.formation_exams WHERE id = _exam_id AND is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exam not found';
  END IF;
  qs := COALESCE(e.question_pool, '[]'::jsonb);
  total := COALESCE(array_length(_question_indexes, 1), 0);
  IF total = 0 THEN
    RAISE EXCEPTION 'No questions provided';
  END IF;
  FOR i IN 1..total LOOP
    idx := _question_indexes[i];
    IF idx < 0 OR idx >= jsonb_array_length(qs) THEN
      RAISE EXCEPTION 'Invalid question index';
    END IF;
    q_snapshot := q_snapshot || jsonb_build_array(qs->idx);
    ans := NULLIF(_answers->>((i-1)::text), '')::int;
    IF ans IS NOT NULL AND ans = (qs->idx->>'answer')::int THEN
      correct_count := correct_count + 1;
    END IF;
  END LOOP;
  score := ROUND(correct_count::numeric * 100 / total);
  passed := score >= e.minimum_score;

  INSERT INTO public.formation_exam_attempts (
    convoyeur_id, exam_id, score, passed, duration_seconds, questions, answers, started_at, finished_at
  ) VALUES (
    conv_id, _exam_id, score, passed,
    GREATEST(0, EXTRACT(EPOCH FROM (now() - _started_at))::int),
    q_snapshot, _answers, _started_at, now()
  );

  RETURN jsonb_build_object(
    'score', score,
    'passed', passed,
    'questions', q_snapshot
  );
END $$;
GRANT EXECUTE ON FUNCTION public.submit_formation_exam(uuid, int[], jsonb, timestamptz) TO authenticated;
