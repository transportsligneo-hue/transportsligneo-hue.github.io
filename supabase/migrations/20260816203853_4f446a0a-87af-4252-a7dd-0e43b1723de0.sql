-- 1) Storage: exact path match instead of fragile LIKE suffix match
DROP POLICY IF EXISTS "Convoyeurs can view own documents" ON storage.objects;
CREATE POLICY "Convoyeurs can view own documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'convoyeur-documents'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND EXISTS (
    SELECT 1 FROM public.documents_convoyeurs d
    JOIN public.convoyeurs c ON c.id = d.convoyeur_id
    WHERE c.user_id = auth.uid() AND d.url_fichier = objects.name
  )
);

DROP POLICY IF EXISTS "Convoyeurs can update own documents" ON storage.objects;
CREATE POLICY "Convoyeurs can update own documents"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'convoyeur-documents'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND EXISTS (
    SELECT 1 FROM public.documents_convoyeurs d
    JOIN public.convoyeurs c ON c.id = d.convoyeur_id
    WHERE c.user_id = auth.uid() AND d.url_fichier = objects.name
  )
);

-- 2) Deduplicate redundant has_role checks on organizations / organization_roles
DROP POLICY IF EXISTS "Admins manage organizations" ON public.organizations;
CREATE POLICY "Admins manage organizations"
ON public.organizations FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Admins manage organization roles" ON public.organization_roles;
CREATE POLICY "Admins manage organization roles"
ON public.organization_roles FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- 3) Trajets: drivers only see full trip (incl. client PII) once actually engaged
DROP POLICY IF EXISTS "Convoyeurs read assigned trajets" ON public.trajets;
CREATE POLICY "Convoyeurs read assigned trajets"
ON public.trajets FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.attributions a
    JOIN public.convoyeurs c ON c.id = a.convoyeur_id
    WHERE a.trajet_id = trajets.id
      AND c.user_id = auth.uid()
      AND a.statut IN ('accepte','en_cours','termine','terminee','validee')
  )
);