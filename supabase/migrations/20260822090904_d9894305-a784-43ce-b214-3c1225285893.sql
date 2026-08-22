DROP POLICY IF EXISTS penalites_read_all_auth ON public.catalogue_penalites;
CREATE POLICY penalites_read_admin ON public.catalogue_penalites
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS regles_read_convoyeur ON public.regles_remuneration;