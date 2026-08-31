-- 1) Avis clients : masquer l'identité des auteurs pour le public
DROP POLICY IF EXISTS avis_public_read ON public.avis_clients;

CREATE OR REPLACE VIEW public.avis_publies
WITH (security_invoker = off) AS
SELECT
  a.id,
  a.note,
  a.commentaire,
  CASE
    WHEN COALESCE(a.nom_affiche, '') = '' THEN 'Client'
    WHEN position(' ' in btrim(a.nom_affiche)) > 0
      THEN split_part(btrim(a.nom_affiche), ' ', 1) || ' ' ||
           upper(left(split_part(btrim(a.nom_affiche), ' ', 2), 1)) || '.'
    ELSE btrim(a.nom_affiche)
  END AS nom_affiche,
  a.ville,
  a.type_client,
  a.date_avis
FROM public.avis_clients a
WHERE a.statut = 'publie';

GRANT SELECT ON public.avis_publies TO anon, authenticated;

-- 2) b2b_fleet_leads : champs sensibles imposés côté serveur
CREATE OR REPLACE FUNCTION public.b2b_fleet_leads_sanitize()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)) THEN
    NEW.status := 'nouveau';
    NEW.assigned_to := NULL;
    NEW.lead_score := LEAST(GREATEST(COALESCE(NEW.lead_score, 0), 0), 100);
    IF NEW.score_category IS NULL OR NEW.score_category NOT IN ('cold','warm','hot') THEN
      NEW.score_category := 'cold';
    END IF;
    -- l'organisation ne peut jamais être choisie par le client
    NEW.organization_id := (
      SELECT p.organization_id FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS b2b_fleet_leads_sanitize_ins ON public.b2b_fleet_leads;
CREATE TRIGGER b2b_fleet_leads_sanitize_ins
BEFORE INSERT ON public.b2b_fleet_leads
FOR EACH ROW EXECUTE FUNCTION public.b2b_fleet_leads_sanitize();

-- 3) Stockage cartes grises : lecture restreinte au dossier personnel ET à un devis possédé
DROP POLICY IF EXISTS "Clients read own carte grise" ON storage.objects;
CREATE POLICY "Clients read own carte grise"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'cartes-grises'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND (
    (storage.foldername(name))[2] = 'mes-documents'
    OR EXISTS (
      SELECT 1 FROM public.devis d
      WHERE d.user_id = auth.uid()
        AND d.id::text = (storage.foldername(name))[2]
    )
  )
);

DROP POLICY IF EXISTS "Clients upload own carte grise" ON storage.objects;
CREATE POLICY "Clients upload own carte grise"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'cartes-grises'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND (
    (storage.foldername(name))[2] = 'mes-documents'
    OR EXISTS (
      SELECT 1 FROM public.devis d
      WHERE d.user_id = auth.uid()
        AND d.id::text = (storage.foldername(name))[2]
    )
  )
);