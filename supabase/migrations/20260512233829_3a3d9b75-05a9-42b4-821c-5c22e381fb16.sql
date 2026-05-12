
-- 1. Colonnes véhicule
ALTER TABLE public.devis
  ADD COLUMN IF NOT EXISTS vin text,
  ADD COLUMN IF NOT EXISTS carte_grise_recto_url text,
  ADD COLUMN IF NOT EXISTS carte_grise_verso_url text,
  ADD COLUMN IF NOT EXISTS vehicule_docs_completed boolean NOT NULL DEFAULT false;

ALTER TABLE public.trajets
  ADD COLUMN IF NOT EXISTS vin text,
  ADD COLUMN IF NOT EXISTS carte_grise_recto_url text,
  ADD COLUMN IF NOT EXISTS carte_grise_verso_url text;

ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS vin text,
  ADD COLUMN IF NOT EXISTS carte_grise_recto_url text,
  ADD COLUMN IF NOT EXISTS carte_grise_verso_url text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS adresse text;

-- 2. Mise à jour du trigger auto_create_trajet_from_devis pour copier les infos véhicule
CREATE OR REPLACE FUNCTION public.auto_create_trajet_from_devis()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_existing uuid;
BEGIN
  IF NEW.paid_at IS NOT NULL AND (OLD.paid_at IS NULL OR OLD IS NULL) THEN
    SELECT id INTO v_existing FROM public.trajets WHERE devis_id = NEW.id LIMIT 1;
    IF v_existing IS NULL THEN
      INSERT INTO public.trajets (
        devis_id, depart, arrivee, date_trajet, heure_trajet,
        marque, modele, client_nom, client_email, client_telephone,
        prix_client, prix, commission_convoyeur_pct,
        statut, statut_publication, pricing_mode,
        vin, carte_grise_recto_url, carte_grise_verso_url
      ) VALUES (
        NEW.id, NEW.depart, NEW.arrivee, NEW.date_souhaitee, COALESCE(NEW.heure_souhaitee, ''),
        COALESCE(NEW.marque, ''), COALESCE(NEW.modele, ''),
        TRIM(NEW.prenom || ' ' || NEW.nom), NEW.email, COALESCE(NEW.telephone, ''),
        NEW.prix_estime, NEW.prix_estime, 65,
        'en_attente', 'brouillon', 'fixe',
        NEW.vin, NEW.carte_grise_recto_url, NEW.carte_grise_verso_url
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 3. Bucket storage cartes-grises (privé)
INSERT INTO storage.buckets (id, name, public)
VALUES ('cartes-grises', 'cartes-grises', false)
ON CONFLICT (id) DO NOTHING;

-- 4. RLS storage: Client (path commence par son user_id)
CREATE POLICY "Clients upload own carte grise"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'cartes-grises'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Clients read own carte grise"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'cartes-grises'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Clients update own carte grise"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'cartes-grises'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 5. Admin lit tout
CREATE POLICY "Admins read all cartes grises"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'cartes-grises'
  AND (public.has_role(auth.uid(), 'admin'::public.app_role)
       OR public.has_role(auth.uid(), 'super_admin'::public.app_role))
);

-- 6. Convoyeur lit ceux des missions qui lui sont attribuées
CREATE POLICY "Convoyeurs read assigned cartes grises"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'cartes-grises'
  AND EXISTS (
    SELECT 1
    FROM public.attributions a
    JOIN public.convoyeurs c ON c.id = a.convoyeur_id
    JOIN public.trajets t ON t.id = a.trajet_id
    JOIN public.devis d ON d.id = t.devis_id
    WHERE c.user_id = auth.uid()
      AND a.statut IN ('accepte', 'en_cours', 'terminee')
      AND d.user_id::text = (storage.foldername(name))[1]
  )
);
