CREATE OR REPLACE FUNCTION public.resolve_mission_alert(_alert_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.mission_alerts
     SET status = 'resolved',
         resolved_at = now(),
         acknowledged_by = COALESCE(acknowledged_by, auth.uid()),
         acknowledged_at = COALESCE(acknowledged_at, now())
   WHERE id = _alert_id;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_mission_alert(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.resolve_mission_alert(uuid) TO authenticated;