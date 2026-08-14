CREATE OR REPLACE FUNCTION public.missions_set_numero()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_devis_numero text;
BEGIN
  IF NEW.devis_id IS NOT NULL THEN
    SELECT d.numero INTO v_devis_numero
    FROM public.devis d
    WHERE d.id = NEW.devis_id;
  END IF;

  IF v_devis_numero ~ '^DEV-TLG-[0-9]{4}-#?[0-9]{3,}$' THEN
    NEW.numero := regexp_replace(v_devis_numero, '^DEV-', 'MIS-');
  ELSIF NEW.numero IS NULL OR NEW.numero !~ '^MIS-TLG-[0-9]{4}-#?[0-9]{3,}$' THEN
    NEW.numero := public.next_document_number(
      'MIS-TLG',
      EXTRACT(YEAR FROM COALESCE(NEW.created_at, now()))::int
    );
  END IF;

  RETURN NEW;
END;
$function$;

ALTER TABLE public.missions DISABLE TRIGGER missions_protect_operational_fields_trg;
UPDATE public.missions
SET numero = 'MIS-TLG-2026-#104',
    leg_type = CASE WHEN leg_index = 2 THEN 'retour' ELSE 'aller' END,
    updated_at = now()
WHERE devis_id = 'a4476b37-b84e-4456-b521-4e76ee7d6a64';
ALTER TABLE public.missions ENABLE TRIGGER missions_protect_operational_fields_trg;

ALTER TABLE public.attributions DISABLE TRIGGER trg_attributions_protect_admin_fields;
UPDATE public.attributions
SET numero_mission = 'MIS-TLG-2026-#104', updated_at = now()
WHERE trajet_id IN (
  SELECT id FROM public.trajets
  WHERE devis_id = 'a4476b37-b84e-4456-b521-4e76ee7d6a64'
     OR mission_group_id = '308c9906-bcca-4556-b2a8-dc76e1e32f3f'
);
ALTER TABLE public.attributions ENABLE TRIGGER trg_attributions_protect_admin_fields;