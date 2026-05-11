-- ===== Lot B: Numérotation officielle centralisée =====
-- Format: DEV-TLG-YYYY-NNN / FAC-TLG-YYYY-NNN / MIS-TLG-YYYY-NNN

-- 1. RPC unifiée pour générer un numéro de document
CREATE OR REPLACE FUNCTION public.next_document_number(_doc_prefix text, _year integer DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year int := COALESCE(_year, EXTRACT(YEAR FROM now())::int);
  v_value int;
  v_clean text := upper(trim(_doc_prefix));
BEGIN
  IF v_clean NOT IN ('DEV-TLG','FAC-TLG','MIS-TLG') THEN
    RAISE EXCEPTION 'Invalid document prefix: %', _doc_prefix;
  END IF;

  INSERT INTO public.mission_sequences (prefix, year, current_value)
  VALUES (v_clean, v_year, 1)
  ON CONFLICT (prefix, year)
  DO UPDATE SET current_value = mission_sequences.current_value + 1,
                updated_at = now()
  RETURNING current_value INTO v_value;

  RETURN v_clean || '-' || v_year::text || '-' || lpad(v_value::text, 3, '0');
END;
$$;

-- 2. Trigger devis: génère le numéro DEV-TLG si manquant ou ancien format
CREATE OR REPLACE FUNCTION public.devis_set_numero()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.numero IS NULL OR NEW.numero !~ '^DEV-TLG-[0-9]{4}-[0-9]{3}$' THEN
    NEW.numero := public.next_document_number(
      'DEV-TLG',
      EXTRACT(YEAR FROM COALESCE(NEW.created_at, now()))::int
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_devis_set_numero ON public.devis;
CREATE TRIGGER trg_devis_set_numero
  BEFORE INSERT ON public.devis
  FOR EACH ROW EXECUTE FUNCTION public.devis_set_numero();

-- 3. Trigger missions: génère le numéro MIS-TLG si manquant ou ancien format
CREATE OR REPLACE FUNCTION public.missions_set_numero()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.numero IS NULL OR NEW.numero !~ '^MIS-TLG-[0-9]{4}-[0-9]{3}$' THEN
    NEW.numero := public.next_document_number(
      'MIS-TLG',
      EXTRACT(YEAR FROM COALESCE(NEW.created_at, now()))::int
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_missions_set_numero ON public.missions;
CREATE TRIGGER trg_missions_set_numero
  BEFORE INSERT ON public.missions
  FOR EACH ROW EXECUTE FUNCTION public.missions_set_numero();

-- 4. Met à jour le trigger attributions existant pour produire MIS-TLG-YYYY-NNN
CREATE OR REPLACE FUNCTION public.attributions_set_numero()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.numero_mission IS NULL OR NEW.numero_mission !~ '^MIS-TLG-[0-9]{4}-[0-9]{3}$' THEN
    NEW.numero_mission := public.next_document_number(
      'MIS-TLG',
      EXTRACT(YEAR FROM COALESCE(NEW.created_at, now()))::int
    );
  END IF;
  RETURN NEW;
END;
$$;

-- (le trigger trg_attributions_set_numero existe déjà, on garde)

-- 5. Table factures (Lot C — émissions de factures par mission)
CREATE TABLE IF NOT EXISTS public.factures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text UNIQUE NOT NULL,
  mission_id uuid REFERENCES public.missions(id) ON DELETE SET NULL,
  attribution_id uuid REFERENCES public.attributions(id) ON DELETE SET NULL,
  client_email text NOT NULL,
  client_nom text NOT NULL,
  client_prenom text,
  client_societe text,
  client_adresse text,
  client_siret text,
  client_tva text,
  type_facture text NOT NULL DEFAULT 'particulier',   -- 'particulier' | 'b2b'
  date_facture date NOT NULL DEFAULT CURRENT_DATE,
  date_mission date,
  date_echeance date,
  mode_paiement text,
  conditions_paiement text,
  statut text NOT NULL DEFAULT 'emise',                -- 'emise' | 'payee' | 'en_retard' | 'annulee'
  date_paiement date,
  prix_ht numeric(10,2) NOT NULL DEFAULT 0,
  tva_taux numeric(5,2) NOT NULL DEFAULT 20.00,
  prix_tva numeric(10,2) NOT NULL DEFAULT 0,
  prix_ttc numeric(10,2) NOT NULL DEFAULT 0,
  designation text,
  distance_km integer,
  depart text,
  arrivee text,
  pdf_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.factures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage factures" ON public.factures;
CREATE POLICY "Admins manage factures" ON public.factures
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Clients read own factures" ON public.factures;
CREATE POLICY "Clients read own factures" ON public.factures
  FOR SELECT TO authenticated
  USING (
    lower(client_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))
    OR client_email IN (SELECT p.email FROM profiles p WHERE p.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_factures_mission ON public.factures(mission_id);
CREATE INDEX IF NOT EXISTS idx_factures_attribution ON public.factures(attribution_id);
CREATE INDEX IF NOT EXISTS idx_factures_client_email ON public.factures(lower(client_email));
CREATE INDEX IF NOT EXISTS idx_factures_statut ON public.factures(statut);

-- Trigger numéro facture
CREATE OR REPLACE FUNCTION public.factures_set_numero()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.numero IS NULL OR NEW.numero !~ '^FAC-TLG-[0-9]{4}-[0-9]{3}$' THEN
    NEW.numero := public.next_document_number(
      'FAC-TLG',
      EXTRACT(YEAR FROM COALESCE(NEW.created_at, now()))::int
    );
  END IF;
  IF NEW.prix_tva = 0 AND NEW.prix_ht > 0 THEN
    NEW.prix_tva := round(NEW.prix_ht * NEW.tva_taux / 100, 2);
  END IF;
  IF NEW.prix_ttc = 0 AND NEW.prix_ht > 0 THEN
    NEW.prix_ttc := NEW.prix_ht + NEW.prix_tva;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_factures_set_numero ON public.factures;
CREATE TRIGGER trg_factures_set_numero
  BEFORE INSERT ON public.factures
  FOR EACH ROW EXECUTE FUNCTION public.factures_set_numero();

DROP TRIGGER IF EXISTS trg_factures_updated_at ON public.factures;
CREATE TRIGGER trg_factures_updated_at
  BEFORE UPDATE ON public.factures
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();