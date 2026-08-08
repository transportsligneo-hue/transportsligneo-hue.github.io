CREATE TABLE public.mission_departure_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attribution_id uuid NOT NULL REFERENCES public.attributions(id) ON DELETE CASCADE,
  gilet_jaune boolean NOT NULL DEFAULT false,
  tenue_conforme boolean NOT NULL DEFAULT false,
  permis_en_possession boolean NOT NULL DEFAULT false,
  validated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (attribution_id)
);

GRANT SELECT, INSERT, UPDATE ON public.mission_departure_checklists TO authenticated;
GRANT ALL ON public.mission_departure_checklists TO service_role;

ALTER TABLE public.mission_departure_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage departure checklists"
ON public.mission_departure_checklists FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Convoyeurs read own departure checklists"
ON public.mission_departure_checklists FOR SELECT TO authenticated
USING (attribution_id IN (
  SELECT a.id FROM public.attributions a
  JOIN public.convoyeurs c ON c.id = a.convoyeur_id
  WHERE c.user_id = auth.uid()
));

CREATE POLICY "Convoyeurs insert own departure checklists"
ON public.mission_departure_checklists FOR INSERT TO authenticated
WITH CHECK (attribution_id IN (
  SELECT a.id FROM public.attributions a
  JOIN public.convoyeurs c ON c.id = a.convoyeur_id
  WHERE c.user_id = auth.uid()
));

CREATE POLICY "Convoyeurs update own departure checklists"
ON public.mission_departure_checklists FOR UPDATE TO authenticated
USING (attribution_id IN (
  SELECT a.id FROM public.attributions a
  JOIN public.convoyeurs c ON c.id = a.convoyeur_id
  WHERE c.user_id = auth.uid()
))
WITH CHECK (attribution_id IN (
  SELECT a.id FROM public.attributions a
  JOIN public.convoyeurs c ON c.id = a.convoyeur_id
  WHERE c.user_id = auth.uid()
));

CREATE POLICY "Clients read departure checklists of own missions"
ON public.mission_departure_checklists FOR SELECT TO authenticated
USING (is_attribution_client(auth.uid(), attribution_id));

ALTER PUBLICATION supabase_realtime ADD TABLE public.mission_departure_checklists;