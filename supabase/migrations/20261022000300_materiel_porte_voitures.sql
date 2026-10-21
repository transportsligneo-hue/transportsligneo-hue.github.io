-- Mon matériel : « Porte-voitures 3,5 t » et « Porte-voitures +3,5 t » remplacent « Porte-voitures » / « Fourgon ».
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.convoyeur_vehicules'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%type%plateau%'
  LOOP
    EXECUTE format('ALTER TABLE public.convoyeur_vehicules DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
UPDATE public.convoyeur_vehicules SET type = 'porteur_35' WHERE type IN ('porteur','fourgon');
ALTER TABLE public.convoyeur_vehicules
  ADD CONSTRAINT convoyeur_vehicules_type_check
  CHECK (type IN ('plateau','plateau_rem','porteur_35','porteur_35p','remorque','wg'));
