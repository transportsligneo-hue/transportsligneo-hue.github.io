ALTER TABLE public.demandes_convoyage ADD COLUMN IF NOT EXISTS date_livraison date, ADD COLUMN IF NOT EXISTS heure_livraison text;
ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS date_livraison date, ADD COLUMN IF NOT EXISTS heure_livraison text;

CREATE TABLE public.devis_brouillons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  numero text NOT NULL UNIQUE,
  form jsonb NOT NULL DEFAULT '{}'::jsonb,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE, DELETE ON public.devis_brouillons TO authenticated;
GRANT ALL ON public.devis_brouillons TO service_role;
ALTER TABLE public.devis_brouillons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own drafts read" ON public.devis_brouillons FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Own drafts update" ON public.devis_brouillons FOR UPDATE TO authenticated USING (user_id = auth.uid() AND consumed_at IS NULL) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Own drafts delete" ON public.devis_brouillons FOR DELETE TO authenticated USING (user_id = auth.uid() AND consumed_at IS NULL);

CREATE OR REPLACE FUNCTION public.create_devis_brouillon(_form jsonb)
RETURNS public.devis_brouillons LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.devis_brouillons;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;
  INSERT INTO public.devis_brouillons(user_id, numero, form)
  VALUES (auth.uid(), public.next_document_number('DEV-TLG'), COALESCE(_form,'{}'::jsonb))
  RETURNING * INTO r;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.create_devis_brouillon(jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_devis_brouillon(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.devis_set_numero()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF NEW.numero IS NOT NULL AND NEW.numero ~ '^DEV-TLG-[0-9]{4}-#?[0-9]{3}$' THEN
    IF public.is_privileged_writer() THEN
      UPDATE public.devis_brouillons SET consumed_at = now() WHERE numero = NEW.numero AND consumed_at IS NULL;
      RETURN NEW;
    END IF;
    UPDATE public.devis_brouillons SET consumed_at = now(), updated_at = now()
      WHERE numero = NEW.numero AND user_id = auth.uid() AND consumed_at IS NULL;
    IF FOUND THEN RETURN NEW; END IF;
  END IF;
  NEW.numero := public.next_document_number('DEV-TLG', EXTRACT(YEAR FROM COALESCE(NEW.created_at, now()))::int);
  RETURN NEW;
END;
$function$;