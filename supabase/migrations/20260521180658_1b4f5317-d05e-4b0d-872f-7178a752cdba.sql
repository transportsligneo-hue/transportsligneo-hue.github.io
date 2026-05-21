
-- 1. Contacts terrain
ALTER TABLE public.demandes_convoyage
  ADD COLUMN IF NOT EXISTS contact_depart_nom text,
  ADD COLUMN IF NOT EXISTS contact_depart_tel text,
  ADD COLUMN IF NOT EXISTS contact_depart_note text,
  ADD COLUMN IF NOT EXISTS contact_arrivee_nom text,
  ADD COLUMN IF NOT EXISTS contact_arrivee_tel text,
  ADD COLUMN IF NOT EXISTS contact_arrivee_note text;

ALTER TABLE public.trajets
  ADD COLUMN IF NOT EXISTS contact_depart_nom text,
  ADD COLUMN IF NOT EXISTS contact_depart_tel text,
  ADD COLUMN IF NOT EXISTS contact_depart_note text,
  ADD COLUMN IF NOT EXISTS contact_arrivee_nom text,
  ADD COLUMN IF NOT EXISTS contact_arrivee_tel text,
  ADD COLUMN IF NOT EXISTS contact_arrivee_note text;

ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS contact_depart_nom text,
  ADD COLUMN IF NOT EXISTS contact_depart_tel text,
  ADD COLUMN IF NOT EXISTS contact_depart_note text,
  ADD COLUMN IF NOT EXISTS contact_arrivee_nom text,
  ADD COLUMN IF NOT EXISTS contact_arrivee_tel text,
  ADD COLUMN IF NOT EXISTS contact_arrivee_note text;

ALTER TABLE public.devis
  ADD COLUMN IF NOT EXISTS contact_depart_nom text,
  ADD COLUMN IF NOT EXISTS contact_depart_tel text,
  ADD COLUMN IF NOT EXISTS contact_depart_note text,
  ADD COLUMN IF NOT EXISTS contact_arrivee_nom text,
  ADD COLUMN IF NOT EXISTS contact_arrivee_tel text,
  ADD COLUMN IF NOT EXISTS contact_arrivee_note text;

-- 2. Mode fiscal + mention par client
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pricing_display_mode text NOT NULL DEFAULT 'ttc',
  ADD COLUMN IF NOT EXISTS tva_exemption_note text,
  ADD COLUMN IF NOT EXISTS facture_mention_legale text,
  ADD COLUMN IF NOT EXISTS facture_mention_active boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_pricing_display_mode_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_pricing_display_mode_check
  CHECK (pricing_display_mode IN ('ttc','ht','exempt'));

-- 3. app_settings (singleton key/value)
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage app settings" ON public.app_settings;
CREATE POLICY "Admins manage app settings"
  ON public.app_settings
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Authenticated can read facture mention" ON public.app_settings;
CREATE POLICY "Authenticated can read facture mention"
  ON public.app_settings
  FOR SELECT
  TO authenticated
  USING (key = 'facture_mention_default');

INSERT INTO public.app_settings (key, value)
VALUES ('facture_mention_default', jsonb_build_object('active', false, 'text', ''))
ON CONFLICT (key) DO NOTHING;

-- 4. Trigger recopie contacts devis -> trajet
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
        vin, carte_grise_recto_url, carte_grise_verso_url,
        contact_depart_nom, contact_depart_tel, contact_depart_note,
        contact_arrivee_nom, contact_arrivee_tel, contact_arrivee_note
      ) VALUES (
        NEW.id, NEW.depart, NEW.arrivee, NEW.date_souhaitee, COALESCE(NEW.heure_souhaitee, ''),
        COALESCE(NEW.marque, ''), COALESCE(NEW.modele, ''),
        TRIM(NEW.prenom || ' ' || NEW.nom), NEW.email, COALESCE(NEW.telephone, ''),
        NEW.prix_estime, NEW.prix_estime, 65,
        'en_attente', 'brouillon', 'fixe',
        NEW.vin, NEW.carte_grise_recto_url, NEW.carte_grise_verso_url,
        NEW.contact_depart_nom, NEW.contact_depart_tel, NEW.contact_depart_note,
        NEW.contact_arrivee_nom, NEW.contact_arrivee_tel, NEW.contact_arrivee_note
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
