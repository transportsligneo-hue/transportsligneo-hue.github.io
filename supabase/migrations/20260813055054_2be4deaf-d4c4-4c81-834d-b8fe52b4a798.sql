CREATE OR REPLACE FUNCTION public.devis_is_aller_retour(_option text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT lower(unaccent_placeholder) IN ('aller_retour','aller-retour','aller retour')
      OR lower(unaccent_placeholder) LIKE '%livraison%restitution%'
  FROM (SELECT COALESCE(_option,'') AS unaccent_placeholder) s;
$$;