
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'convoyeur');

-- 1. Create ALL tables first (no cross-references in RLS yet)

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  nom TEXT NOT NULL DEFAULT '',
  prenom TEXT NOT NULL DEFAULT '',
  telephone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.demandes_convoyage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  telephone TEXT DEFAULT '',
  email TEXT NOT NULL,
  depart TEXT NOT NULL,
  arrivee TEXT NOT NULL,
  date_souhaitee DATE,
  heure_souhaitee TEXT DEFAULT '',
  marque TEXT DEFAULT '',
  modele TEXT DEFAULT '',
  immatriculation TEXT DEFAULT '',
  carburant TEXT DEFAULT '',
  options TEXT DEFAULT '',
  message TEXT DEFAULT '',
  statut TEXT NOT NULL DEFAULT 'nouvelle',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.convoyeurs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  telephone TEXT NOT NULL,
  email TEXT NOT NULL,
  statut TEXT NOT NULL DEFAULT 'en_attente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.documents_convoyeurs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  convoyeur_id UUID REFERENCES public.convoyeurs(id) ON DELETE CASCADE NOT NULL,
  type_document TEXT NOT NULL,
  nom_fichier TEXT NOT NULL,
  url_fichier TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.trajets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demande_id UUID REFERENCES public.demandes_convoyage(id) ON DELETE SET NULL,
  depart TEXT NOT NULL,
  arrivee TEXT NOT NULL,
  date_trajet DATE,
  heure_trajet TEXT DEFAULT '',
  marque TEXT DEFAULT '',
  modele TEXT DEFAULT '',
  immatriculation TEXT DEFAULT '',
  client_nom TEXT DEFAULT '',
  client_telephone TEXT DEFAULT '',
  client_email TEXT DEFAULT '',
  prix NUMERIC(10,2),
  notes_internes TEXT DEFAULT '',
  statut TEXT NOT NULL DEFAULT 'en_attente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.attributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trajet_id UUID REFERENCES public.trajets(id) ON DELETE CASCADE NOT NULL,
  convoyeur_id UUID REFERENCES public.convoyeurs(id) ON DELETE CASCADE NOT NULL,
  statut TEXT NOT NULL DEFAULT 'propose',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (trajet_id, convoyeur_id)
);

-- 2. Enable RLS on all tables
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demandes_convoyage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.convoyeurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents_convoyeurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trajets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attributions ENABLE ROW LEVEL SECURITY;

-- 3. Create has_role function (tables exist now)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- 4. RLS policies (all tables exist now)

-- user_roles
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- profiles
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can read all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- demandes_convoyage
CREATE POLICY "Anyone can create demande" ON public.demandes_convoyage FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Admins can read demandes" ON public.demandes_convoyage FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update demandes" ON public.demandes_convoyage FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete demandes" ON public.demandes_convoyage FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- convoyeurs
CREATE POLICY "Convoyeurs can read own record" ON public.convoyeurs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Convoyeurs can update own record" ON public.convoyeurs FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage convoyeurs" ON public.convoyeurs FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- documents_convoyeurs
CREATE POLICY "Convoyeurs can manage own documents" ON public.documents_convoyeurs FOR ALL TO authenticated
  USING (convoyeur_id IN (SELECT id FROM public.convoyeurs WHERE user_id = auth.uid()));
CREATE POLICY "Admins can manage all documents" ON public.documents_convoyeurs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- trajets
CREATE POLICY "Admins can manage trajets" ON public.trajets FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Convoyeurs can see assigned trajets" ON public.trajets FOR SELECT TO authenticated
  USING (id IN (SELECT trajet_id FROM public.attributions WHERE convoyeur_id IN (SELECT id FROM public.convoyeurs WHERE user_id = auth.uid())));

-- attributions
CREATE POLICY "Admins can manage attributions" ON public.attributions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Convoyeurs can see own attributions" ON public.attributions FOR SELECT TO authenticated
  USING (convoyeur_id IN (SELECT id FROM public.convoyeurs WHERE user_id = auth.uid()));
CREATE POLICY "Convoyeurs can update own attribution status" ON public.attributions FOR UPDATE TO authenticated
  USING (convoyeur_id IN (SELECT id FROM public.convoyeurs WHERE user_id = auth.uid()));

-- 5. Triggers
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_demandes_updated_at BEFORE UPDATE ON public.demandes_convoyage FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_convoyeurs_updated_at BEFORE UPDATE ON public.convoyeurs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_trajets_updated_at BEFORE UPDATE ON public.trajets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_attributions_updated_at BEFORE UPDATE ON public.attributions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Storage
INSERT INTO storage.buckets (id, name, public) VALUES ('convoyeur-documents', 'convoyeur-documents', false);

CREATE POLICY "Convoyeurs can upload own documents" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'convoyeur-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Convoyeurs can view own documents" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'convoyeur-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Admins can view all convoyeur documents" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'convoyeur-documents' AND public.has_role(auth.uid(), 'admin'));

-- 7. Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email) VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
