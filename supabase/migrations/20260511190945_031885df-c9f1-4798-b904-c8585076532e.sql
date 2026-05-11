
-- Attach numbering triggers so DEV-TLG / FAC-TLG / MIS-TLG numbers are actually generated
DROP TRIGGER IF EXISTS trg_devis_set_numero ON public.devis;
CREATE TRIGGER trg_devis_set_numero
BEFORE INSERT ON public.devis
FOR EACH ROW EXECUTE FUNCTION public.devis_set_numero();

DROP TRIGGER IF EXISTS trg_factures_set_numero ON public.factures;
CREATE TRIGGER trg_factures_set_numero
BEFORE INSERT ON public.factures
FOR EACH ROW EXECUTE FUNCTION public.factures_set_numero();

DROP TRIGGER IF EXISTS trg_missions_set_numero ON public.missions;
CREATE TRIGGER trg_missions_set_numero
BEFORE INSERT ON public.missions
FOR EACH ROW EXECUTE FUNCTION public.missions_set_numero();

-- Backfill existing rows that don't match the format
UPDATE public.devis
SET numero = public.next_document_number('DEV-TLG', EXTRACT(YEAR FROM created_at)::int)
WHERE numero IS NULL OR numero !~ '^DEV-TLG-[0-9]{4}-[0-9]{3}$';

UPDATE public.factures
SET numero = public.next_document_number('FAC-TLG', EXTRACT(YEAR FROM created_at)::int)
WHERE numero IS NULL OR numero !~ '^FAC-TLG-[0-9]{4}-[0-9]{3}$';

UPDATE public.missions
SET numero = public.next_document_number('MIS-TLG', EXTRACT(YEAR FROM created_at)::int)
WHERE numero IS NULL OR numero !~ '^MIS-TLG-[0-9]{4}-[0-9]{3}$';
