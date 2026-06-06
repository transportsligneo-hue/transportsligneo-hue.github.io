DELETE FROM public.mission_pv_digitaux WHERE plateforme = 'welcomauto_ayvens';

ALTER TABLE public.mission_pv_digitaux DROP CONSTRAINT IF EXISTS mission_pv_digitaux_plateforme_check;
ALTER TABLE public.mission_pv_digitaux ADD CONSTRAINT mission_pv_digitaux_plateforme_check CHECK (plateforme IN ('model_arval'));