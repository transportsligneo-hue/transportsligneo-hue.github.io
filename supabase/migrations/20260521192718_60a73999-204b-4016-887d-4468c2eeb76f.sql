
-- 1. Adresses favorites de départ
CREATE TABLE IF NOT EXISTS public.client_default_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_user_id uuid,
  client_email text NOT NULL,
  label text NOT NULL,
  address text NOT NULL,
  contact_nom text,
  contact_tel text,
  notes_acces text,
  is_default boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cda_user ON public.client_default_addresses(client_user_id);
CREATE INDEX IF NOT EXISTS idx_cda_email ON public.client_default_addresses(lower(client_email));

ALTER TABLE public.client_default_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage default addresses"
ON public.client_default_addresses FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Clients read own default addresses"
ON public.client_default_addresses FOR SELECT TO authenticated
USING (
  client_user_id = auth.uid()
  OR lower(client_email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
);

CREATE TRIGGER trg_cda_updated_at BEFORE UPDATE ON public.client_default_addresses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. demandes_convoyage : options + véhicule détaillé
ALTER TABLE public.demandes_convoyage
  ADD COLUMN IF NOT EXISTS options_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS vehicule_immatriculation text,
  ADD COLUMN IF NOT EXISTS vehicule_vin text,
  ADD COLUMN IF NOT EXISTS vehicule_marque text,
  ADD COLUMN IF NOT EXISTS vehicule_modele text,
  ADD COLUMN IF NOT EXISTS vehicule_energie text,
  ADD COLUMN IF NOT EXISTS vehicule_type text,
  ADD COLUMN IF NOT EXISTS vehicule_couleur text,
  ADD COLUMN IF NOT EXISTS vehicule_km integer,
  ADD COLUMN IF NOT EXISTS vehicule_notes text,
  ADD COLUMN IF NOT EXISTS default_address_id uuid,
  ADD COLUMN IF NOT EXISTS pricing_display_mode text DEFAULT 'ttc';

-- 3. trajets : mêmes champs pour propagation
ALTER TABLE public.trajets
  ADD COLUMN IF NOT EXISTS options_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS vehicule_immatriculation text,
  ADD COLUMN IF NOT EXISTS vehicule_vin text,
  ADD COLUMN IF NOT EXISTS vehicule_energie text,
  ADD COLUMN IF NOT EXISTS vehicule_type text,
  ADD COLUMN IF NOT EXISTS vehicule_couleur text,
  ADD COLUMN IF NOT EXISTS vehicule_km integer,
  ADD COLUMN IF NOT EXISTS vehicule_notes text;

-- 4. client_pricing_rules : prix séparés et suppléments
ALTER TABLE public.client_pricing_rules
  ADD COLUMN IF NOT EXISTS prix_aller_simple numeric,
  ADD COLUMN IF NOT EXISTS prix_aller_retour numeric,
  ADD COLUMN IF NOT EXISTS prix_express numeric,
  ADD COLUMN IF NOT EXISTS supplements jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 5. Trigger : copier options + véhicule de demande vers trajet
CREATE OR REPLACE FUNCTION public.copy_demande_to_trajet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_demande RECORD;
BEGIN
  IF NEW.demande_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO v_demande FROM public.demandes_convoyage WHERE id = NEW.demande_id;
  IF v_demande IS NULL THEN RETURN NEW; END IF;

  NEW.options_meta := COALESCE(NEW.options_meta, '{}'::jsonb) || COALESCE(v_demande.options_meta, '{}'::jsonb);
  NEW.vehicule_immatriculation := COALESCE(NEW.vehicule_immatriculation, v_demande.vehicule_immatriculation, v_demande.immatriculation);
  NEW.vehicule_vin := COALESCE(NEW.vehicule_vin, v_demande.vehicule_vin);
  NEW.vehicule_energie := COALESCE(NEW.vehicule_energie, v_demande.vehicule_energie, v_demande.carburant);
  NEW.vehicule_type := COALESCE(NEW.vehicule_type, v_demande.vehicule_type);
  NEW.vehicule_couleur := COALESCE(NEW.vehicule_couleur, v_demande.vehicule_couleur);
  NEW.vehicule_km := COALESCE(NEW.vehicule_km, v_demande.vehicule_km);
  NEW.vehicule_notes := COALESCE(NEW.vehicule_notes, v_demande.vehicule_notes);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_copy_demande_to_trajet ON public.trajets;
CREATE TRIGGER trg_copy_demande_to_trajet
BEFORE INSERT ON public.trajets
FOR EACH ROW EXECUTE FUNCTION public.copy_demande_to_trajet();
