
-- 1. Colonnes manquantes sur trajets
ALTER TABLE public.trajets
  ADD COLUMN IF NOT EXISTS devis_id uuid REFERENCES public.devis(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS prix_client numeric(10,2),
  ADD COLUMN IF NOT EXISTS commission_convoyeur_pct numeric(5,2) DEFAULT 65,
  ADD COLUMN IF NOT EXISTS prix_convoyeur numeric(10,2),
  ADD COLUMN IF NOT EXISTS prix_societe numeric(10,2),
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_trajets_devis ON public.trajets(devis_id);
CREATE INDEX IF NOT EXISTS idx_trajets_published_at ON public.trajets(published_at DESC);

-- 2. Trigger de calcul automatique des prix
CREATE OR REPLACE FUNCTION public.calc_prix_trajet()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Si prix_client est défini, calcul auto
  IF NEW.prix_client IS NOT NULL AND NEW.commission_convoyeur_pct IS NOT NULL THEN
    NEW.prix_convoyeur := ROUND(NEW.prix_client * NEW.commission_convoyeur_pct / 100, 2);
    NEW.prix_societe := ROUND(NEW.prix_client - NEW.prix_convoyeur, 2);
    -- Synchronise les anciens champs pour compat
    IF NEW.prix IS NULL THEN NEW.prix := NEW.prix_client; END IF;
    IF NEW.tarif_convoyeur IS NULL THEN NEW.tarif_convoyeur := NEW.prix_convoyeur; END IF;
  END IF;

  -- Auto-set published_at quand statut passe à 'publie'
  IF NEW.statut_publication = 'publie' AND (OLD IS NULL OR OLD.statut_publication IS DISTINCT FROM 'publie') THEN
    NEW.published_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_calc_prix_trajet ON public.trajets;
CREATE TRIGGER trg_calc_prix_trajet
  BEFORE INSERT OR UPDATE ON public.trajets
  FOR EACH ROW EXECUTE FUNCTION public.calc_prix_trajet();

-- 3. Trigger auto-create trajet quand devis payé
CREATE OR REPLACE FUNCTION public.auto_create_trajet_from_devis()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing uuid;
BEGIN
  -- Seulement quand paid_at passe de NULL à non-NULL
  IF NEW.paid_at IS NOT NULL AND (OLD.paid_at IS NULL OR OLD IS NULL) THEN
    -- Évite doublon
    SELECT id INTO v_existing FROM public.trajets WHERE devis_id = NEW.id LIMIT 1;
    IF v_existing IS NULL THEN
      INSERT INTO public.trajets (
        devis_id, depart, arrivee, date_trajet, heure_trajet,
        marque, modele, client_nom, client_email, client_telephone,
        prix_client, prix, commission_convoyeur_pct,
        statut, statut_publication, pricing_mode
      ) VALUES (
        NEW.id, NEW.depart, NEW.arrivee, NEW.date_souhaitee, COALESCE(NEW.heure_souhaitee, ''),
        COALESCE(NEW.marque, ''), COALESCE(NEW.modele, ''),
        TRIM(NEW.prenom || ' ' || NEW.nom), NEW.email, COALESCE(NEW.telephone, ''),
        NEW.prix_estime, NEW.prix_estime, 65,
        'en_attente', 'brouillon', 'fixe'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_create_trajet_from_devis ON public.devis;
CREATE TRIGGER trg_auto_create_trajet_from_devis
  AFTER UPDATE ON public.devis
  FOR EACH ROW EXECUTE FUNCTION public.auto_create_trajet_from_devis();

-- 4. Backfill prix_client / commission sur trajets existants
UPDATE public.trajets
SET prix_client = COALESCE(prix_client, prix),
    commission_convoyeur_pct = COALESCE(commission_convoyeur_pct, 65)
WHERE prix_client IS NULL AND prix IS NOT NULL;

-- 5. RLS : convoyeurs validés peuvent voir tous les trajets publiés
DROP POLICY IF EXISTS "Convoyeurs valides voient trajets publies" ON public.trajets;
CREATE POLICY "Convoyeurs valides voient trajets publies"
  ON public.trajets
  FOR SELECT
  TO authenticated
  USING (
    statut_publication = 'publie'
    AND public.is_validated_convoyeur(auth.uid())
  );

-- 6. Fonction RPC : accepter une mission prix fixe (atomique, anti race-condition)
CREATE OR REPLACE FUNCTION public.accept_mission_fixe(_trajet_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_convoyeur_id uuid;
  v_trajet RECORD;
  v_attribution_id uuid;
BEGIN
  -- Auth required
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Convoyeur validé ?
  SELECT id INTO v_convoyeur_id
  FROM public.convoyeurs
  WHERE user_id = auth.uid() AND statut = 'valide'
  LIMIT 1;

  IF v_convoyeur_id IS NULL THEN
    RAISE EXCEPTION 'Convoyeur non validé';
  END IF;

  -- Lock trajet
  SELECT * INTO v_trajet
  FROM public.trajets
  WHERE id = _trajet_id
  FOR UPDATE;

  IF v_trajet.id IS NULL THEN
    RAISE EXCEPTION 'Trajet introuvable';
  END IF;

  IF v_trajet.pricing_mode <> 'fixe' THEN
    RAISE EXCEPTION 'Ce trajet est en enchère';
  END IF;

  IF v_trajet.statut_publication <> 'publie' THEN
    RAISE EXCEPTION 'Trajet non disponible';
  END IF;

  -- Création attribution
  INSERT INTO public.attributions (trajet_id, convoyeur_id, statut)
  VALUES (_trajet_id, v_convoyeur_id, 'accepte')
  RETURNING id INTO v_attribution_id;

  -- Update trajet
  UPDATE public.trajets
  SET statut_publication = 'attribue', statut = 'attribue'
  WHERE id = _trajet_id;

  RETURN v_attribution_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_mission_fixe(uuid) TO authenticated;
