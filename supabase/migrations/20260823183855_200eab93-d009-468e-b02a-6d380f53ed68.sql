CREATE OR REPLACE FUNCTION public.is_mission_client(_user_id uuid, _mission_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.missions m
    LEFT JOIN public.profiles p ON p.user_id = _user_id
    LEFT JOIN public.organization_members om ON om.user_id = _user_id AND om.status = 'active'
    WHERE m.id = _mission_id
      AND (
        m.user_id = _user_id
        OR (
          _user_id = auth.uid()
          AND public.auth_verified_email() IS NOT NULL
          AND p.email IS NOT NULL
          AND lower(btrim(p.email)) = public.auth_verified_email()
          AND lower(btrim(p.email)) = lower(btrim(coalesce(m.email, '')))
        )
        OR (m.organization_id IS NOT NULL AND om.organization_id = m.organization_id)
        OR (m.fleet_organization_id IS NOT NULL AND om.organization_id = m.fleet_organization_id)
        OR (p.organization_id IS NOT NULL AND (p.organization_id = m.organization_id OR p.organization_id = m.fleet_organization_id))
      )
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_attribution_client(_user_id uuid, _attribution_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.attributions a
    JOIN public.trajets t ON t.id = a.trajet_id
    LEFT JOIN public.devis d ON d.id = t.devis_id
    LEFT JOIN public.demandes_convoyage dc ON dc.id = t.demande_id
    LEFT JOIN public.missions m
      ON t.devis_id IS NOT NULL AND m.devis_id = t.devis_id
    WHERE a.id = _attribution_id
      AND (
        d.user_id = _user_id
        OR dc.user_id = _user_id
        OR m.user_id = _user_id
        OR (
          _user_id = auth.uid()
          AND public.auth_verified_email() IS NOT NULL
          AND (
            public.auth_verified_email() = lower(btrim(coalesce(d.email,'')))
            OR public.auth_verified_email() = lower(btrim(coalesce(dc.email,'')))
            OR public.auth_verified_email() = lower(btrim(coalesce(m.email,'')))
            OR public.auth_verified_email() = lower(btrim(coalesce(t.client_email,'')))
          )
        )
      )
  );
$function$;