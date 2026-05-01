
ALTER TABLE public.attributions REPLICA IDENTITY FULL;
ALTER TABLE public.mission_locations REPLICA IDENTITY FULL;
ALTER TABLE public.mission_etape_history REPLICA IDENTITY FULL;
ALTER TABLE public.mission_documents REPLICA IDENTITY FULL;
ALTER TABLE public.inspections REPLICA IDENTITY FULL;
ALTER TABLE public.inspection_photos REPLICA IDENTITY FULL;
ALTER TABLE public.trajets REPLICA IDENTITY FULL;

DO $$
BEGIN
  PERFORM 1 FROM pg_publication WHERE pubname = 'supabase_realtime';
  IF NOT FOUND THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.attributions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mission_locations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mission_etape_history;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mission_documents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.inspections;
ALTER PUBLICATION supabase_realtime ADD TABLE public.inspection_photos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.trajets;
