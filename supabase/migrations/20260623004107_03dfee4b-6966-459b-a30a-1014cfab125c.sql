REVOKE EXECUTE ON FUNCTION public.auto_archive_old_records() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_archive_old_records() TO service_role, postgres;