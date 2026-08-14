ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS prix_manuel boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.devis_apply_client_pricing()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_aller_rule uuid;
  v_aller_prix numeric;
  v_retour_rule uuid;
  v_retour_prix numeric;
  v_is_ar boolean;
BEGIN
  IF NEW.paid_at IS NOT NULL THEN RETURN NEW; END IF;

  v_is_ar := (NEW.depart_retour IS NOT NULL AND length(trim(NEW.depart_retour)) > 0);

  -- Prix saisi manuellement (admin) : on ne recalcule jamais
  IF COALESCE(NEW.prix_manuel, false) THEN
    IF NEW.prix_aller IS NULL THEN
      NEW.prix_aller := CASE WHEN v_is_ar THEN NULL ELSE NEW.prix_estime END;
    END IF;
    RETURN NEW;
  END IF;

  SELECT prix_aller, prix_retour, rule_id_aller, rule_id_retour
    INTO v_aller_prix, v_retour_prix, v_aller_rule, v_retour_rule
  FROM public.resolve_client_pricing_split(NEW.user_id, NEW.email, NEW.depart, NEW.arrivee, NEW.depart_retour);

  IF v_aller_rule IS NOT NULL AND v_aller_prix IS NOT NULL THEN
    NEW.prix_aller := v_aller_prix;
    NEW.client_pricing_rule_id := v_aller_rule;
    IF v_is_ar AND v_retour_prix IS NOT NULL THEN
      NEW.prix_retour := v_retour_prix;
      NEW.prix_estime := v_aller_prix + v_retour_prix;
    ELSE
      NEW.prix_retour := COALESCE(NEW.prix_retour, 0);
      NEW.prix_estime := v_aller_prix;
    END IF;
  ELSE
    IF NEW.prix_aller IS NULL THEN NEW.prix_aller := NEW.prix_estime; END IF;
    IF NEW.prix_retour IS NULL THEN NEW.prix_retour := 0; END IF;
    IF v_is_ar AND (NEW.prix_estime IS NULL OR NEW.prix_estime = 0) THEN
      NEW.prix_estime := COALESCE(NEW.prix_aller, 0) + COALESCE(NEW.prix_retour, 0);
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;