CREATE TABLE public.mission_plate_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attribution_id uuid NOT NULL REFERENCES public.attributions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  phase text NOT NULL DEFAULT 'depart',
  expected_plate text,
  scanned_plate text,
  method text NOT NULL DEFAULT 'scan',
  result text NOT NULL,
  confidence numeric,
  photo_path text,
  raw_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX mission_plate_checks_attribution_idx ON public.mission_plate_checks(attribution_id);

GRANT SELECT, INSERT ON public.mission_plate_checks TO authenticated;
GRANT ALL ON public.mission_plate_checks TO service_role;

ALTER TABLE public.mission_plate_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Convoyeurs read own plate checks"
  ON public.mission_plate_checks FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "Convoyeurs insert own plate checks"
  ON public.mission_plate_checks FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());