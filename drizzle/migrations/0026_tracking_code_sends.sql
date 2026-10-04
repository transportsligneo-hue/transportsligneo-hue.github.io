ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS tracking_recipient_email text;
CREATE TABLE public.tracking_code_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  sent_by uuid,
  actor_role text NOT NULL CHECK (actor_role IN ('client','admin')),
  recipient_email text NOT NULL,
  status text NOT NULL,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tracking_code_sends_mission_idx ON public.tracking_code_sends(mission_id, created_at DESC);
GRANT SELECT ON public.tracking_code_sends TO authenticated;
GRANT ALL ON public.tracking_code_sends TO service_role;
ALTER TABLE public.tracking_code_sends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read tracking sends" ON public.tracking_code_sends FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Clients read own mission sends" ON public.tracking_code_sends FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.missions m WHERE m.id = mission_id AND m.user_id = auth.uid()));