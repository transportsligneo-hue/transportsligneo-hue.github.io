GRANT SELECT, INSERT, UPDATE, DELETE ON public.avis_clients TO authenticated;
REVOKE SELECT ON public.avis_clients FROM anon;
GRANT SELECT (id, note, commentaire, nom_affiche_public, ville, type_client, date_avis, statut)
  ON public.avis_clients TO anon;