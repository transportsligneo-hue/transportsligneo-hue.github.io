
ALTER TABLE public.trajets ADD COLUMN IF NOT EXISTS bidding_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.mission_offres ADD COLUMN IF NOT EXISTS is_winning boolean NOT NULL DEFAULT false;
ALTER TABLE public.mission_offres ADD COLUMN IF NOT EXISTS bid_round int NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_trajets_bidding_enabled ON public.trajets (bidding_enabled) WHERE bidding_enabled = true;
CREATE INDEX IF NOT EXISTS idx_mission_offres_is_winning ON public.mission_offres (trajet_id) WHERE is_winning = true;
