CREATE OR REPLACE FUNCTION public.module_progress_guard_completion()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF NEW.completed = true AND COALESCE(NEW.quiz_score, 0) < 100 THEN
    NEW.completed := false;
    NEW.completed_at := NULL;
  END IF;
  RETURN NEW;
END; $fn$;
DROP TRIGGER IF EXISTS module_progress_guard_completion_trg ON public.module_progress;
CREATE TRIGGER module_progress_guard_completion_trg BEFORE INSERT OR UPDATE ON public.module_progress
FOR EACH ROW EXECUTE FUNCTION public.module_progress_guard_completion();