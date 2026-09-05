CREATE OR REPLACE FUNCTION public.sync_missions_from_devis(_devis_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  d record;
  prev text;
BEGIN
  SELECT * INTO d FROM public.devis WHERE id = _devis_id;
  IF d.id IS NULL THEN RETURN; END IF;

  prev := coalesce(current_setting('app.normalizing_group', true), '0');
  PERFORM set_config('app.normalizing_group', '1', true);

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

  UPDATE public.trajets t SET
    depart = CASE
      WHEN t.leg_type = 'retour' THEN COALESCE(NULLIF(d.depart_retour, ''), NULLIF(d.arrivee, ''), t.depart)
      ELSE COALESCE(NULLIF(d.depart, ''), t.depart) END,
    arrivee = CASE
      WHEN t.leg_type = 'retour' THEN COALESCE(NULLIF(d.arrivee_retour, ''), NULLIF(d.depart, ''), t.arrivee)
      ELSE COALESCE(NULLIF(d.arrivee, ''), t.arrivee) END,
    contact_depart_nom = COALESCE(NULLIF(d.contact_depart_nom, ''), t.contact_depart_nom),
    contact_depart_tel = COALESCE(NULLIF(d.contact_depart_tel, ''), t.contact_depart_tel),
    contact_depart_note = COALESCE(NULLIF(d.contact_depart_note, ''), t.contact_depart_note),
    contact_arrivee_nom = COALESCE(NULLIF(d.contact_arrivee_nom, ''), t.contact_arrivee_nom),
    contact_arrivee_tel = COALESCE(NULLIF(d.contact_arrivee_tel, ''), t.contact_arrivee_tel),
    contact_arrivee_note = COALESCE(NULLIF(d.contact_arrivee_note, ''), t.contact_arrivee_note),
    updated_at = now()
  WHERE t.devis_id = d.id
    AND COALESCE(t.statut, '') NOT IN ('annule', 'annulee', 'termine', 'terminee', 'livree');

  PERFORM set_config('app.normalizing_group', prev, true);
END;
$function$;