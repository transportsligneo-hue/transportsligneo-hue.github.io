-- 1) km_tiers: reference data readable by any signed-in user
GRANT SELECT ON public.km_tiers TO authenticated;
GRANT ALL ON public.km_tiers TO service_role;
CREATE POLICY "Authenticated users can read km tiers"
  ON public.km_tiers FOR SELECT TO authenticated
  USING (true);

-- 2) Training content: expose sanitized views without answer keys.
-- Base tables remain admin-only.
CREATE OR REPLACE VIEW public.formation_modules_safe AS
  SELECT id, slug, title, description, content_type, content_url, content_body,
         sections, category, minimum_score, estimated_minutes, sort_order,
         is_required, is_active, created_at, updated_at
  FROM public.formation_modules
  WHERE is_active = true;

CREATE OR REPLACE VIEW public.formation_exams_safe AS
  SELECT id, title, description, question_count, time_limit_minutes,
         minimum_score, is_active, created_at, updated_at
  FROM public.formation_exams
  WHERE is_active = true;

ALTER VIEW public.formation_modules_safe SET (security_invoker = off);
ALTER VIEW public.formation_exams_safe SET (security_invoker = off);

REVOKE ALL ON public.formation_modules_safe FROM PUBLIC, anon;
REVOKE ALL ON public.formation_exams_safe FROM PUBLIC, anon;
GRANT SELECT ON public.formation_modules_safe TO authenticated;
GRANT SELECT ON public.formation_exams_safe TO authenticated;
GRANT SELECT ON public.formation_modules_safe TO service_role;
GRANT SELECT ON public.formation_exams_safe TO service_role;