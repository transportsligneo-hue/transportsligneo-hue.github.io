
-- 1) devis_otp_challenges : aucune écriture client possible
REVOKE ALL ON public.devis_otp_challenges FROM anon;
REVOKE ALL ON public.devis_otp_challenges FROM authenticated;
GRANT SELECT ON public.devis_otp_challenges TO authenticated; -- lecture admin via RLS
GRANT ALL ON public.devis_otp_challenges TO service_role;

-- 2) trajets : pas d'accès anon, marge documentée comme interne
REVOKE ALL ON public.trajets FROM anon;
COMMENT ON COLUMN public.trajets.prix_convoyeur IS 'INTERNE - marge : ne jamais exposer via une policy client, utiliser la vue trajets_safe';
COMMENT ON COLUMN public.trajets.prix_societe IS 'INTERNE - marge : ne jamais exposer via une policy client, utiliser la vue trajets_safe';
COMMENT ON COLUMN public.trajets.commission_convoyeur_pct IS 'INTERNE - marge : ne jamais exposer via une policy client, utiliser la vue trajets_safe';
