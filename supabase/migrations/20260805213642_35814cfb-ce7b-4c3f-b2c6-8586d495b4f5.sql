CREATE TABLE public.company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  raison_sociale text,
  forme_juridique text,
  capital_social text,
  rcs text,
  siret text,
  tva_intra text,
  adresse_ligne1 text,
  adresse_cp text,
  adresse_ville text,
  adresse_pays text DEFAULT 'France',
  email_contact text,
  telephone text,
  site_web text,
  iban text,
  bic text,
  banque_nom text,
  signataire_nom text,
  signataire_fonction text,
  assurance_mention text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_settings_singleton_true CHECK (singleton = true)
);

GRANT SELECT, INSERT, UPDATE ON public.company_settings TO authenticated;
GRANT ALL ON public.company_settings TO service_role;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage company settings"
ON public.company_settings FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER update_company_settings_updated_at
BEFORE UPDATE ON public.company_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Lecture des mentions legales non bancaires par tout utilisateur (documents)
CREATE OR REPLACE FUNCTION public.get_company_public_info()
RETURNS TABLE (
  raison_sociale text, forme_juridique text, capital_social text, rcs text,
  siret text, tva_intra text, adresse_ligne1 text, adresse_cp text,
  adresse_ville text, adresse_pays text, email_contact text, telephone text,
  site_web text, signataire_nom text, signataire_fonction text, assurance_mention text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT raison_sociale, forme_juridique, capital_social, rcs, siret, tva_intra,
         adresse_ligne1, adresse_cp, adresse_ville, adresse_pays, email_contact,
         telephone, site_web, signataire_nom, signataire_fonction, assurance_mention
  FROM public.company_settings LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_company_public_info() TO anon, authenticated, service_role;

CREATE TABLE public.convoyeur_contrats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  convoyeur_id uuid REFERENCES public.convoyeurs(id) ON DELETE CASCADE,
  user_id uuid,
  email text NOT NULL,
  nom_complet text,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  statut text NOT NULL DEFAULT 'envoye',
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  signature_nom text,
  signature_lu_approuve boolean NOT NULL DEFAULT false,
  signed_at timestamptz,
  signature_ip text,
  signature_user_agent text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT convoyeur_contrats_statut_check CHECK (statut IN ('envoye','signe','expire','annule'))
);

CREATE INDEX idx_convoyeur_contrats_convoyeur ON public.convoyeur_contrats(convoyeur_id);
CREATE INDEX idx_convoyeur_contrats_user ON public.convoyeur_contrats(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.convoyeur_contrats TO authenticated;
GRANT ALL ON public.convoyeur_contrats TO service_role;
ALTER TABLE public.convoyeur_contrats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage convoyeur contrats"
ON public.convoyeur_contrats FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Convoyeur reads own contrat"
ON public.convoyeur_contrats FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE TRIGGER update_convoyeur_contrats_updated_at
BEFORE UPDATE ON public.convoyeur_contrats
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();