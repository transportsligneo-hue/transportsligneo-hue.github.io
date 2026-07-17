GRANT EXECUTE ON FUNCTION public.create_scan_handoff_session(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_scan_handoff_token(text) TO anon, authenticated;