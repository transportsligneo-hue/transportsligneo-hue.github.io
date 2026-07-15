REVOKE EXECUTE ON FUNCTION public.get_formation_exam_for_driver FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_formation_modules_for_driver FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.submit_formation_exam(_exam_id uuid, _question_indexes integer[], _answers jsonb, _started_at timestamp with time zone) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.submit_module_quiz(_module_id uuid, _answers jsonb) FROM PUBLIC;