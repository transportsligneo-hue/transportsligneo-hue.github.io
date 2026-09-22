ALTER TABLE public.mission_locations
  ADD COLUMN IF NOT EXISTS speed double precision,
  ADD COLUMN IF NOT EXISTS heading double precision;

CREATE INDEX IF NOT EXISTS mission_locations_attr_recorded_idx
  ON public.mission_locations (attribution_id, recorded_at);