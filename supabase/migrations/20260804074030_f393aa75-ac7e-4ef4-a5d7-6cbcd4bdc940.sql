ALTER TABLE public.missions DISABLE TRIGGER missions_protect_operational_fields_trg;

UPDATE public.missions m
SET numero = regexp_replace(d.numero, '^DEV-', 'MIS-'),
    updated_at = now()
FROM public.devis d
WHERE m.devis_id = d.id
  AND d.numero ~ '^DEV-TLG-[0-9]{4}-[0-9]{3}$'
  AND m.numero IS DISTINCT FROM regexp_replace(d.numero, '^DEV-', 'MIS-');

ALTER TABLE public.missions ENABLE TRIGGER missions_protect_operational_fields_trg;