
-- =========================================================
-- 1. RÈGLES DE RÉMUNÉRATION
-- =========================================================
CREATE TABLE public.regles_remuneration (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  libelle text NOT NULL,
  type_regle text NOT NULL CHECK (type_regle IN ('km','forfait','forfait_km')),
  montant_forfait numeric NOT NULL DEFAULT 0,
  taux_km numeric NOT NULL DEFAULT 0,
  seuil_km numeric NOT NULL DEFAULT 0,
  montant_min numeric,
  cond_vehicule_type text,
  cond_type_mission text,
  cond_zone text,
  cond_distance_min numeric,
  cond_distance_max numeric,
  priorite integer NOT NULL DEFAULT 0,
  actif boolean NOT NULL DEFAULT true,
  date_debut date NOT NULL DEFAULT CURRENT_DATE,
  date_fin date,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.regles_remuneration TO authenticated;
GRANT ALL ON public.regles_remuneration TO service_role;
ALTER TABLE public.regles_remuneration ENABLE ROW LEVEL SECURITY;
CREATE POLICY "regles_admin_all" ON public.regles_remuneration FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "regles_read_convoyeur" ON public.regles_remuneration FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'convoyeur'));

-- =========================================================
-- 2. CATALOGUE DE PÉNALITÉS
-- =========================================================
CREATE TABLE public.catalogue_penalites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE,
  libelle text NOT NULL,
  description text,
  type_montant text NOT NULL CHECK (type_montant IN ('forfait','pourcentage')),
  valeur numeric NOT NULL DEFAULT 0,
  article_reference text,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalogue_penalites TO authenticated;
GRANT ALL ON public.catalogue_penalites TO service_role;
ALTER TABLE public.catalogue_penalites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "penalites_admin_all" ON public.catalogue_penalites FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "penalites_read_all_auth" ON public.catalogue_penalites FOR SELECT TO authenticated
  USING (true);

INSERT INTO public.catalogue_penalites (code, libelle, description, type_montant, valeur, article_reference) VALUES
 ('RETARD_NON_SIGNALE','Retard non signalé au client','Retard sur le créneau convenu sans information préalable du client ou de l''exploitation.','forfait',25,'Contrat de partenariat — art. 5.2'),
 ('TENUE','Manquement à la tenue / présentation','Non-respect de la charte de présentation et discrétion.','forfait',20,'Charte de présentation et discrétion — art. 2'),
 ('EDL_DEPART','EDL de départ non réalisé','État des lieux de départ absent ou incomplet.','forfait',40,'Contrat de partenariat — art. 6.1'),
 ('ANNUL_TARDIVE','Annulation tardive sans motif valable','Annulation à moins de 24h de la prise en charge sans motif recevable.','pourcentage',50,'Contrat de partenariat — art. 7.3'),
 ('CONFIDENTIALITE','Manquement à la confidentialité','Divulgation d''informations client ou véhicule.','forfait',100,'Charte de présentation et discrétion — art. 4'),
 ('PHOTOS_MANQUANTES','Photos / documents de mission manquants','Dossier de mission incomplet à la livraison.','forfait',15,'Contrat de partenariat — art. 6.2');

-- =========================================================
-- 3. PAIEMENTS CONVOYEURS
-- =========================================================
CREATE TABLE public.paiements_convoyeurs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text,
  convoyeur_id uuid NOT NULL REFERENCES public.convoyeurs(id) ON DELETE RESTRICT,
  montant_total numeric NOT NULL DEFAULT 0,
  nb_missions integer NOT NULL DEFAULT 0,
  methode text NOT NULL DEFAULT 'virement',
  statut text NOT NULL DEFAULT 'prepare' CHECK (statut IN ('prepare','envoye','confirme','echoue','annule')),
  periode_debut date,
  periode_fin date,
  date_execution timestamptz,
  reference_bancaire text,
  facture_url text,
  facture_numero text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.paiements_convoyeurs TO authenticated;
GRANT ALL ON public.paiements_convoyeurs TO service_role;
ALTER TABLE public.paiements_convoyeurs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "paiements_admin_all" ON public.paiements_convoyeurs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "paiements_read_own" ON public.paiements_convoyeurs FOR SELECT TO authenticated
  USING (convoyeur_id IN (SELECT c.id FROM public.convoyeurs c WHERE c.user_id = auth.uid()));

-- =========================================================
-- 4. RÉMUNÉRATIONS DE MISSION
-- =========================================================
CREATE TABLE public.remunerations_missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trajet_id uuid NOT NULL UNIQUE REFERENCES public.trajets(id) ON DELETE CASCADE,
  attribution_id uuid REFERENCES public.attributions(id) ON DELETE SET NULL,
  convoyeur_id uuid REFERENCES public.convoyeurs(id) ON DELETE SET NULL,
  numero_mission text,
  date_mission date,
  regle_id uuid REFERENCES public.regles_remuneration(id) ON DELETE SET NULL,
  source_calcul text NOT NULL DEFAULT 'regle' CHECK (source_calcul IN ('regle','prix_negocie','manuel','aucune_regle')),
  distance_km numeric,
  base_forfait numeric NOT NULL DEFAULT 0,
  base_km_montant numeric NOT NULL DEFAULT 0,
  primes numeric NOT NULL DEFAULT 0,
  frais_annexes numeric NOT NULL DEFAULT 0,
  total_ajustements numeric NOT NULL DEFAULT 0,
  montant_base numeric NOT NULL DEFAULT 0,
  montant_total numeric NOT NULL DEFAULT 0,
  statut text NOT NULL DEFAULT 'en_attente' CHECK (statut IN ('en_attente','a_valider','valide','paye','litige','annule')),
  calcul_detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  paiement_id uuid REFERENCES public.paiements_convoyeurs(id) ON DELETE SET NULL,
  calcule_at timestamptz NOT NULL DEFAULT now(),
  valide_par uuid,
  valide_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_remu_convoyeur ON public.remunerations_missions(convoyeur_id);
CREATE INDEX idx_remu_statut ON public.remunerations_missions(statut);
CREATE INDEX idx_remu_paiement ON public.remunerations_missions(paiement_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.remunerations_missions TO authenticated;
GRANT ALL ON public.remunerations_missions TO service_role;
ALTER TABLE public.remunerations_missions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "remu_admin_all" ON public.remunerations_missions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "remu_read_own" ON public.remunerations_missions FOR SELECT TO authenticated
  USING (convoyeur_id IN (SELECT c.id FROM public.convoyeurs c WHERE c.user_id = auth.uid()));

-- =========================================================
-- 5. AJUSTEMENTS (bonus / malus / pénalités / lignes libres)
-- =========================================================
CREATE TABLE public.remuneration_ajustements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  remuneration_id uuid NOT NULL REFERENCES public.remunerations_missions(id) ON DELETE CASCADE,
  categorie text NOT NULL CHECK (categorie IN ('bonus','penalite','ajout_libre','deduction_libre','frais')),
  penalite_id uuid REFERENCES public.catalogue_penalites(id) ON DELETE SET NULL,
  libelle text NOT NULL,
  motif text NOT NULL,
  article_reference text,
  incident_id uuid REFERENCES public.mission_incidents(id) ON DELETE SET NULL,
  justificatif_url text,
  montant numeric NOT NULL,
  annule boolean NOT NULL DEFAULT false,
  annule_par uuid,
  annule_at timestamptz,
  annulation_motif text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ajust_remu ON public.remuneration_ajustements(remuneration_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.remuneration_ajustements TO authenticated;
GRANT ALL ON public.remuneration_ajustements TO service_role;
ALTER TABLE public.remuneration_ajustements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ajust_admin_all" ON public.remuneration_ajustements FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "ajust_read_own" ON public.remuneration_ajustements FOR SELECT TO authenticated
  USING (remuneration_id IN (
    SELECT r.id FROM public.remunerations_missions r
    JOIN public.convoyeurs c ON c.id = r.convoyeur_id
    WHERE c.user_id = auth.uid()
  ));

-- =========================================================
-- 6. TRIGGERS updated_at
-- =========================================================
CREATE TRIGGER trg_regles_upd BEFORE UPDATE ON public.regles_remuneration
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_penalites_upd BEFORE UPDATE ON public.catalogue_penalites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_paiements_upd BEFORE UPDATE ON public.paiements_convoyeurs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_remu_upd BEFORE UPDATE ON public.remunerations_missions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ajust_upd BEFORE UPDATE ON public.remuneration_ajustements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 7. RECALCUL DES TOTAUX APRÈS AJUSTEMENT
-- =========================================================
CREATE OR REPLACE FUNCTION public.remu_refresh_totals(_remu_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _sum numeric;
BEGIN
  SELECT COALESCE(SUM(montant),0) INTO _sum
  FROM public.remuneration_ajustements
  WHERE remuneration_id = _remu_id AND annule = false;

  UPDATE public.remunerations_missions
     SET total_ajustements = _sum,
         montant_total = ROUND(montant_base + _sum, 2)
   WHERE id = _remu_id;
END; $$;

CREATE OR REPLACE FUNCTION public.remu_ajustement_after()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.remu_refresh_totals(COALESCE(NEW.remuneration_id, OLD.remuneration_id));
  RETURN NULL;
END; $$;

CREATE TRIGGER trg_ajust_totals AFTER INSERT OR UPDATE OR DELETE ON public.remuneration_ajustements
  FOR EACH ROW EXECUTE FUNCTION public.remu_ajustement_after();

-- =========================================================
-- 8. MOTEUR DE CALCUL
-- =========================================================
CREATE OR REPLACE FUNCTION public.calculer_remuneration_mission(_trajet_id uuid, _force boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t record; a record; r record;
  _dist numeric; _date date; _regle_id uuid; _source text;
  _forfait numeric := 0; _km_montant numeric := 0; _base numeric := 0;
  _negoc numeric; _statut text; _detail jsonb; _existing record; _id uuid;
BEGIN
  SELECT * INTO t FROM public.trajets WHERE id = _trajet_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT * INTO _existing FROM public.remunerations_missions WHERE trajet_id = _trajet_id;
  IF FOUND AND NOT _force THEN RETURN _existing.id; END IF;
  IF FOUND AND _existing.statut IN ('paye','valide') AND NOT _force THEN RETURN _existing.id; END IF;

  SELECT * INTO a FROM public.attributions
   WHERE trajet_id = _trajet_id AND statut <> 'annule'
   ORDER BY created_at DESC LIMIT 1;

  _date := COALESCE(t.date_trajet, t.date_souhaitee, CURRENT_DATE);

  SELECT COALESCE(d.distance_km, dc.distance_km) INTO _dist
  FROM (SELECT 1) x
  LEFT JOIN public.devis d ON d.id = t.devis_id
  LEFT JOIN public.demandes_convoyage dc ON dc.id = t.demande_id;

  SELECT * INTO r FROM public.regles_remuneration
   WHERE actif = true
     AND date_debut <= _date
     AND (date_fin IS NULL OR date_fin >= _date)
     AND (cond_vehicule_type IS NULL OR cond_vehicule_type = t.vehicule_type)
     AND (cond_type_mission IS NULL OR cond_type_mission = t.type_mission)
     AND (cond_distance_min IS NULL OR COALESCE(_dist,0) >= cond_distance_min)
     AND (cond_distance_max IS NULL OR COALESCE(_dist,0) <= cond_distance_max)
   ORDER BY priorite DESC, created_at DESC
   LIMIT 1;

  _negoc := COALESCE(t.prix_convoyeur_fixe, t.prix_convoyeur, t.tarif_convoyeur);

  IF FOUND THEN
    _regle_id := r.id; _source := 'regle';
    IF r.type_regle = 'forfait' THEN
      _forfait := r.montant_forfait;
    ELSIF r.type_regle = 'km' THEN
      _km_montant := ROUND(COALESCE(_dist,0) * r.taux_km, 2);
    ELSE
      _forfait := r.montant_forfait;
      _km_montant := ROUND(GREATEST(COALESCE(_dist,0) - r.seuil_km, 0) * r.taux_km, 2);
    END IF;
    _base := _forfait + _km_montant;
    IF r.montant_min IS NOT NULL AND _base < r.montant_min THEN _base := r.montant_min; END IF;
    _statut := 'en_attente';
  ELSIF _negoc IS NOT NULL AND _negoc > 0 THEN
    _source := 'prix_negocie'; _forfait := _negoc; _base := _negoc; _statut := 'en_attente';
  ELSE
    _source := 'aucune_regle'; _base := 0; _statut := 'a_valider';
  END IF;

  _detail := jsonb_build_object(
    'source', _source,
    'regle', CASE WHEN _regle_id IS NULL THEN NULL ELSE jsonb_build_object(
        'id', r.id, 'libelle', r.libelle, 'type_regle', r.type_regle,
        'montant_forfait', r.montant_forfait, 'taux_km', r.taux_km, 'seuil_km', r.seuil_km,
        'montant_min', r.montant_min) END,
    'distance_km', _dist,
    'base_forfait', _forfait,
    'base_km_montant', _km_montant,
    'montant_base', _base,
    'calcule_le', now(),
    'note', CASE WHEN _source = 'aucune_regle'
       THEN 'Aucune règle de rémunération active ne correspond et aucun prix convoyeur négocié : validation manuelle requise.'
       WHEN _source = 'prix_negocie' THEN 'Prix convoyeur négocié sur la mission (aucune règle applicable).'
       ELSE NULL END
  );

  IF _existing.id IS NOT NULL THEN
    UPDATE public.remunerations_missions SET
      attribution_id = a.id, convoyeur_id = a.convoyeur_id,
      numero_mission = COALESCE(t.numero_mission, a.numero_mission),
      date_mission = _date, regle_id = _regle_id, source_calcul = _source,
      distance_km = _dist, base_forfait = _forfait, base_km_montant = _km_montant,
      montant_base = _base, montant_total = ROUND(_base + total_ajustements, 2),
      statut = CASE WHEN statut IN ('paye','valide','litige') THEN statut ELSE _statut END,
      calcul_detail = _detail, calcule_at = now()
    WHERE id = _existing.id RETURNING id INTO _id;
  ELSE
    INSERT INTO public.remunerations_missions (
      trajet_id, attribution_id, convoyeur_id, numero_mission, date_mission,
      regle_id, source_calcul, distance_km, base_forfait, base_km_montant,
      montant_base, montant_total, statut, calcul_detail)
    VALUES (_trajet_id, a.id, a.convoyeur_id, COALESCE(t.numero_mission, a.numero_mission), _date,
      _regle_id, _source, _dist, _forfait, _km_montant, _base, _base, _statut, _detail)
    RETURNING id INTO _id;
  END IF;

  RETURN _id;
END; $$;

REVOKE ALL ON FUNCTION public.calculer_remuneration_mission(uuid, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.calculer_remuneration_mission(uuid, boolean) TO authenticated, service_role;

-- Déclencheurs : mission terminée
CREATE OR REPLACE FUNCTION public.trg_trajet_termine_remuneration()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.statut = 'termine' AND (TG_OP = 'INSERT' OR OLD.statut IS DISTINCT FROM 'termine') THEN
    PERFORM public.calculer_remuneration_mission(NEW.id, false);
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_trajets_remuneration AFTER INSERT OR UPDATE OF statut ON public.trajets
  FOR EACH ROW EXECUTE FUNCTION public.trg_trajet_termine_remuneration();

CREATE OR REPLACE FUNCTION public.trg_attribution_termine_remuneration()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.statut = 'termine' AND (TG_OP = 'INSERT' OR OLD.statut IS DISTINCT FROM 'termine') THEN
    PERFORM public.calculer_remuneration_mission(NEW.trajet_id, false);
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_attributions_remuneration AFTER INSERT OR UPDATE OF statut ON public.attributions
  FOR EACH ROW EXECUTE FUNCTION public.trg_attribution_termine_remuneration();
