-- ============================================================================
-- Phase 1 — Fondations tarification (régime TTC/HT + multi-taux TVA)
-- Additif uniquement, zéro régression sur les données existantes.
-- ============================================================================

-- ─── 1. Table de paramètres de facturation (singleton) ─────────────────────
CREATE TABLE IF NOT EXISTS public.pricing_settings (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE,
  regime TEXT NOT NULL DEFAULT 'micro' CHECK (regime IN ('micro', 'societe')),
  default_vat_rate NUMERIC(5,2) NOT NULL DEFAULT 20.00,
  currency TEXT NOT NULL DEFAULT 'EUR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT pricing_settings_singleton CHECK (id = TRUE)
);

GRANT SELECT ON public.pricing_settings TO authenticated;
GRANT ALL ON public.pricing_settings TO service_role;

ALTER TABLE public.pricing_settings ENABLE ROW LEVEL SECURITY;

-- Tout utilisateur authentifié peut LIRE le régime (le front en a besoin
-- pour afficher les prix avec/sans TVA de manière cohérente).
CREATE POLICY "Authenticated users can read pricing settings"
  ON public.pricing_settings FOR SELECT
  TO authenticated
  USING (TRUE);

-- Seuls les admins peuvent modifier.
CREATE POLICY "Admins can update pricing settings"
  ON public.pricing_settings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert pricing settings"
  ON public.pricing_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Ligne unique par défaut (micro-entreprise).
INSERT INTO public.pricing_settings (id, regime, default_vat_rate, currency)
VALUES (TRUE, 'micro', 20.00, 'EUR')
ON CONFLICT (id) DO NOTHING;


-- ─── 2. Table des taux de TVA disponibles ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vat_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate NUMERIC(5,2) NOT NULL UNIQUE CHECK (rate >= 0 AND rate <= 100),
  label TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.vat_rates TO authenticated;
GRANT ALL ON public.vat_rates TO service_role;

ALTER TABLE public.vat_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read vat rates"
  ON public.vat_rates FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "Admins can manage vat rates"
  ON public.vat_rates FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Un seul taux par défaut à la fois (index partiel unique).
CREATE UNIQUE INDEX IF NOT EXISTS vat_rates_only_one_default
  ON public.vat_rates (is_default) WHERE is_default = TRUE;

INSERT INTO public.vat_rates (rate, label, is_default, sort_order) VALUES
  (20.00, 'Taux normal (20 %)', TRUE,  1),
  (10.00, 'Taux intermédiaire (10 %)', FALSE, 2),
  (5.50,  'Taux réduit (5,5 %)', FALSE, 3),
  (0.00,  'Exonéré (0 %)', FALSE, 4)
ON CONFLICT (rate) DO NOTHING;


-- ─── 3. Colonnes snapshot sur devis et factures ────────────────────────────
-- Toutes nullables : les documents existants gardent leur montant historique
-- interprété comme "micro" (montant = TTC) via le fallback front.

ALTER TABLE public.devis
  ADD COLUMN IF NOT EXISTS regime_snapshot TEXT
    CHECK (regime_snapshot IS NULL OR regime_snapshot IN ('micro', 'societe')),
  ADD COLUMN IF NOT EXISTS vat_breakdown JSONB,
  ADD COLUMN IF NOT EXISTS total_ht NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS total_tva NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS total_ttc NUMERIC(12,2);

ALTER TABLE public.factures
  ADD COLUMN IF NOT EXISTS regime_snapshot TEXT
    CHECK (regime_snapshot IS NULL OR regime_snapshot IN ('micro', 'societe')),
  ADD COLUMN IF NOT EXISTS vat_breakdown JSONB,
  ADD COLUMN IF NOT EXISTS total_ht NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS total_tva NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS total_ttc NUMERIC(12,2);


-- ─── 4. Trigger de snapshot du régime à la création ────────────────────────
-- Fige le régime courant au moment de l'INSERT, uniquement si non fourni.
-- Le calcul détaillé (breakdown) reste géré côté application pour rester
-- compatible avec les lignes déjà persistées par les server functions.

CREATE OR REPLACE FUNCTION public.set_pricing_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_regime TEXT;
BEGIN
  IF NEW.regime_snapshot IS NULL THEN
    SELECT regime INTO current_regime FROM public.pricing_settings WHERE id = TRUE;
    NEW.regime_snapshot := COALESCE(current_regime, 'micro');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_devis_pricing_snapshot ON public.devis;
CREATE TRIGGER trg_devis_pricing_snapshot
  BEFORE INSERT ON public.devis
  FOR EACH ROW EXECUTE FUNCTION public.set_pricing_snapshot();

DROP TRIGGER IF EXISTS trg_factures_pricing_snapshot ON public.factures;
CREATE TRIGGER trg_factures_pricing_snapshot
  BEFORE INSERT ON public.factures
  FOR EACH ROW EXECUTE FUNCTION public.set_pricing_snapshot();


-- ─── 5. Trigger updated_at sur pricing_settings & vat_rates ────────────────
CREATE OR REPLACE FUNCTION public.update_pricing_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pricing_settings_updated_at ON public.pricing_settings;
CREATE TRIGGER trg_pricing_settings_updated_at
  BEFORE UPDATE ON public.pricing_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_pricing_updated_at();

DROP TRIGGER IF EXISTS trg_vat_rates_updated_at ON public.vat_rates;
CREATE TRIGGER trg_vat_rates_updated_at
  BEFORE UPDATE ON public.vat_rates
  FOR EACH ROW EXECUTE FUNCTION public.update_pricing_updated_at();