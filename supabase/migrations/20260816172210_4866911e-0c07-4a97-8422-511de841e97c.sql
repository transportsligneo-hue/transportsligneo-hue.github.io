-- 1) Identité client sur attributions : join stable (devis) au lieu du numéro texte
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
$function$;

-- 2) Plus de lecture directe de la table contrats par le convoyeur
DROP POLICY IF EXISTS "Convoyeur reads own contrat" ON public.convoyeur_contrats;

-- Fonction sécurisée : statut du contrat du convoyeur connecté, sans jeton ni IP
CREATE OR REPLACE FUNCTION public.get_my_contrat_status()
RETURNS TABLE (
  id uuid,
  statut text,
  sent_at timestamptz,
  signed_at timestamptz,
  signed_pdf_path text,
  charte_incluse boolean,
  charte_signed_at timestamptz,
  charte_signed_pdf_path text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT c.id, c.statut, c.sent_at, c.signed_at, c.signed_pdf_path,
         c.charte_incluse, c.charte_signed_at, c.charte_signed_pdf_path
  FROM public.convoyeur_contrats c
  WHERE auth.uid() IS NOT NULL AND c.user_id = auth.uid()
  ORDER BY c.created_at DESC
  LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION public.get_my_contrat_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_contrat_status() TO authenticated;