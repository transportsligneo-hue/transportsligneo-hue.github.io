CREATE TABLE public.avis_paiement_lignes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id text NOT NULL,
  email_subject text,
  date_avis date,
  numero_facture text NOT NULL,
  montant numeric,
  facture_id uuid REFERENCES public.factures(id) ON DELETE SET NULL,
  resultat text NOT NULL CHECK (resultat IN ('payee','deja_payee','a_verifier','resolu')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (email_id, numero_facture)
);
CREATE TABLE public.avis_paiement_emails (
  email_id text PRIMARY KEY,
  email_subject text,
  nb_lignes integer NOT NULL DEFAULT 0,
  erreur text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.avis_paiement_lignes TO authenticated;
GRANT ALL ON public.avis_paiement_lignes TO service_role;
GRANT SELECT ON public.avis_paiement_emails TO authenticated;
GRANT ALL ON public.avis_paiement_emails TO service_role;
ALTER TABLE public.avis_paiement_lignes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avis_paiement_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins lisent lignes avis" ON public.avis_paiement_lignes FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins lisent emails avis" ON public.avis_paiement_emails FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));