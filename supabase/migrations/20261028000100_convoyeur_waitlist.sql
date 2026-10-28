-- Liste d'attente convoyeurs : on garde enfin nom, téléphone, ville, adresse + suivi du statut.
CREATE TABLE IF NOT EXISTS public.convoyeur_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  nom text,
  telephone text,
  ville text,
  adresse text,
  statut text NOT NULL DEFAULT 'a_contacter'
    CHECK (statut IN ('a_contacter', 'contacte', 'invite', 'refuse')),
  note text,
  contacted_at timestamptz,
  invited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS convoyeur_waitlist_statut_idx ON public.convoyeur_waitlist (statut, created_at DESC);

ALTER TABLE public.convoyeur_waitlist ENABLE ROW LEVEL SECURITY;

-- Lecture / gestion réservées aux admins. Les inscriptions publiques passent par le serveur (service role).
DROP POLICY IF EXISTS "Admins gèrent la liste d'attente" ON public.convoyeur_waitlist;
CREATE POLICY "Admins gèrent la liste d'attente" ON public.convoyeur_waitlist
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));

-- Récupère les personnes déjà inscrites via le formulaire (seul l'e-mail avait été gardé).
INSERT INTO public.convoyeur_waitlist (email, created_at)
SELECT lower(email), created_at
  FROM public.newsletter_abonnes
 WHERE source = 'convoyeur-waitlist'
ON CONFLICT DO NOTHING;

-- Images des messages (emails / pub) : lecture publique, envoi par les admins.
INSERT INTO storage.buckets (id, name, public) VALUES ('email-visuals', 'email-visuals', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Lecture publique email-visuals" ON storage.objects;
CREATE POLICY "Lecture publique email-visuals" ON storage.objects
  FOR SELECT USING (bucket_id = 'email-visuals');

DROP POLICY IF EXISTS "Admins gèrent email-visuals" ON storage.objects;
CREATE POLICY "Admins gèrent email-visuals" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'email-visuals' AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role)))
  WITH CHECK (bucket_id = 'email-visuals' AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role)));
