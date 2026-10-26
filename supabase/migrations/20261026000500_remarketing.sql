-- Ligneo Remarketing : dossiers véhicules (8 étapes), prestataires, parcs, journal, réglages.
CREATE SEQUENCE IF NOT EXISTS public.remarketing_ref_seq START 2045;

CREATE TABLE IF NOT EXISTS public.remarketing_prestataires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  specialite text,
  ville text,
  delai_moyen_jours numeric(4,1),
  note numeric(2,1),
  contact_email text,
  contact_tel text,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.remarketing_parcs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  ville text,
  capacite integer NOT NULL DEFAULT 20 CHECK (capacite >= 0),
  occupees integer NOT NULL DEFAULT 0 CHECK (occupees >= 0),
  cameras boolean NOT NULL DEFAULT true,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.remarketing_dossiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref text NOT NULL UNIQUE DEFAULT ('RMK-' || nextval('public.remarketing_ref_seq')),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  immatriculation text NOT NULL,
  modele text NOT NULL,
  motif text NOT NULL CHECK (motif IN ('fin_leasing','nouveau_collaborateur','remise_vente')),
  etape integer NOT NULL DEFAULT 1 CHECK (etape BETWEEN 1 AND 8),
  statut text NOT NULL DEFAULT 'en_cours' CHECK (statut IN ('en_cours','livre','annule')),
  adresse_enlevement text,
  date_enlevement date,
  contact_site text,
  remarques text,
  dommages text[] NOT NULL DEFAULT '{}',
  devis_statut text CHECK (devis_statut IN ('en_attente','valide','refuse')),
  devis_classique numeric(10,2),
  devis_ligneo numeric(10,2),
  devis_lignes jsonb NOT NULL DEFAULT '[]'::jsonb,
  prestataire_id uuid REFERENCES public.remarketing_prestataires(id) ON DELETE SET NULL,
  parc_id uuid REFERENCES public.remarketing_parcs(id) ON DELETE SET NULL,
  livraison jsonb,
  facture_ref text,
  facture_statut text CHECK (facture_statut IN ('a_regler','payee')),
  notes_internes text,
  created_by uuid,
  livre_le timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rmk_dossiers_org ON public.remarketing_dossiers(organization_id);
CREATE INDEX IF NOT EXISTS idx_rmk_dossiers_etape ON public.remarketing_dossiers(etape) WHERE statut = 'en_cours';

CREATE TABLE IF NOT EXISTS public.remarketing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id uuid REFERENCES public.remarketing_dossiers(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'info',
  message text NOT NULL,
  acteur text,
  visible_client boolean NOT NULL DEFAULT true,
  planifie_le timestamptz,
  lieu text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rmk_events_dossier ON public.remarketing_events(dossier_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_rmk_dossiers_updated ON public.remarketing_dossiers;
CREATE TRIGGER trg_rmk_dossiers_updated BEFORE UPDATE ON public.remarketing_dossiers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.remarketing_prestataires ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remarketing_parcs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remarketing_dossiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remarketing_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_staff_admin(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_uid,'admin') OR public.has_role(_uid,'super_admin')
$$;

DROP POLICY IF EXISTS rmk_presta_admin ON public.remarketing_prestataires;
CREATE POLICY rmk_presta_admin ON public.remarketing_prestataires FOR ALL TO authenticated
  USING (public.is_staff_admin(auth.uid())) WITH CHECK (public.is_staff_admin(auth.uid()));
DROP POLICY IF EXISTS rmk_parcs_admin ON public.remarketing_parcs;
CREATE POLICY rmk_parcs_admin ON public.remarketing_parcs FOR ALL TO authenticated
  USING (public.is_staff_admin(auth.uid())) WITH CHECK (public.is_staff_admin(auth.uid()));

DROP POLICY IF EXISTS rmk_dossiers_admin ON public.remarketing_dossiers;
CREATE POLICY rmk_dossiers_admin ON public.remarketing_dossiers FOR ALL TO authenticated
  USING (public.is_staff_admin(auth.uid())) WITH CHECK (public.is_staff_admin(auth.uid()));
DROP POLICY IF EXISTS rmk_dossiers_member_select ON public.remarketing_dossiers;
CREATE POLICY rmk_dossiers_member_select ON public.remarketing_dossiers FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
-- Le client ouvre un dossier : toujours à l'étape 1, sans devis (le reste est géré par Ligneo).
DROP POLICY IF EXISTS rmk_dossiers_member_insert ON public.remarketing_dossiers;
CREATE POLICY rmk_dossiers_member_insert ON public.remarketing_dossiers FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id, auth.uid()) AND etape = 1 AND statut = 'en_cours'
              AND devis_statut IS NULL AND prestataire_id IS NULL AND parc_id IS NULL AND facture_ref IS NULL);

DROP POLICY IF EXISTS rmk_events_admin ON public.remarketing_events;
CREATE POLICY rmk_events_admin ON public.remarketing_events FOR ALL TO authenticated
  USING (public.is_staff_admin(auth.uid())) WITH CHECK (public.is_staff_admin(auth.uid()));
DROP POLICY IF EXISTS rmk_events_member_select ON public.remarketing_events;
CREATE POLICY rmk_events_member_select ON public.remarketing_events FOR SELECT TO authenticated
  USING (visible_client AND EXISTS (SELECT 1 FROM public.remarketing_dossiers d
         WHERE d.id = dossier_id AND public.is_org_member(d.organization_id, auth.uid())));

-- Actions du client (seules écritures qu'il peut faire sur un dossier existant)
CREATE OR REPLACE FUNCTION public.remarketing_valider_devis(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.remarketing_dossiers;
BEGIN
  SELECT * INTO d FROM public.remarketing_dossiers WHERE id = p_id;
  IF NOT FOUND OR NOT (public.is_org_member(d.organization_id, auth.uid()) OR public.is_staff_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Dossier introuvable';
  END IF;
  IF d.devis_statut IS DISTINCT FROM 'en_attente' THEN RAISE EXCEPTION 'Aucun devis en attente'; END IF;
  UPDATE public.remarketing_dossiers SET devis_statut = 'valide', etape = GREATEST(etape, 4) WHERE id = p_id;
  INSERT INTO public.remarketing_events(dossier_id, kind, message, acteur)
  VALUES (p_id, 'devis', 'Devis validé : les réparations peuvent démarrer', CASE WHEN public.is_staff_admin(auth.uid()) THEN 'Admin (au nom du client)' ELSE 'Client' END);
END $$;

CREATE OR REPLACE FUNCTION public.remarketing_refuser_devis(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.remarketing_dossiers;
BEGIN
  SELECT * INTO d FROM public.remarketing_dossiers WHERE id = p_id;
  IF NOT FOUND OR NOT public.is_org_member(d.organization_id, auth.uid()) THEN RAISE EXCEPTION 'Dossier introuvable'; END IF;
  IF d.devis_statut IS DISTINCT FROM 'en_attente' THEN RAISE EXCEPTION 'Aucun devis en attente'; END IF;
  UPDATE public.remarketing_dossiers SET devis_statut = 'refuse' WHERE id = p_id;
  INSERT INTO public.remarketing_events(dossier_id, kind, message, acteur) VALUES (p_id, 'devis', 'Devis refusé : un conseiller va rappeler le client', 'Client');
END $$;

CREATE OR REPLACE FUNCTION public.remarketing_demander_livraison(p_id uuid, p_payload jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.remarketing_dossiers;
BEGIN
  SELECT * INTO d FROM public.remarketing_dossiers WHERE id = p_id;
  IF NOT FOUND OR NOT public.is_org_member(d.organization_id, auth.uid()) THEN RAISE EXCEPTION 'Dossier introuvable'; END IF;
  IF d.etape < 7 THEN RAISE EXCEPTION 'Le véhicule n''est pas encore en parc'; END IF;
  UPDATE public.remarketing_dossiers SET etape = 8, livraison = p_payload WHERE id = p_id;
  INSERT INTO public.remarketing_events(dossier_id, kind, message, acteur)
  VALUES (p_id, 'livraison', 'Livraison demandée pour ' || COALESCE(p_payload->>'collaborateur','un collaborateur'), 'Client');
END $$;

REVOKE ALL ON FUNCTION public.remarketing_valider_devis(uuid), public.remarketing_refuser_devis(uuid), public.remarketing_demander_livraison(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remarketing_valider_devis(uuid), public.remarketing_refuser_devis(uuid), public.remarketing_demander_livraison(uuid, jsonb) TO authenticated;

INSERT INTO public.app_settings (key, value)
VALUES ('remarketing_settings', '{"trajets_charge_ligneo": true, "devis_obligatoire": true, "livraison_sur_demande": true, "relance_devis": true, "notif_etapes": false, "tarif_livraison": "49 €", "delai_relance_h": 48}'::jsonb)
ON CONFLICT (key) DO NOTHING;
