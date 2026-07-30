ALTER TABLE public.trajets ADD COLUMN IF NOT EXISTS group_reference text;
ALTER TABLE public.trajets ADD COLUMN IF NOT EXISTS leg_type text;
ALTER TABLE public.trajets ADD COLUMN IF NOT EXISTS leg_index integer;
ALTER TABLE public.trajets ADD COLUMN IF NOT EXISTS is_round_trip boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_trajets_mission_group_legs ON public.trajets(mission_group_id, leg_index);