
CREATE TABLE public.devis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL UNIQUE DEFAULT ('DEV-' || to_char(now(), 'YYYYMMDD') || '-' || substr(gen_random_uuid()::text, 1, 6)),
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  email TEXT NOT NULL,
  telephone TEXT,
  depart TEXT NOT NULL,
  arrivee TEXT NOT NULL,
  distance_km INTEGER,
  duree_estimee TEXT,
  type_vehicule TEXT,
  marque TEXT,
  modele TEXT,
  carburant TEXT,
  prestation TEXT,
  option_trajet TEXT,
  date_souhaitee DATE,
  heure_souhaitee TEXT,
  prix_estime NUMERIC NOT NULL,
  prix_base NUMERIC,
  tarif_label TEXT,
  multiplier_label TEXT,
  message TEXT,
  pdf_url TEXT,
  statut TEXT NOT NULL DEFAULT 'envoye',
  email_envoye BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.devis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create devis"
  ON public.devis FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can read devis"
  ON public.devis FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update devis"
  ON public.devis FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete devis"
  ON public.devis FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_devis_updated_at
  BEFORE UPDATE ON public.devis
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_devis_created_at ON public.devis(created_at DESC);
CREATE INDEX idx_devis_email ON public.devis(email);
CREATE INDEX idx_devis_statut ON public.devis(statut);
