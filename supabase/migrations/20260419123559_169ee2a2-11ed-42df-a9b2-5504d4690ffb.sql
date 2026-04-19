CREATE TABLE public.missions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero text NOT NULL DEFAULT ('MIS-' || to_char(now(), 'YYYYMMDD') || '-' || substr(gen_random_uuid()::text, 1, 6)),
  user_id uuid NOT NULL,
  ville_depart text NOT NULL,
  ville_arrivee text NOT NULL,
  date_prise_en_charge date NOT NULL,
  type_trajet text NOT NULL DEFAULT 'aller_simple',
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  marque text,
  modele text,
  immatriculation text,
  carburant text,
  remarques text,
  nom text NOT NULL,
  prenom text NOT NULL,
  email text NOT NULL,
  telephone text,
  prix_total numeric NOT NULL DEFAULT 0,
  statut text NOT NULL DEFAULT 'en_attente',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT missions_type_trajet_check CHECK (type_trajet IN ('aller_simple','aller_retour','express')),
  CONSTRAINT missions_statut_check CHECK (statut IN ('en_attente','confirmee','en_cours','livree','annulee'))
);

CREATE INDEX idx_missions_user_id ON public.missions(user_id);
CREATE INDEX idx_missions_statut ON public.missions(statut);
CREATE INDEX idx_missions_created_at ON public.missions(created_at DESC);

ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create own missions"
  ON public.missions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own missions"
  ON public.missions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own missions"
  ON public.missions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all missions"
  ON public.missions FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_missions_updated_at
  BEFORE UPDATE ON public.missions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();