
-- Phase 2: Devis auto depuis demande + validation convoyeur + fondation catalogue
-- Additif, aucune régression.

-- 1) attributions : mode (directe|catalogue) + statut_convoyeur (en_attente|accepte|refuse) + timestamps
ALTER TABLE public.attributions
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'directe',
  ADD COLUMN IF NOT EXISTS statut_convoyeur text NOT NULL DEFAULT 'en_attente',
  ADD COLUMN IF NOT EXISTS repondu_at timestamptz,
  ADD COLUMN IF NOT EXISTS refus_motif text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attributions_mode_check') THEN
    ALTER TABLE public.attributions ADD CONSTRAINT attributions_mode_check CHECK (mode IN ('directe','catalogue'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attributions_statut_conv_check') THEN
    ALTER TABLE public.attributions ADD CONSTRAINT attributions_statut_conv_check CHECK (statut_convoyeur IN ('en_attente','accepte','refuse'));
  END IF;
END $$;

-- Existant : marquer les attributions déjà actées comme accepte
UPDATE public.attributions SET statut_convoyeur = 'accepte' WHERE statut_convoyeur = 'en_attente' AND statut IN ('active','terminee');

-- 2) demandes_convoyage : lier au devis généré
ALTER TABLE public.demandes_convoyage
  ADD COLUMN IF NOT EXISTS devis_id uuid REFERENCES public.devis(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS devis_genere_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_demandes_devis_id ON public.demandes_convoyage(devis_id);

-- 3) devis : origine (manuel|demande_client|api) pour traçabilité
ALTER TABLE public.devis
  ADD COLUMN IF NOT EXISTS origine text NOT NULL DEFAULT 'manuel',
  ADD COLUMN IF NOT EXISTS demande_id uuid REFERENCES public.demandes_convoyage(id) ON DELETE SET NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'devis_origine_check') THEN
    ALTER TABLE public.devis ADD CONSTRAINT devis_origine_check CHECK (origine IN ('manuel','demande_client','api'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_devis_demande_id ON public.devis(demande_id);

-- 4) mission_offres : enrichir pour enchères catalogue
ALTER TABLE public.mission_offres
  ADD COLUMN IF NOT EXISTS prix_propose numeric,
  ADD COLUMN IF NOT EXISTS commentaire_convoyeur text,
  ADD COLUMN IF NOT EXISTS admin_counter_offer numeric,
  ADD COLUMN IF NOT EXISTS admin_counter_at timestamptz,
  ADD COLUMN IF NOT EXISTS admin_counter_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
