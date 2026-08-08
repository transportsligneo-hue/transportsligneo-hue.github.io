-- FAQ
CREATE TABLE public.faq (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  reponse text NOT NULL,
  ordre integer NOT NULL DEFAULT 0,
  publie boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.faq TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.faq TO authenticated;
GRANT ALL ON public.faq TO service_role;
ALTER TABLE public.faq ENABLE ROW LEVEL SECURITY;
CREATE POLICY "faq_public_read" ON public.faq FOR SELECT TO anon, authenticated USING (publie = true);
CREATE POLICY "faq_admin_all" ON public.faq FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- AVIS CLIENTS
CREATE TABLE public.avis_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note smallint NOT NULL DEFAULT 5,
  commentaire text NOT NULL,
  nom_affiche text NOT NULL,
  ville text,
  type_client text,
  mission_id uuid REFERENCES public.missions(id) ON DELETE SET NULL,
  statut text NOT NULL DEFAULT 'en_attente',
  date_avis date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.avis_clients TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.avis_clients TO authenticated;
GRANT ALL ON public.avis_clients TO service_role;
ALTER TABLE public.avis_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "avis_public_read" ON public.avis_clients FOR SELECT TO anon, authenticated USING (statut = 'publie');
CREATE POLICY "avis_admin_all" ON public.avis_clients FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- ARTICLES
CREATE TABLE public.articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titre text NOT NULL,
  slug text NOT NULL UNIQUE,
  extrait text,
  contenu text NOT NULL DEFAULT '',
  image_url text,
  statut text NOT NULL DEFAULT 'brouillon',
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.articles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.articles TO authenticated;
GRANT ALL ON public.articles TO service_role;
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "articles_public_read" ON public.articles FOR SELECT TO anon, authenticated USING (statut = 'publie');
CREATE POLICY "articles_admin_all" ON public.articles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- NEWSLETTER
CREATE TABLE public.newsletter_abonnes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  unsubscribe_token uuid NOT NULL DEFAULT gen_random_uuid(),
  unsubscribed_at timestamptz,
  source text DEFAULT 'footer',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.newsletter_abonnes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.newsletter_abonnes TO authenticated;
GRANT ALL ON public.newsletter_abonnes TO service_role;
ALTER TABLE public.newsletter_abonnes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "newsletter_public_insert" ON public.newsletter_abonnes FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "newsletter_admin_all" ON public.newsletter_abonnes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- triggers updated_at
CREATE TRIGGER update_faq_updated_at BEFORE UPDATE ON public.faq FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_avis_clients_updated_at BEFORE UPDATE ON public.avis_clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_articles_updated_at BEFORE UPDATE ON public.articles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_newsletter_abonnes_updated_at BEFORE UPDATE ON public.newsletter_abonnes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- FAQ de départ
INSERT INTO public.faq (question, reponse, ordre) VALUES
('Quels délais pour une prise en charge ?', 'Selon la distance et la disponibilité de nos convoyeurs, une prise en charge est possible en moins de 24 heures. Pour les missions express, un supplément de 20 % s''applique.', 1),
('Que se passe-t-il en cas de souci pendant le trajet ?', 'Chaque convoyeur dispose d''un canal de signalement d''incident direct. Vous êtes prévenu immédiatement, une solution de remplacement est organisée et l''assurance circulation couvre le véhicule pendant toute la durée du transport.', 2),
('Quelles zones sont couvertes ?', 'Nous intervenons sur l''ensemble du territoire français et en Europe. Notre base est à Tours (37), au cœur du réseau routier national.', 3),
('Puis-je annuler ou modifier ma commande ?', 'Oui. Toute modification ou annulation est gratuite jusqu''à 48 h avant la prise en charge. Au-delà, des frais peuvent s''appliquer selon les conditions générales de vente.', 4),
('Comment sont sélectionnés les convoyeurs ?', 'Nos convoyeurs sont des professionnels indépendants sélectionnés sur dossier (permis, expérience, assurance), formés en continu via notre académie interne et tenus à une charte de présentation et de discrétion.', 5),
('Les péages et le carburant sont-ils inclus ?', 'Oui, nos tarifs incluent systématiquement les péages et le carburant nécessaires au transport de votre véhicule. Aucun frais caché.', 6);