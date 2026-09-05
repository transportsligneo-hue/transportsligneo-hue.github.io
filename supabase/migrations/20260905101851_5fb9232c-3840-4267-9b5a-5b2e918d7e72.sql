CREATE OR REPLACE FUNCTION public.sync_missions_from_devis(_devis_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  d record;
BEGIN
  SELECT * INTO d FROM public.devis WHERE id = _devis_id;
  IF d.id IS NULL THEN RETURN; END IF;

  UPDATE public.missions m SET
    ville_depart = CASE
      WHEN m.leg_type = 'retour' THEN COALESCE(NULLIF(d.depart_retour, ''), NULLIF(d.arrivee, ''), m.ville_depart)
      ELSE COALESCE(NULLIF(d.depart, ''), m.ville_depart) END,
    ville_arrivee = CASE
      WHEN m.leg_type = 'retour' THEN COALESCE(NULLIF(d.arrivee_retour, ''), NULLIF(d.depart, ''), m.ville_arrivee)
      ELSE COALESCE(NULLIF(d.arrivee, ''), m.ville_arrivee) END,
    date_prise_en_charge = CASE
      WHEN m.leg_type = 'retour' THEN COALESCE(d.date_retour, d.date_souhaitee, m.date_prise_en_charge)
      ELSE COALESCE(d.date_souhaitee, m.date_prise_en_charge) END,
    heure_prise_en_charge = CASE
      WHEN m.leg_type = 'retour' THEN COALESCE(NULLIF(d.heure_retour::text, ''), m.heure_prise_en_charge)
      ELSE COALESCE(NULLIF(d.heure_souhaitee::text, ''), m.heure_prise_en_charge) END,
    contact_depart_nom = COALESCE(NULLIF(d.contact_depart_nom, ''), m.contact_depart_nom),
    contact_depart_tel = COALESCE(NULLIF(d.contact_depart_tel, ''), m.contact_depart_tel),
    contact_depart_note = COALESCE(NULLIF(d.contact_depart_note, ''), m.contact_depart_note),
    contact_arrivee_nom = COALESCE(NULLIF(d.contact_arrivee_nom, ''), m.contact_arrivee_nom),
    contact_arrivee_tel = COALESCE(NULLIF(d.contact_arrivee_tel, ''), m.contact_arrivee_tel),
    contact_arrivee_note = COALESCE(NULLIF(d.contact_arrivee_note, ''), m.contact_arrivee_note),
    prix_total = CASE
      WHEN COALESCE(m.prix_locked, false) = false
           AND d.prix_estime IS NOT NULL AND d.prix_estime > 0
           AND (SELECT count(*) FROM public.missions x WHERE x.devis_id = d.id) = 1
      THEN d.prix_estime ELSE m.prix_total END,
    updated_at = now()
  WHERE m.devis_id = d.id
    AND m.statut NOT IN ('annulee', 'terminee', 'livree');
END;
$function$;

REVOKE ALL ON FUNCTION public.sync_missions_from_devis(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_missions_from_devis(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.devis_missions_propagate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.prix_estime IS DISTINCT FROM OLD.prix_estime
     OR NEW.depart IS DISTINCT FROM OLD.depart
     OR NEW.arrivee IS DISTINCT FROM OLD.arrivee
     OR NEW.depart_retour IS DISTINCT FROM OLD.depart_retour
     OR NEW.arrivee_retour IS DISTINCT FROM OLD.arrivee_retour
     OR NEW.date_souhaitee IS DISTINCT FROM OLD.date_souhaitee
     OR NEW.heure_souhaitee IS DISTINCT FROM OLD.heure_souhaitee
     OR NEW.date_retour IS DISTINCT FROM OLD.date_retour
     OR NEW.heure_retour IS DISTINCT FROM OLD.heure_retour
     OR NEW.contact_depart_nom IS DISTINCT FROM OLD.contact_depart_nom
     OR NEW.contact_depart_tel IS DISTINCT FROM OLD.contact_depart_tel
     OR NEW.contact_depart_note IS DISTINCT FROM OLD.contact_depart_note
     OR NEW.contact_arrivee_nom IS DISTINCT FROM OLD.contact_arrivee_nom
     OR NEW.contact_arrivee_tel IS DISTINCT FROM OLD.contact_arrivee_tel
     OR NEW.contact_arrivee_note IS DISTINCT FROM OLD.contact_arrivee_note
  THEN
    PERFORM public.sync_missions_from_devis(NEW.id);
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.devis_missions_propagate() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_devis_missions_propagate ON public.devis;
CREATE TRIGGER trg_devis_missions_propagate
AFTER UPDATE ON public.devis
FOR EACH ROW EXECUTE FUNCTION public.devis_missions_propagate();