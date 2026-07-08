
-- 1. Nouvelles colonnes devis
ALTER TABLE public.devis
  ADD COLUMN IF NOT EXISTS prix_aller numeric,
  ADD COLUMN IF NOT EXISTS prix_retour numeric,
  ADD COLUMN IF NOT EXISTS mission_group_id uuid;

CREATE INDEX IF NOT EXISTS devis_mission_group_id_idx ON public.devis(mission_group_id);

-- 2. Group id sur demandes_convoyage
ALTER TABLE public.demandes_convoyage
  ADD COLUMN IF NOT EXISTS mission_group_id uuid;

CREATE INDEX IF NOT EXISTS demandes_convoyage_mission_group_id_idx ON public.demandes_convoyage(mission_group_id);

-- 3. Fonction de résolution split aller / retour
CREATE OR REPLACE FUNCTION public.resolve_client_pricing_split(
  _user_id uuid,
  _email text,
  _depart text,
  _arrivee text,
  _depart_retour text
)
RETURNS TABLE(prix_aller numeric, prix_retour numeric, rule_id_aller uuid, rule_id_retour uuid)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_aller_rule uuid;
  v_aller_prix numeric;
  v_retour_rule uuid;
  v_retour_prix numeric;
  v_retour_dep text;
  v_retour_arr text;
BEGIN
  SELECT rule_id, prix_ttc INTO v_aller_rule, v_aller_prix
  FROM public.resolve_client_pricing_rule(_user_id, _email, _depart, _arrivee, false);

  IF _depart_retour IS NOT NULL AND length(trim(_depart_retour)) > 0 THEN
    v_retour_dep := _depart_retour;
    v_retour_arr := _depart;
    SELECT rule_id, prix_ttc INTO v_retour_rule, v_retour_prix
    FROM public.resolve_client_pricing_rule(_user_id, _email, v_retour_dep, v_retour_arr, false);
  END IF;

  prix_aller := v_aller_prix;
  prix_retour := v_retour_prix;
  rule_id_aller := v_aller_rule;
  rule_id_retour := v_retour_rule;
  RETURN NEXT;
END;
$function$;

-- 4. Backfill : devis sans retour
UPDATE public.devis
   SET prix_aller = COALESCE(prix_aller, prix_estime),
       prix_retour = COALESCE(prix_retour, 0)
 WHERE (depart_retour IS NULL OR length(trim(depart_retour)) = 0)
   AND (prix_aller IS NULL OR prix_retour IS NULL);

-- 5. Backfill : devis avec retour — recalcul par grille tarifaire
DO $$
DECLARE
  d record;
  v_aller numeric;
  v_retour numeric;
BEGIN
  FOR d IN
    SELECT id, user_id, email, depart, arrivee, depart_retour, prix_estime
    FROM public.devis
    WHERE depart_retour IS NOT NULL AND length(trim(depart_retour)) > 0
      AND (prix_aller IS NULL OR prix_retour IS NULL)
  LOOP
    SELECT prix_aller, prix_retour INTO v_aller, v_retour
    FROM public.resolve_client_pricing_split(d.user_id, d.email, d.depart, d.arrivee, d.depart_retour);

    v_aller := COALESCE(v_aller, d.prix_estime, 0);
    v_retour := COALESCE(v_retour, 0);

    UPDATE public.devis
       SET prix_aller = v_aller,
           prix_retour = v_retour,
           prix_estime = CASE
             WHEN v_retour > 0 THEN v_aller + v_retour
             ELSE COALESCE(prix_estime, v_aller)
           END,
           updated_at = now()
     WHERE id = d.id;
  END LOOP;
END $$;

-- 6. Trigger pricing devis : conserver le total = aller + retour
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
    -- Pas de règle : on garde prix_estime saisi mais on remplit aller/retour cohérents
    IF NEW.prix_aller IS NULL THEN NEW.prix_aller := NEW.prix_estime; END IF;
    IF NEW.prix_retour IS NULL THEN NEW.prix_retour := 0; END IF;
    IF v_is_ar AND (NEW.prix_estime IS NULL OR NEW.prix_estime = 0) THEN
      NEW.prix_estime := COALESCE(NEW.prix_aller, 0) + COALESCE(NEW.prix_retour, 0);
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 7. Trigger création trajets/missions depuis devis payé : utiliser prix_retour
CREATE OR REPLACE FUNCTION public.auto_create_trajet_from_devis()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_existing uuid;
  v_livraison_id uuid;
  v_is_ar boolean;
  v_group uuid;
  v_prix_aller numeric;
  v_prix_retour numeric;
BEGIN
  IF NEW.paid_at IS NOT NULL AND (OLD.paid_at IS NULL OR OLD IS NULL) THEN
    SELECT id INTO v_existing FROM public.trajets WHERE devis_id = NEW.id LIMIT 1;
    IF v_existing IS NULL THEN
      v_is_ar := (NEW.depart_retour IS NOT NULL AND length(trim(NEW.depart_retour)) > 0);
      v_group := COALESCE(NEW.mission_group_id, gen_random_uuid());

      v_prix_aller := COALESCE(NEW.prix_aller, NEW.prix_estime, 0);
      v_prix_retour := COALESCE(NEW.prix_retour, 0);
      IF v_is_ar AND v_prix_retour = 0 AND v_prix_aller > 0 AND NEW.prix_estime > v_prix_aller THEN
        v_prix_retour := NEW.prix_estime - v_prix_aller;
      END IF;

      -- Marque le devis avec le group id
      UPDATE public.devis SET mission_group_id = v_group WHERE id = NEW.id;

      INSERT INTO public.trajets (
        devis_id, depart, arrivee, date_trajet, heure_trajet,
        marque, modele, client_nom, client_email, client_telephone,
        prix_client, prix, commission_convoyeur_pct,
        statut, statut_publication, pricing_mode,
        vin, carte_grise_recto_url, carte_grise_verso_url,
        contact_depart_nom, contact_depart_tel, contact_depart_note,
        contact_arrivee_nom, contact_arrivee_tel, contact_arrivee_note,
        type_mission, commande_ref,
        mission_group_id, leg_type, leg_index
      ) VALUES (
        NEW.id, NEW.depart, NEW.arrivee, NEW.date_souhaitee, COALESCE(NEW.heure_souhaitee, ''),
        COALESCE(NEW.marque, ''), COALESCE(NEW.modele, ''),
        TRIM(NEW.prenom || ' ' || NEW.nom), NEW.email, COALESCE(NEW.telephone, ''),
        v_prix_aller, v_prix_aller, 65,
        'en_attente', 'brouillon', 'fixe',
        NEW.vin, NEW.carte_grise_recto_url, NEW.carte_grise_verso_url,
        NEW.contact_depart_nom, NEW.contact_depart_tel, NEW.contact_depart_note,
        NEW.contact_arrivee_nom, NEW.contact_arrivee_tel, NEW.contact_arrivee_note,
        'livraison', NEW.numero,
        v_group,
        CASE WHEN v_is_ar THEN 'aller' ELSE 'simple' END,
        1
      ) RETURNING id INTO v_livraison_id;

      IF v_is_ar THEN
        INSERT INTO public.trajets (
          devis_id, depart, arrivee, date_trajet, heure_trajet,
          marque, modele, client_nom, client_email, client_telephone,
          prix_client, prix, commission_convoyeur_pct,
          statut, statut_publication, pricing_mode,
          vin,
          contact_depart_nom, contact_depart_tel, contact_depart_note,
          contact_arrivee_nom, contact_arrivee_tel, contact_arrivee_note,
          type_mission, commande_ref, parent_trajet_id, immatriculation,
          mission_group_id, leg_type, leg_index
        ) VALUES (
          NEW.id,
          CASE
            WHEN COALESCE(NEW.recuperation_retour_identique, true) THEN NEW.arrivee
            ELSE COALESCE(NULLIF(trim(COALESCE(NEW.adresse_recuperation_retour, '')), ''), NEW.depart_retour)
          END,
          COALESCE(NULLIF(trim(COALESCE(NEW.arrivee_retour, '')), ''), NEW.depart),
          COALESCE(NEW.date_retour, NEW.date_souhaitee), COALESCE(NEW.heure_retour, ''),
          COALESCE(NEW.marque_retour, NEW.marque, ''), COALESCE(NEW.modele_retour, NEW.modele, ''),
          TRIM(NEW.prenom || ' ' || NEW.nom), NEW.email, COALESCE(NEW.telephone, ''),
          v_prix_retour, v_prix_retour, 65,
          CASE WHEN NEW.date_retour IS NOT NULL THEN 'en_attente' ELSE 'en_attente_planification' END,
          'brouillon', 'fixe',
          NEW.vin_retour,
          NEW.contact_arrivee_nom, NEW.contact_arrivee_tel, NEW.contact_arrivee_note,
          NEW.contact_depart_nom, NEW.contact_depart_tel, NEW.contact_depart_note,
          'restitution', NEW.numero, v_livraison_id, NEW.immatriculation_retour,
          v_group, 'retour', 2
        );
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
