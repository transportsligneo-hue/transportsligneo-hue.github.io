CREATE TABLE public.bons_commande (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_po text NOT NULL UNIQUE,
  vin text,
  montant_ht numeric,
  date_commande date,
  date_livraison date,
  destinataire text,
  email_source_id text,
  email_subject text,
  email_received_at timestamptz,
  pdf_path text,
  devis_id uuid REFERENCES public.devis(id) ON DELETE SET NULL,
  mission_id uuid REFERENCES public.missions(id) ON DELETE SET NULL,
  statut text NOT NULL DEFAULT 'non_rapproche',
  candidats jsonb NOT NULL DEFAULT '[]'::jsonb,
  extraction_error text,
  raw_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bons_commande_statut_check CHECK (statut = ANY (ARRAY['non_rapproche','rapproche','ambigu','erreur_extraction']))
);

CREATE INDEX bons_commande_vin_idx ON public.bons_commande (vin);
CREATE INDEX bons_commande_statut_idx ON public.bons_commande (statut);
CREATE UNIQUE INDEX bons_commande_email_source_idx ON public.bons_commande (email_source_id) WHERE email_source_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bons_commande TO authenticated;
GRANT ALL ON public.bons_commande TO service_role;
ALTER TABLE public.bons_commande ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage bons de commande"
ON public.bons_commande FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER bons_commande_set_updated_at
BEFORE UPDATE ON public.bons_commande
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.po_import_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id text,
  email_subject text,
  numero_po text,
  vin text,
  resultat text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX po_import_logs_email_idx ON public.po_import_logs (email_id);
CREATE INDEX po_import_logs_created_idx ON public.po_import_logs (created_at DESC);

GRANT SELECT ON public.po_import_logs TO authenticated;
GRANT ALL ON public.po_import_logs TO service_role;
ALTER TABLE public.po_import_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read po import logs"
ON public.po_import_logs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins read bons commande pdf"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'bons-commande' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')));