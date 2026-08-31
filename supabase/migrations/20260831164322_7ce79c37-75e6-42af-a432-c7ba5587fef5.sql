DROP VIEW IF EXISTS public.avis_publies;

ALTER TABLE public.avis_clients
  ADD COLUMN IF NOT EXISTS nom_affiche_public text
  GENERATED ALWAYS AS (
    CASE
      WHEN COALESCE(nom_affiche, '') = '' THEN 'Client'
      WHEN position(' ' in btrim(nom_affiche)) > 0
        THEN split_part(btrim(nom_affiche), ' ', 1) || ' ' ||
             upper(left(split_part(btrim(nom_affiche), ' ', 2), 1)) || '.'
      ELSE btrim(nom_affiche)
    END
  ) STORED;

CREATE POLICY avis_public_read ON public.avis_clients
FOR SELECT TO anon, authenticated
USING (statut = 'publie');

REVOKE SELECT ON public.avis_clients FROM anon, authenticated;
GRANT SELECT (id, note, commentaire, nom_affiche_public, ville, type_client, date_avis, statut)
  ON public.avis_clients TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.avis_clients TO authenticated;
REVOKE SELECT ON public.avis_clients FROM authenticated;
GRANT SELECT (id, note, commentaire, nom_affiche_public, ville, type_client, date_avis, statut)
  ON public.avis_clients TO authenticated;
GRANT ALL ON public.avis_clients TO service_role;