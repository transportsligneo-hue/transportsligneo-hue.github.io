CREATE OR REPLACE FUNCTION public.calc_prix_trajet()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Le prix affiché (prix) suit toujours le prix client lorsqu'il change
  IF NEW.prix_client IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.prix_client IS DISTINCT FROM OLD.prix_client) THEN
    NEW.prix := NEW.prix_client;
  END IF;

  IF NEW.prix_client IS NOT NULL AND NEW.commission_convoyeur_pct IS NOT NULL THEN
    NEW.prix_convoyeur := ROUND(NEW.prix_client * NEW.commission_convoyeur_pct / 100, 2);
    NEW.prix_societe := ROUND(NEW.prix_client - NEW.prix_convoyeur, 2);
    IF NEW.prix IS NULL THEN NEW.prix := NEW.prix_client; END IF;
    IF NEW.tarif_convoyeur IS NULL THEN NEW.tarif_convoyeur := NEW.prix_convoyeur; END IF;
  END IF;

  IF NEW.statut_publication = 'publie' AND (OLD IS NULL OR OLD.statut_publication IS DISTINCT FROM 'publie') THEN
    NEW.published_at := now();
  END IF;

  RETURN NEW;
END;
$function$;