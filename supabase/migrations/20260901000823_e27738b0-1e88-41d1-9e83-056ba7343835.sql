DROP VIEW IF EXISTS public.formation_modules_safe;
DROP VIEW IF EXISTS public.formation_exams_safe;

-- Column-level grants: answer keys (quiz_questions / question_pool) are excluded
GRANT SELECT (id, slug, title, description, content_type, content_url, content_body,
              sections, category, minimum_score, estimated_minutes, sort_order,
              is_required, is_active, created_at, updated_at)
  ON public.formation_modules TO authenticated;
GRANT ALL ON public.formation_modules TO service_role;

GRANT SELECT (id, title, description, question_count, time_limit_minutes,
              minimum_score, is_active, created_at, updated_at)
  ON public.formation_exams TO authenticated;
GRANT ALL ON public.formation_exams TO service_role;

CREATE POLICY "Signed-in users can read active formation modules"
  ON public.formation_modules FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "Signed-in users can read active formation exams"
  ON public.formation_exams FOR SELECT TO authenticated
  USING (is_active = true);