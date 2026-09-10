CREATE OR REPLACE FUNCTION public.sync_mission_from_trajet()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _mission_id uuid;
  _prev text;
BEGIN
  SELECT m.id INTO _mission_id
  FROM public.missions m
  WHERE (NEW.mission_id IS NOT NULL AND m.id = NEW.mission_id)
     OR (NEW.numero_mission IS NOT NULL
         AND m.numero = NEW.numero_mission
         AND coalesce(m.leg_type,'simple') = coalesce(NEW.leg_type,'simple'))
  ORDER BY (NEW.mission_id IS NOT NULL AND m.id = NEW.mission_id) DESC
  LIMIT 1;

  IF _mission_id IS NULL THEN
    RETURN NEW;
  END IF;

  _prev := coalesce(current_setting('app.normalizing_group', true), '0');
  PERFORM set_config('app.normalizing_group', '1', true);

  UPDATE public.missions m
     SET statut = public.map_trajet_statut_to_mission(NEW.statut),
         immatriculation = coalesce(nullif(m.immatriculation,''), nullif(NEW.immatriculation,''), nullif(NEW.vehicule_immatriculation,'')),
         vin = coalesce(nullif(m.vin,''), nullif(NEW.vin,''), nullif(NEW.vehicule_vin,'')),
         carburant = coalesce(nullif(m.carburant,''), nullif(NEW.vehicule_energie,'')),
         marque = coalesce(nullif(m.marque,''), nullif(NEW.marque,'')),
         modele = coalesce(nullif(m.modele,''), nullif(NEW.modele,'')),
         date_prise_en_charge = coalesce(NEW.date_trajet, m.date_prise_en_charge),
         heure_prise_en_charge = coalesce(nullif(NEW.heure_trajet::text,''), m.heure_prise_en_charge),
         ville_depart = coalesce(nullif(NEW.depart,''), m.ville_depart),
         ville_arrivee = coalesce(nullif(NEW.arrivee,''), m.ville_arrivee),
         contact_depart_nom = coalesce(nullif(NEW.contact_depart_nom,''), m.contact_depart_nom),
         contact_depart_tel = coalesce(nullif(NEW.contact_depart_tel,''), m.contact_depart_tel),
         contact_depart_note = coalesce(nullif(NEW.contact_depart_note,''), m.contact_depart_note),
         contact_arrivee_nom = coalesce(nullif(NEW.contact_arrivee_nom,''), nullif(NEW.arrivee_contact_nom,''), m.contact_arrivee_nom),
         contact_arrivee_tel = coalesce(nullif(NEW.contact_arrivee_tel,''), nullif(NEW.arrivee_contact_telephone,''), m.contact_arrivee_tel),
         contact_arrivee_note = coalesce(nullif(NEW.contact_arrivee_note,''), nullif(NEW.arrivee_contact_instructions,''), m.contact_arrivee_note),
         updated_at = now()
   WHERE m.id = _mission_id;

  PERFORM set_config('app.normalizing_group', _prev, true);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_mission_from_trajet ON public.trajets;
CREATE TRIGGER trg_sync_mission_from_trajet
AFTER INSERT OR UPDATE OF statut, immatriculation, vehicule_immatriculation, vin, vehicule_vin,
  vehicule_energie, marque, modele, mission_id, numero_mission,
  date_trajet, heure_trajet, depart, arrivee,
  contact_depart_nom, contact_depart_tel, contact_depart_note,
  contact_arrivee_nom, contact_arrivee_tel, contact_arrivee_note,
  arrivee_contact_nom, arrivee_contact_telephone, arrivee_contact_instructions
ON public.trajets
FOR EACH ROW EXECUTE FUNCTION public.sync_mission_from_trajet();

-- Réaligne les missions existantes sur la fiche d'exploitation (date / heure)
UPDATE public.missions m
   SET date_prise_en_charge = t.date_trajet,
       heure_prise_en_charge = coalesce(nullif(t.heure_trajet::text,''), m.heure_prise_en_charge),
       updated_at = now()
  FROM public.trajets t
 WHERE (t.mission_id = m.id
        OR (t.numero_mission IS NOT NULL AND t.numero_mission = m.numero
            AND coalesce(t.leg_type,'simple') = coalesce(m.leg_type,'simple')))
   AND t.date_trajet IS NOT NULL
   AND t.date_trajet IS DISTINCT FROM m.date_prise_en_charge;