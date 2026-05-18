ALTER PUBLICATION supabase_realtime ADD TABLE public.mission_selfies;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mission_signatures;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mission_step_overrides;

ALTER TABLE public.mission_selfies REPLICA IDENTITY FULL;
ALTER TABLE public.mission_signatures REPLICA IDENTITY FULL;
ALTER TABLE public.mission_step_overrides REPLICA IDENTITY FULL;