-- Appli Driver v2 : Mon matériel, enchères, Infos Ligneo
-- Tout est additif : aucune table ni colonne existante n'est modifiée ou supprimée.

-- =====================================================================
-- 1. MON MATÉRIEL
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.convoyeur_vehicules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  convoyeur_id uuid NOT NULL REFERENCES public.convoyeurs(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('plateau','plateau_rem','porteur','remorque','fourgon','wg')),
  nom text NOT NULL,
  immatriculation text,
  capacite integer NOT NULL DEFAULT 1 CHECK (capacite BETWEEN 1 AND 8),
  carte_grise_path text NOT NULL,   -- certificat W Garage pour une plaque WW
  assurance_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_convoyeur_vehicules_convoyeur ON public.convoyeur_vehicules(convoyeur_id);
ALTER TABLE public.convoyeur_vehicules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "veh_own_all" ON public.convoyeur_vehicules;
CREATE POLICY "veh_own_all" ON public.convoyeur_vehicules FOR ALL TO authenticated
  USING (convoyeur_id IN (SELECT id FROM public.convoyeurs WHERE user_id = auth.uid()))
  WITH CHECK (convoyeur_id IN (SELECT id FROM public.convoyeurs WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "veh_admin_all" ON public.convoyeur_vehicules;
CREATE POLICY "veh_admin_all" ON public.convoyeur_vehicules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE TABLE IF NOT EXISTS public.convoyeur_materiel (
  convoyeur_id uuid PRIMARY KEY REFERENCES public.convoyeurs(id) ON DELETE CASCADE,
  outils text[] NOT NULL DEFAULT '{}',
  permis text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.convoyeur_materiel ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mat_own_all" ON public.convoyeur_materiel;
CREATE POLICY "mat_own_all" ON public.convoyeur_materiel FOR ALL TO authenticated
  USING (convoyeur_id IN (SELECT id FROM public.convoyeurs WHERE user_id = auth.uid()))
  WITH CHECK (convoyeur_id IN (SELECT id FROM public.convoyeurs WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "mat_admin_all" ON public.convoyeur_materiel;
CREATE POLICY "mat_admin_all" ON public.convoyeur_materiel FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

DROP TRIGGER IF EXISTS trg_convoyeur_vehicules_updated ON public.convoyeur_vehicules;
CREATE TRIGGER trg_convoyeur_vehicules_updated BEFORE UPDATE ON public.convoyeur_vehicules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_convoyeur_materiel_updated ON public.convoyeur_materiel;
CREATE TRIGGER trg_convoyeur_materiel_updated BEFORE UPDATE ON public.convoyeur_materiel
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Stockage privé des cartes grises / assurances de véhicules (dossier = id utilisateur)
INSERT INTO storage.buckets (id, name, public) VALUES ('convoyeur-vehicules', 'convoyeur-vehicules', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "veh_files_own_rw" ON storage.objects;
CREATE POLICY "veh_files_own_rw" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'convoyeur-vehicules' AND (auth.uid())::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'convoyeur-vehicules' AND (auth.uid())::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS "veh_files_admin_read" ON storage.objects;
CREATE POLICY "veh_files_admin_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'convoyeur-vehicules'
         AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')));

-- =====================================================================
-- 2. ENCHÈRES (l'offre la plus basse est classée première)
--    Les offres sont stockées dans mission_offres (type_offre = 'enchere').
-- =====================================================================
ALTER TABLE public.trajets
  ADD COLUMN IF NOT EXISTS enchere_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS enchere_plafond numeric,
  ADD COLUMN IF NOT EXISTS enchere_fin timestamptz,
  ADD COLUMN IF NOT EXISTS enchere_classement_visible boolean NOT NULL DEFAULT true,
  -- Options affichées sur les cartes du catalogue
  ADD COLUMN IF NOT EXISTS equipements_requis text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS carburant_mode text CHECK (carburant_mode IN ('rembourse','plein')),
  ADD COLUMN IF NOT EXISTS mise_en_main boolean NOT NULL DEFAULT false;

-- Place ou met à jour l'offre du convoyeur connecté.
CREATE OR REPLACE FUNCTION public.place_auction_bid(_trajet_id uuid, _prix numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _conv uuid; _t record; _base numeric;
BEGIN
  SELECT id INTO _conv FROM public.convoyeurs WHERE user_id = auth.uid() AND statut = 'valide';
  IF _conv IS NULL THEN RAISE EXCEPTION 'Compte convoyeur non validé'; END IF;
  IF NOT public.can_convoyeur_bid_on_trajet(_conv, _trajet_id) THEN
    RAISE EXCEPTION 'Vous ne pouvez pas enchérir sur cette mission';
  END IF;
  SELECT * INTO _t FROM public.trajets WHERE id = _trajet_id;
  IF NOT COALESCE(_t.enchere_active, false) THEN RAISE EXCEPTION 'Aucune enchère sur cette mission'; END IF;
  IF _t.enchere_fin IS NOT NULL AND _t.enchere_fin <= now() THEN RAISE EXCEPTION 'L''enchère est terminée'; END IF;
  _base := COALESCE(_t.prix_convoyeur, _t.prix_convoyeur_fixe, _t.prix_convoyeur_min, 0);
  IF _prix < _base THEN RAISE EXCEPTION 'L''offre ne peut pas être inférieure au prix de la mission (% €)', _base; END IF;
  IF _t.enchere_plafond IS NOT NULL AND _prix > _t.enchere_plafond THEN
    RAISE EXCEPTION 'L''offre dépasse le plafond (% €)', _t.enchere_plafond;
  END IF;

  INSERT INTO public.mission_offres (trajet_id, convoyeur_id, prix_propose, prix_suggere_snapshot, type_offre, statut)
  VALUES (_trajet_id, _conv, _prix, _base, 'enchere', 'en_attente')
  ON CONFLICT (trajet_id, convoyeur_id) DO UPDATE
    SET prix_propose = EXCLUDED.prix_propose, type_offre = 'enchere', statut = 'en_attente', updated_at = now()
    WHERE public.mission_offres.statut IN ('en_attente');
  RETURN public.get_auction_state(_trajet_id);
END $$;
REVOKE ALL ON FUNCTION public.place_auction_bid(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.place_auction_bid(uuid, numeric) TO authenticated;

-- État de l'enchère vu par le convoyeur connecté (offres des autres anonymisées).
CREATE OR REPLACE FUNCTION public.get_auction_state(_trajet_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _conv uuid; _t record; _mine numeric; _others jsonb; _n int; _visible boolean;
BEGIN
  SELECT id INTO _conv FROM public.convoyeurs WHERE user_id = auth.uid();
  IF _conv IS NULL THEN RAISE EXCEPTION 'Accès refusé'; END IF;
  SELECT enchere_active, enchere_plafond, enchere_fin, enchere_classement_visible,
         COALESCE(prix_convoyeur, prix_convoyeur_fixe, prix_convoyeur_min, 0) AS base
    INTO _t FROM public.trajets WHERE id = _trajet_id;
  _visible := COALESCE(_t.enchere_classement_visible, true);
  SELECT prix_propose INTO _mine FROM public.mission_offres
    WHERE trajet_id = _trajet_id AND convoyeur_id = _conv AND type_offre = 'enchere';
  SELECT count(*) INTO _n FROM public.mission_offres WHERE trajet_id = _trajet_id AND type_offre = 'enchere';
  IF _visible THEN
    SELECT COALESCE(jsonb_agg(prix_propose ORDER BY prix_propose), '[]'::jsonb) INTO _others
      FROM public.mission_offres
      WHERE trajet_id = _trajet_id AND type_offre = 'enchere' AND convoyeur_id <> _conv;
  ELSE
    _others := '[]'::jsonb;
  END IF;
  RETURN jsonb_build_object(
    'active', COALESCE(_t.enchere_active, false), 'prix', _t.base, 'plafond', _t.enchere_plafond,
    'fin', _t.enchere_fin, 'nb_offres', _n, 'mon_offre', _mine,
    'classement_visible', _visible, 'autres_offres', _others);
END $$;
REVOKE ALL ON FUNCTION public.get_auction_state(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_auction_state(uuid) TO authenticated;

-- =====================================================================
-- 3. INFOS LIGNEO (bulles d'info publiées par l'admin)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.infos_ligneo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'nouveau' CHECK (kind IN ('urgent','maintenance','changement','nouveau')),
  titre text NOT NULL,
  corps text NOT NULL DEFAULT '',
  publie boolean NOT NULL DEFAULT false,
  publie_le timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.infos_ligneo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "infos_read_published" ON public.infos_ligneo;
CREATE POLICY "infos_read_published" ON public.infos_ligneo FOR SELECT TO authenticated
  USING (publie = true);
DROP POLICY IF EXISTS "infos_admin_all" ON public.infos_ligneo;
CREATE POLICY "infos_admin_all" ON public.infos_ligneo FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
DROP TRIGGER IF EXISTS trg_infos_ligneo_updated ON public.infos_ligneo;
CREATE TRIGGER trg_infos_ligneo_updated BEFORE UPDATE ON public.infos_ligneo
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.infos_ligneo_lues (
  info_id uuid NOT NULL REFERENCES public.infos_ligneo(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  lu_le timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (info_id, user_id)
);
ALTER TABLE public.infos_ligneo_lues ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "infos_lues_own" ON public.infos_ligneo_lues;
CREATE POLICY "infos_lues_own" ON public.infos_ligneo_lues FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Date de publication automatique
CREATE OR REPLACE FUNCTION public.infos_ligneo_set_publie_le()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.publie AND NEW.publie_le IS NULL THEN NEW.publie_le := now(); END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_infos_ligneo_publie ON public.infos_ligneo;
CREATE TRIGGER trg_infos_ligneo_publie BEFORE INSERT OR UPDATE ON public.infos_ligneo
  FOR EACH ROW EXECUTE FUNCTION public.infos_ligneo_set_publie_le();

-- Options du catalogue + enchères ouvertes, par mission publiée (la vue trajets_publies_safe n'est pas modifiée)
CREATE OR REPLACE FUNCTION public.list_catalogue_extras()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _conv uuid;
BEGIN
  SELECT id INTO _conv FROM public.convoyeurs WHERE user_id = auth.uid();
  IF _conv IS NULL THEN RETURN '[]'::jsonb; END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'trajet_id', t.id,
      'equipements_requis', t.equipements_requis,
      'carburant_mode', t.carburant_mode,
      'mise_en_main', t.mise_en_main,
      'enchere', CASE WHEN t.enchere_active AND (t.enchere_fin IS NULL OR t.enchere_fin > now()) THEN jsonb_build_object(
        'prix', COALESCE(t.prix_convoyeur, t.prix_convoyeur_fixe, t.prix_convoyeur_min, 0),
        'plafond', t.enchere_plafond,
        'fin', t.enchere_fin,
        'nb_offres', (SELECT count(*) FROM public.mission_offres o WHERE o.trajet_id = t.id AND o.type_offre = 'enchere'),
        'mon_offre', (SELECT o.prix_propose FROM public.mission_offres o WHERE o.trajet_id = t.id AND o.convoyeur_id = _conv AND o.type_offre = 'enchere')
      ) ELSE NULL END
    ))
    FROM public.trajets t
    WHERE t.statut_publication = 'publie' AND t.attribution_mode IN ('catalogue','mixte')
  ), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.list_catalogue_extras() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_catalogue_extras() TO authenticated;
