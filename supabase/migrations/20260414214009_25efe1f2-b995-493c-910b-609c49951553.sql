
-- GPS tracking positions during missions
CREATE TABLE public.mission_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  attribution_id UUID NOT NULL REFERENCES public.attributions(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_mission_locations_attribution ON public.mission_locations(attribution_id);
CREATE INDEX idx_mission_locations_recorded ON public.mission_locations(recorded_at);

ALTER TABLE public.mission_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read all locations"
  ON public.mission_locations FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Convoyeurs can insert own locations"
  ON public.mission_locations FOR INSERT
  TO authenticated
  WITH CHECK (
    attribution_id IN (
      SELECT a.id FROM attributions a
      JOIN convoyeurs c ON c.id = a.convoyeur_id
      WHERE c.user_id = auth.uid()
    )
  );

CREATE POLICY "Convoyeurs can read own locations"
  ON public.mission_locations FOR SELECT
  TO authenticated
  USING (
    attribution_id IN (
      SELECT a.id FROM attributions a
      JOIN convoyeurs c ON c.id = a.convoyeur_id
      WHERE c.user_id = auth.uid()
    )
  );

-- Enable realtime for GPS tracking
ALTER PUBLICATION supabase_realtime ADD TABLE public.mission_locations;

-- Vehicle inspections (état des lieux)
CREATE TABLE public.inspections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  attribution_id UUID NOT NULL REFERENCES public.attributions(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('depart', 'arrivee')),
  statut TEXT NOT NULL DEFAULT 'en_cours' CHECK (statut IN ('en_cours', 'complete')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(attribution_id, type)
);

ALTER TABLE public.inspections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all inspections"
  ON public.inspections FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Convoyeurs can manage own inspections"
  ON public.inspections FOR ALL
  TO authenticated
  USING (
    attribution_id IN (
      SELECT a.id FROM attributions a
      JOIN convoyeurs c ON c.id = a.convoyeur_id
      WHERE c.user_id = auth.uid()
    )
  );

CREATE TRIGGER update_inspections_updated_at
  BEFORE UPDATE ON public.inspections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Inspection photos (guided photo capture)
CREATE TABLE public.inspection_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inspection_id UUID NOT NULL REFERENCES public.inspections(id) ON DELETE CASCADE,
  vue_type TEXT NOT NULL CHECK (vue_type IN (
    'avant', 'avant_droit', 'cote_droit', 'arriere_droit',
    'arriere', 'arriere_gauche', 'cote_gauche', 'avant_gauche',
    'interieur_avant', 'interieur_arriere', 'tableau_bord'
  )),
  url_photo TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(inspection_id, vue_type)
);

ALTER TABLE public.inspection_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all inspection photos"
  ON public.inspection_photos FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Convoyeurs can manage own inspection photos"
  ON public.inspection_photos FOR ALL
  TO authenticated
  USING (
    inspection_id IN (
      SELECT i.id FROM inspections i
      JOIN attributions a ON a.id = i.attribution_id
      JOIN convoyeurs c ON c.id = a.convoyeur_id
      WHERE c.user_id = auth.uid()
    )
  );

-- Storage bucket for inspection photos
INSERT INTO storage.buckets (id, name, public) VALUES ('inspection-photos', 'inspection-photos', false);

CREATE POLICY "Admins can view all inspection photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'inspection-photos' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Convoyeurs can upload inspection photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'inspection-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Convoyeurs can view own inspection photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'inspection-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
