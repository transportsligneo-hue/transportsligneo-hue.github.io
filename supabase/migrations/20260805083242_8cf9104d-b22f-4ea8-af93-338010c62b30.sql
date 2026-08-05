
-- 1) attributions : verrouiller les colonnes administratives pour les convoyeurs
CREATE OR REPLACE FUNCTION public.attributions_protect_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) THEN
    RETURN NEW;
  END IF;

  -- Champs strictement administratifs
  NEW.is_public        := OLD.is_public;
  NEW.mode             := OLD.mode;
  NEW.pdf_share_client := OLD.pdf_share_client;
  NEW.trajet_id        := OLD.trajet_id;
  NEW.convoyeur_id     := OLD.convoyeur_id;
  NEW.numero_mission   := OLD.numero_mission;

  -- Réponse du convoyeur : uniquement depuis 'en_attente' vers 'accepte'/'refuse'
  IF NEW.statut_convoyeur IS DISTINCT FROM OLD.statut_convoyeur THEN
    IF OLD.statut_convoyeur IS DISTINCT FROM 'en_attente'
       OR NEW.statut_convoyeur NOT IN ('accepte', 'refuse') THEN
      NEW.statut_convoyeur := OLD.statut_convoyeur;
      NEW.repondu_at       := OLD.repondu_at;
      NEW.refus_motif      := OLD.refus_motif;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_attributions_protect_admin_fields ON public.attributions;
CREATE TRIGGER trg_attributions_protect_admin_fields
BEFORE UPDATE ON public.attributions
FOR EACH ROW EXECUTE FUNCTION public.attributions_protect_admin_fields();

-- 2) mission_offres : empêcher l'auto-sélection et la manipulation de prix admin
CREATE OR REPLACE FUNCTION public.mission_offres_protect_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) THEN
    RETURN NEW;
  END IF;

  NEW.is_winning             := OLD.is_winning;
  NEW.admin_counter_offer    := OLD.admin_counter_offer;
  NEW.admin_counter_at       := OLD.admin_counter_at;
  NEW.admin_counter_by       := OLD.admin_counter_by;
  NEW.prix_suggere_snapshot  := OLD.prix_suggere_snapshot;
  NEW.trajet_id              := OLD.trajet_id;
  NEW.convoyeur_id           := OLD.convoyeur_id;
  NEW.statut                 := OLD.statut;
  NEW.bid_round              := OLD.bid_round;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mission_offres_protect_admin_fields ON public.mission_offres;
CREATE TRIGGER trg_mission_offres_protect_admin_fields
BEFORE UPDATE ON public.mission_offres
FOR EACH ROW EXECUTE FUNCTION public.mission_offres_protect_admin_fields();
