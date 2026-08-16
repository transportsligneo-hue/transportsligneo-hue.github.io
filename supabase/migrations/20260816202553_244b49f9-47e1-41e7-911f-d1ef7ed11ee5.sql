CREATE OR REPLACE FUNCTION public.sync_legacy_mission_from_trajet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mapped_status text;
BEGIN
  mapped_status := CASE NEW.statut
    WHEN 'termine' THEN 'terminee'
    WHEN 'validee' THEN 'terminee'
    WHEN 'livre' THEN 'livree'
    WHEN 'annule' THEN 'annulee'
    WHEN 'attribue' THEN 'confirmee'
    WHEN 'en_route' THEN 'en_cours'
    ELSE NEW.statut
  END;

  UPDATE public.missions m
  SET statut = mapped_status,
      prix_total = COALESCE(NEW.prix_client, NEW.prix_total, m.prix_total),
      updated_at = now()
  WHERE
    (NEW.devis_id IS NOT NULL AND m.devis_id = NEW.devis_id)
    OR (
      m.devis_id IS NULL
      AND lower(COALESCE(m.email, '')) = lower(COALESCE(NEW.client_email, ''))
      AND m.ville_depart = NEW.depart
      AND m.ville_arrivee = NEW.arrivee
      AND abs(extract(epoch FROM (m.created_at - NEW.created_at))) < 2
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_legacy_mission_from_trajet ON public.trajets;
CREATE TRIGGER trg_sync_legacy_mission_from_trajet
AFTER INSERT OR UPDATE OF statut, prix_client, prix_total ON public.trajets
FOR EACH ROW
EXECUTE FUNCTION public.sync_legacy_mission_from_trajet();