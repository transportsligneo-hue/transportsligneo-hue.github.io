
-- Helper: un client est-il "propriétaire" d'une attribution ?
-- Vérifie via devis, demandes_convoyage, missions (numero) et user_id/email.
CREATE OR REPLACE FUNCTION public.is_attribution_client(_user_id uuid, _attribution_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.attributions a
    JOIN public.trajets t ON t.id = a.trajet_id
    LEFT JOIN public.devis d ON d.id = t.devis_id
    LEFT JOIN public.demandes_convoyage dc ON dc.id = t.demande_id
    LEFT JOIN public.missions m ON m.numero = a.numero_mission
    LEFT JOIN public.profiles p ON p.user_id = _user_id
    WHERE a.id = _attribution_id
      AND (
        d.user_id = _user_id
        OR dc.user_id = _user_id
        OR m.user_id = _user_id
        OR (p.email IS NOT NULL AND lower(p.email) = lower(coalesce(d.email,'')))
        OR (p.email IS NOT NULL AND lower(p.email) = lower(coalesce(dc.email,'')))
        OR (p.email IS NOT NULL AND lower(p.email) = lower(coalesce(m.email,'')))
        OR (p.email IS NOT NULL AND lower(p.email) = lower(coalesce(t.client_email,'')))
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_attribution_client(uuid, uuid) TO authenticated;

-- mission_locations : clients peuvent lire les positions de leurs missions
DROP POLICY IF EXISTS "Clients read locations of own missions" ON public.mission_locations;
CREATE POLICY "Clients read locations of own missions"
ON public.mission_locations
FOR SELECT TO authenticated
USING (public.is_attribution_client(auth.uid(), attribution_id));

-- mission_etape_history : clients peuvent lire l'historique des étapes
DROP POLICY IF EXISTS "Clients read etape history of own missions" ON public.mission_etape_history;
CREATE POLICY "Clients read etape history of own missions"
ON public.mission_etape_history
FOR SELECT TO authenticated
USING (public.is_attribution_client(auth.uid(), attribution_id));

-- mission_signatures : remplace la politique restreinte par celle basée sur la fonction
DROP POLICY IF EXISTS "Clients read signatures of own missions" ON public.mission_signatures;
CREATE POLICY "Clients read signatures of own missions"
ON public.mission_signatures
FOR SELECT TO authenticated
USING (public.is_attribution_client(auth.uid(), attribution_id));

-- mission_selfies : pareil
DROP POLICY IF EXISTS "Clients read selfies of own missions" ON public.mission_selfies;
CREATE POLICY "Clients read selfies of own missions"
ON public.mission_selfies
FOR SELECT TO authenticated
USING (public.is_attribution_client(auth.uid(), attribution_id));

-- inspections : clients peuvent lire les inspections de leur mission (kilométrage, équipements)
DROP POLICY IF EXISTS "Clients read inspections of own missions" ON public.inspections;
CREATE POLICY "Clients read inspections of own missions"
ON public.inspections
FOR SELECT TO authenticated
USING (public.is_attribution_client(auth.uid(), attribution_id));

-- inspection_photos : remplace la politique fragile par celle basée sur la fonction
DROP POLICY IF EXISTS "Clients read own mission inspection photos" ON public.inspection_photos;
CREATE POLICY "Clients read own mission inspection photos"
ON public.inspection_photos
FOR SELECT TO authenticated
USING (
  inspection_id IN (
    SELECT i.id FROM public.inspections i
    WHERE public.is_attribution_client(auth.uid(), i.attribution_id)
  )
);

-- mission_documents : élargit l'accès client (les pièces visibles client uniquement)
DROP POLICY IF EXISTS "Clients read own mission documents" ON public.mission_documents;
CREATE POLICY "Clients read own mission documents"
ON public.mission_documents
FOR SELECT TO authenticated
USING (
  visible_client = true
  AND public.is_attribution_client(auth.uid(), attribution_id)
);

-- Storage: clients peuvent lire les photos d'inspection / selfies / documents de leurs missions
DROP POLICY IF EXISTS "Clients read inspection photos of own missions" ON storage.objects;
CREATE POLICY "Clients read inspection photos of own missions"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'inspection-photos'
  AND EXISTS (
    SELECT 1 FROM public.inspection_photos ip
    JOIN public.inspections i ON i.id = ip.inspection_id
    WHERE ip.url_photo = storage.objects.name
      AND public.is_attribution_client(auth.uid(), i.attribution_id)
  )
);

DROP POLICY IF EXISTS "Clients read selfies of own missions" ON storage.objects;
CREATE POLICY "Clients read selfies of own missions"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'mission-selfies'
  AND EXISTS (
    SELECT 1 FROM public.mission_selfies s
    WHERE s.storage_path = storage.objects.name
      AND public.is_attribution_client(auth.uid(), s.attribution_id)
  )
);

DROP POLICY IF EXISTS "Clients read mission documents of own missions" ON storage.objects;
CREATE POLICY "Clients read mission documents of own missions"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'mission-documents'
  AND EXISTS (
    SELECT 1 FROM public.mission_documents d
    WHERE d.url_fichier = storage.objects.name
      AND d.visible_client = true
      AND public.is_attribution_client(auth.uid(), d.attribution_id)
  )
);
