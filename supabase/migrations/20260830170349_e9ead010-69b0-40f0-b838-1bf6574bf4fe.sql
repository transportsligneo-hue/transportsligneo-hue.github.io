CREATE OR REPLACE FUNCTION public.sync_trajet_vehicle_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_devis_id uuid;
  v_demande_id uuid;
  v_is_return boolean;
BEGIN
  v_devis_id := NEW.devis_id;
  v_demande_id := NEW.demande_id;
  v_is_return := COALESCE(NEW.leg_type, '') = 'retour' OR COALESCE(NEW.leg_index, 1) = 2;

  IF v_devis_id IS NOT NULL THEN
    IF v_is_return THEN
      UPDATE public.devis
      SET marque_retour = NULLIF(trim(NEW.marque), ''),
          modele_retour = NULLIF(trim(NEW.modele), ''),
          immatriculation_retour = NULLIF(trim(COALESCE(NEW.immatriculation, NEW.vehicule_immatriculation)), ''),
          vin_retour = NULLIF(trim(COALESCE(NEW.vin, NEW.vehicule_vin)), ''),
          updated_at = now()
      WHERE id = v_devis_id
        AND ROW(marque_retour, modele_retour, immatriculation_retour, vin_retour)
          IS DISTINCT FROM ROW(
            NULLIF(trim(NEW.marque), ''),
            NULLIF(trim(NEW.modele), ''),
            NULLIF(trim(COALESCE(NEW.immatriculation, NEW.vehicule_immatriculation)), ''),
            NULLIF(trim(COALESCE(NEW.vin, NEW.vehicule_vin)), '')
          );
    ELSE
      UPDATE public.devis
      SET marque = NULLIF(trim(NEW.marque), ''),
          modele = NULLIF(trim(NEW.modele), ''),
          immatriculation = NULLIF(trim(COALESCE(NEW.immatriculation, NEW.vehicule_immatriculation)), ''),
          vin = NULLIF(trim(COALESCE(NEW.vin, NEW.vehicule_vin)), ''),
          updated_at = now()
      WHERE id = v_devis_id
        AND ROW(marque, modele, immatriculation, vin)
          IS DISTINCT FROM ROW(
            NULLIF(trim(NEW.marque), ''),
            NULLIF(trim(NEW.modele), ''),
            NULLIF(trim(COALESCE(NEW.immatriculation, NEW.vehicule_immatriculation)), ''),
            NULLIF(trim(COALESCE(NEW.vin, NEW.vehicule_vin)), '')
          );
    END IF;
  END IF;

  IF v_demande_id IS NOT NULL THEN
    IF v_is_return THEN
      UPDATE public.demandes_convoyage
      SET marque_retour = NULLIF(trim(NEW.marque), ''),
          modele_retour = NULLIF(trim(NEW.modele), ''),
          immatriculation_retour = NULLIF(trim(COALESCE(NEW.immatriculation, NEW.vehicule_immatriculation)), ''),
          vin_retour = NULLIF(trim(COALESCE(NEW.vin, NEW.vehicule_vin)), ''),
          updated_at = now()
      WHERE id = v_demande_id;
    ELSE
      UPDATE public.demandes_convoyage
      SET marque = NULLIF(trim(NEW.marque), ''),
          modele = NULLIF(trim(NEW.modele), ''),
          immatriculation = NULLIF(trim(COALESCE(NEW.immatriculation, NEW.vehicule_immatriculation)), ''),
          vehicule_marque = NULLIF(trim(NEW.marque), ''),
          vehicule_modele = NULLIF(trim(NEW.modele), ''),
          vehicule_immatriculation = NULLIF(trim(COALESCE(NEW.immatriculation, NEW.vehicule_immatriculation)), ''),
          vehicule_vin = NULLIF(trim(COALESCE(NEW.vin, NEW.vehicule_vin)), ''),
          updated_at = now()
      WHERE id = v_demande_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_trajet_vehicle_identity_trigger ON public.trajets;
CREATE TRIGGER sync_trajet_vehicle_identity_trigger
AFTER INSERT OR UPDATE OF marque, modele, immatriculation, vin, vehicule_immatriculation, vehicule_vin, leg_type, leg_index
ON public.trajets
FOR EACH ROW
EXECUTE FUNCTION public.sync_trajet_vehicle_identity();

REVOKE ALL ON FUNCTION public.sync_trajet_vehicle_identity() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_trajet_vehicle_identity() FROM anon;
REVOKE ALL ON FUNCTION public.sync_trajet_vehicle_identity() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.sync_trajet_vehicle_identity() TO service_role;

WITH matched_request AS (
  SELECT DISTINCT ON (dv.id)
    dv.id AS devis_id,
    dc.id AS demande_id,
    COALESCE(NULLIF(trim(dc.vehicule_marque), ''), NULLIF(trim(dc.marque), '')) AS marque_aller,
    COALESCE(NULLIF(trim(dc.vehicule_modele), ''), NULLIF(trim(dc.modele), '')) AS modele_aller,
    COALESCE(NULLIF(trim(dc.vehicule_immatriculation), ''), NULLIF(trim(dc.immatriculation), '')) AS plaque_aller,
    NULLIF(trim(dc.vehicule_vin), '') AS vin_aller,
    NULLIF(trim(dc.marque_retour), '') AS marque_retour,
    NULLIF(trim(dc.modele_retour), '') AS modele_retour,
    NULLIF(trim(dc.immatriculation_retour), '') AS plaque_retour,
    NULLIF(trim(dc.vin_retour), '') AS vin_retour
  FROM public.devis dv
  JOIN public.demandes_convoyage dc
    ON dc.id = dv.demande_id
    OR (
      dv.demande_id IS NULL
      AND regexp_replace(upper(COALESCE(dc.vehicule_immatriculation, dc.immatriculation, '')), '[^A-Z0-9]', '', 'g') <> ''
      AND regexp_replace(upper(COALESCE(dc.vehicule_immatriculation, dc.immatriculation, '')), '[^A-Z0-9]', '', 'g') =
          regexp_replace(upper(COALESCE(dv.immatriculation, '')), '[^A-Z0-9]', '', 'g')
    )
  WHERE NULLIF(trim(COALESCE(dc.immatriculation_retour, '')), '') IS NOT NULL
  ORDER BY dv.id, CASE WHEN dc.id = dv.demande_id THEN 0 ELSE 1 END, dc.created_at DESC
)
UPDATE public.devis dv
SET demande_id = COALESCE(dv.demande_id, mr.demande_id),
    marque = COALESCE(mr.marque_aller, dv.marque),
    modele = COALESCE(mr.modele_aller, dv.modele),
    immatriculation = COALESCE(mr.plaque_aller, dv.immatriculation),
    vin = COALESCE(mr.vin_aller, dv.vin),
    marque_retour = COALESCE(mr.marque_retour, dv.marque_retour),
    modele_retour = COALESCE(mr.modele_retour, dv.modele_retour),
    immatriculation_retour = COALESCE(mr.plaque_retour, dv.immatriculation_retour),
    vin_retour = COALESCE(mr.vin_retour, dv.vin_retour),
    updated_at = now()
FROM matched_request mr
WHERE dv.id = mr.devis_id;

WITH return_leg AS (
  SELECT DISTINCT ON (devis_id)
    devis_id,
    NULLIF(trim(marque), '') AS marque,
    NULLIF(trim(modele), '') AS modele,
    NULLIF(trim(COALESCE(immatriculation, vehicule_immatriculation)), '') AS plaque,
    NULLIF(trim(COALESCE(vin, vehicule_vin)), '') AS vin
  FROM public.trajets
  WHERE devis_id IS NOT NULL
    AND (leg_type = 'retour' OR leg_index = 2)
    AND NULLIF(trim(COALESCE(immatriculation, vehicule_immatriculation, '')), '') IS NOT NULL
  ORDER BY devis_id, updated_at DESC NULLS LAST, created_at DESC
)
UPDATE public.devis dv
SET marque_retour = COALESCE(rl.marque, dv.marque_retour),
    modele_retour = COALESCE(rl.modele, dv.modele_retour),
    immatriculation_retour = COALESCE(rl.plaque, dv.immatriculation_retour),
    vin_retour = COALESCE(rl.vin, dv.vin_retour),
    updated_at = now()
FROM return_leg rl
WHERE dv.id = rl.devis_id
  AND regexp_replace(upper(COALESCE(rl.plaque, '')), '[^A-Z0-9]', '', 'g') <>
      regexp_replace(upper(COALESCE(dv.immatriculation, '')), '[^A-Z0-9]', '', 'g')
  AND NOT EXISTS (SELECT 1 FROM public.demandes_convoyage dc WHERE dc.id = dv.demande_id AND NULLIF(trim(COALESCE(dc.immatriculation_retour, '')), '') IS NOT NULL);

UPDATE public.trajets t
SET marque = CASE WHEN t.leg_type = 'retour' OR t.leg_index = 2 THEN dv.marque_retour ELSE dv.marque END,
    modele = CASE WHEN t.leg_type = 'retour' OR t.leg_index = 2 THEN dv.modele_retour ELSE dv.modele END,
    immatriculation = CASE WHEN t.leg_type = 'retour' OR t.leg_index = 2 THEN dv.immatriculation_retour ELSE dv.immatriculation END,
    vehicule_immatriculation = CASE WHEN t.leg_type = 'retour' OR t.leg_index = 2 THEN dv.immatriculation_retour ELSE dv.immatriculation END,
    vin = CASE WHEN t.leg_type = 'retour' OR t.leg_index = 2 THEN dv.vin_retour ELSE dv.vin END,
    vehicule_vin = CASE WHEN t.leg_type = 'retour' OR t.leg_index = 2 THEN dv.vin_retour ELSE dv.vin END,
    updated_at = now()
FROM public.devis dv
WHERE t.devis_id = dv.id
  AND COALESCE(t.leg_type, 'simple') IN ('aller', 'retour', 'simple')
  AND NOT (dv.vehicules IS NOT NULL AND jsonb_typeof(dv.vehicules) = 'array' AND jsonb_array_length(dv.vehicules) > 1)
  AND ROW(t.marque, t.modele, t.immatriculation, t.vin)
      IS DISTINCT FROM ROW(
        CASE WHEN t.leg_type = 'retour' OR t.leg_index = 2 THEN dv.marque_retour ELSE dv.marque END,
        CASE WHEN t.leg_type = 'retour' OR t.leg_index = 2 THEN dv.modele_retour ELSE dv.modele END,
        CASE WHEN t.leg_type = 'retour' OR t.leg_index = 2 THEN dv.immatriculation_retour ELSE dv.immatriculation END,
        CASE WHEN t.leg_type = 'retour' OR t.leg_index = 2 THEN dv.vin_retour ELSE dv.vin END
      );

UPDATE public.missions m
SET marque = CASE WHEN m.leg_type = 'retour' OR m.leg_index = 2 THEN dv.marque_retour ELSE dv.marque END,
    modele = CASE WHEN m.leg_type = 'retour' OR m.leg_index = 2 THEN dv.modele_retour ELSE dv.modele END,
    immatriculation = CASE WHEN m.leg_type = 'retour' OR m.leg_index = 2 THEN dv.immatriculation_retour ELSE dv.immatriculation END,
    vin = CASE WHEN m.leg_type = 'retour' OR m.leg_index = 2 THEN dv.vin_retour ELSE dv.vin END,
    updated_at = now()
FROM public.devis dv
WHERE m.devis_id = dv.id
  AND COALESCE(m.leg_type, 'simple') IN ('aller', 'retour', 'simple')
  AND NOT (dv.vehicules IS NOT NULL AND jsonb_typeof(dv.vehicules) = 'array' AND jsonb_array_length(dv.vehicules) > 1)
  AND ROW(m.marque, m.modele, m.immatriculation, m.vin)
      IS DISTINCT FROM ROW(
        CASE WHEN m.leg_type = 'retour' OR m.leg_index = 2 THEN dv.marque_retour ELSE dv.marque END,
        CASE WHEN m.leg_type = 'retour' OR m.leg_index = 2 THEN dv.modele_retour ELSE dv.modele END,
        CASE WHEN m.leg_type = 'retour' OR m.leg_index = 2 THEN dv.immatriculation_retour ELSE dv.immatriculation END,
        CASE WHEN m.leg_type = 'retour' OR m.leg_index = 2 THEN dv.vin_retour ELSE dv.vin END
      );