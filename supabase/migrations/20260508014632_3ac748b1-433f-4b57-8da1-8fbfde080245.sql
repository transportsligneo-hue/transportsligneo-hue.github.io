
-- 1) b2b_transport_requests: drop overly-permissive SELECT, add scoped policies
DROP POLICY IF EXISTS "Anyone can read own session request" ON public.b2b_transport_requests;

CREATE POLICY "Company contact can read own requests"
  ON public.b2b_transport_requests
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT id FROM public.companies
      WHERE lower(contact_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

CREATE POLICY "Org members can read org requests"
  ON public.b2b_transport_requests
  FOR SELECT
  TO authenticated
  USING (
    organization_id IS NOT NULL
    AND public.is_org_member(organization_id, auth.uid())
  );

-- 2) admin_notifications: remove permissive insert, add definer RPC for trusted event-type inserts
DROP POLICY IF EXISTS "Authenticated insert notifications" ON public.admin_notifications;

CREATE POLICY "Admins insert notifications"
  ON public.admin_notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.create_admin_notification(
  _type text,
  _titre text,
  _message text DEFAULT NULL,
  _link text DEFAULT NULL,
  _entity_type text DEFAULT NULL,
  _entity_id uuid DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_allowed text[] := ARRAY[
    'incident','estimation','devis','mission_acceptee','mission_offre',
    'mission_terminee','client_action','driver_action','b2b_lead','b2b_paiement'
  ];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT (_type = ANY (v_allowed)) THEN
    RAISE EXCEPTION 'Invalid notification type';
  END IF;
  IF _titre IS NULL OR length(trim(_titre)) = 0 OR length(_titre) > 300 THEN
    RAISE EXCEPTION 'Invalid title';
  END IF;
  IF _message IS NOT NULL AND length(_message) > 2000 THEN
    RAISE EXCEPTION 'Message too long';
  END IF;
  IF _link IS NOT NULL AND length(_link) > 500 THEN
    RAISE EXCEPTION 'Link too long';
  END IF;

  INSERT INTO public.admin_notifications (type, titre, message, link, entity_type, entity_id, metadata)
  VALUES (_type, trim(_titre), _message, _link, _entity_type, _entity_id, coalesce(_metadata, '{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_admin_notification(text,text,text,text,text,uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_admin_notification(text,text,text,text,text,uuid,jsonb) TO authenticated;

-- 3) Storage: convoyeurs can update/delete their own mission selfies
CREATE POLICY "Convoyeurs delete own mission selfies"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'mission-selfies'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Convoyeurs update own mission selfies"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'mission-selfies'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 4) Storage: convoyeurs can delete their own mission documents (folder = attribution_id, but uploader=auth.uid not in path; allow admins + owner uploads via metadata if any)
-- Conservative: allow delete if the object owner matches auth.uid (storage.objects.owner)
CREATE POLICY "Convoyeurs delete own mission documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'mission-documents'
    AND owner = auth.uid()
  );
