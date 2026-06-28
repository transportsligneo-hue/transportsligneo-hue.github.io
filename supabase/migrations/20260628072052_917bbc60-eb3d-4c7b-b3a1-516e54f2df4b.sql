
-- Fonction de re-application des tarifs sur devis & demandes non payés
CREATE OR REPLACE FUNCTION public.reapply_client_pricing_on_rule_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rule_id uuid;
  v_prix numeric;
  d record;
  dm record;
BEGIN
  -- Recalcule pour chaque devis non payé attribuable à la nouvelle/maj règle
  FOR d IN
    SELECT id, user_id, email, depart, arrivee
    FROM public.devis
    WHERE paid_at IS NULL
      AND (
        (NEW.client_user_id IS NOT NULL AND user_id = NEW.client_user_id)
        OR (NEW.client_email IS NOT NULL AND lower(email) = lower(NEW.client_email))
        OR (NEW.client_user_id IS NULL AND NEW.client_email IS NULL)
      )
  LOOP
    SELECT rule_id, prix_ttc INTO v_rule_id, v_prix
      FROM public.resolve_client_pricing_rule(d.user_id, d.email, d.depart, d.arrivee, false);
    IF v_rule_id IS NOT NULL AND v_prix IS NOT NULL THEN
      UPDATE public.devis
        SET prix_estime = v_prix,
            client_pricing_rule_id = v_rule_id,
            updated_at = now()
        WHERE id = d.id;
    END IF;
  END LOOP;

  -- Recalcule pour chaque demande de convoyage non payée
  FOR dm IN
    SELECT id, user_id, email, depart, arrivee,
      (depart_retour IS NOT NULL AND length(trim(depart_retour)) > 0) AS is_ar
    FROM public.demandes_convoyage
    WHERE COALESCE(payment_status,'') <> 'paid'
      AND (
        (NEW.client_user_id IS NOT NULL AND user_id = NEW.client_user_id)
        OR (NEW.client_email IS NOT NULL AND lower(email) = lower(NEW.client_email))
        OR (NEW.client_user_id IS NULL AND NEW.client_email IS NULL)
      )
  LOOP
    SELECT rule_id, prix_ttc INTO v_rule_id, v_prix
      FROM public.resolve_client_pricing_rule(dm.user_id, dm.email, dm.depart, dm.arrivee, dm.is_ar);
    IF v_rule_id IS NOT NULL AND v_prix IS NOT NULL THEN
      UPDATE public.demandes_convoyage
        SET prix_estime = v_prix,
            client_pricing_rule_id = v_rule_id,
            updated_at = now()
        WHERE id = dm.id;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reapply_client_pricing ON public.client_pricing_rules;
CREATE TRIGGER trg_reapply_client_pricing
AFTER INSERT OR UPDATE ON public.client_pricing_rules
FOR EACH ROW
EXECUTE FUNCTION public.reapply_client_pricing_on_rule_change();
