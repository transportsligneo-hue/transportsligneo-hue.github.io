-- Ligneo Remarketing V2 : appels d'offres, devis multiples comparés, portail prestataire,
-- chantiers en direct, factures, dossier final, données fictives du compte démo flotte.

-- ---------- Prestataires : compte de connexion, rayon, garantie, tarifs ----------
ALTER TABLE public.remarketing_prestataires
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS rayon_km integer NOT NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS garantie_mois integer NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS tarifs jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS uq_rmk_presta_user ON public.remarketing_prestataires(user_id) WHERE user_id IS NOT NULL;
ALTER TABLE public.remarketing_parcs ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

-- ---------- Dossiers : chantier en direct, factures, kilométrage ----------
ALTER TABLE public.remarketing_dossiers
  ADD COLUMN IF NOT EXISTS chantier_step integer CHECK (chantier_step BETWEEN 0 AND 6),
  ADD COLUMN IF NOT EXISTS chantier_note text,
  ADD COLUMN IF NOT EXISTS chantier_maj timestamptz,
  ADD COLUMN IF NOT EXISTS chantier_prevu date,
  ADD COLUMN IF NOT EXISTS factures jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS kilometrage integer,
  ADD COLUMN IF NOT EXISTS devis_retenu_id uuid;

-- ---------- Devis des prestataires (un par prestataire et par dossier) ----------
CREATE TABLE IF NOT EXISTS public.remarketing_devis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id uuid NOT NULL REFERENCES public.remarketing_dossiers(id) ON DELETE CASCADE,
  prestataire_id uuid NOT NULL REFERENCES public.remarketing_prestataires(id) ON DELETE CASCADE,
  statut text NOT NULL DEFAULT 'demande' CHECK (statut IN ('demande','recu','retenu','refuse','expire')),
  lignes jsonb NOT NULL DEFAULT '[]'::jsonb,        -- [{label,type,qte,prix_ht}]
  total_ht numeric(10,2),
  total_ttc numeric(10,2),
  delai_jours integer,
  debut_possible date,
  validite_jours integer NOT NULL DEFAULT 15,
  garantie_mois integer,
  peinture_cabine boolean NOT NULL DEFAULT false,
  courtoisie boolean NOT NULL DEFAULT false,
  commentaire text,
  date_limite timestamptz,
  repondu_le timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dossier_id, prestataire_id)
);
CREATE INDEX IF NOT EXISTS idx_rmk_devis_dossier ON public.remarketing_devis(dossier_id);
CREATE INDEX IF NOT EXISTS idx_rmk_devis_presta ON public.remarketing_devis(prestataire_id);
DROP TRIGGER IF EXISTS trg_rmk_devis_updated ON public.remarketing_devis;
CREATE TRIGGER trg_rmk_devis_updated BEFORE UPDATE ON public.remarketing_devis
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.remarketing_devis ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rmk_devis_admin ON public.remarketing_devis;
CREATE POLICY rmk_devis_admin ON public.remarketing_devis FOR ALL TO authenticated
  USING (public.is_staff_admin(auth.uid())) WITH CHECK (public.is_staff_admin(auth.uid()));
-- Le client voit les devis reçus pour ses dossiers (jamais les simples demandes).
DROP POLICY IF EXISTS rmk_devis_member_select ON public.remarketing_devis;
CREATE POLICY rmk_devis_member_select ON public.remarketing_devis FOR SELECT TO authenticated
  USING (statut IN ('recu','retenu','refuse') AND EXISTS (SELECT 1 FROM public.remarketing_dossiers d
         WHERE d.id = dossier_id AND public.is_org_member(d.organization_id, auth.uid())));

-- Le compte démo flotte ne peut rien écrire (les fonctions ci-dessous le refusent aussi).
DO $$
DECLARE t text; c text;
BEGIN
  FOREACH t IN ARRAY ARRAY['remarketing_dossiers','remarketing_events','remarketing_devis'] LOOP
    FOREACH c IN ARRAY ARRAY['insert','update','delete'] LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'demo_block_'||c, t);
      IF c = 'insert' THEN
        EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT public.is_demo_account())', 'demo_block_'||c, t);
      ELSE
        EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR %s TO authenticated USING (NOT public.is_demo_account())', 'demo_block_'||c, t, c);
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- ---------- Fonctions ----------
CREATE OR REPLACE FUNCTION public.rmk_no_demo() RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_demo_account() THEN RAISE EXCEPTION 'Mode démonstration : cette action est désactivée.'; END IF;
END $$;

-- Anciennes actions du client : on ajoute le blocage démo.
CREATE OR REPLACE FUNCTION public.remarketing_valider_devis(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.remarketing_dossiers;
BEGIN
  PERFORM public.rmk_no_demo();
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
  PERFORM public.rmk_no_demo();
  SELECT * INTO d FROM public.remarketing_dossiers WHERE id = p_id;
  IF NOT FOUND OR NOT public.is_org_member(d.organization_id, auth.uid()) THEN RAISE EXCEPTION 'Dossier introuvable'; END IF;
  IF d.devis_statut IS DISTINCT FROM 'en_attente' THEN RAISE EXCEPTION 'Aucun devis en attente'; END IF;
  UPDATE public.remarketing_dossiers SET devis_statut = 'refuse' WHERE id = p_id;
  UPDATE public.remarketing_devis SET statut = 'refuse' WHERE dossier_id = p_id AND statut = 'recu';
  INSERT INTO public.remarketing_events(dossier_id, kind, message, acteur) VALUES (p_id, 'devis', 'Devis refusé : un conseiller va rappeler le client', 'Client');
END $$;

CREATE OR REPLACE FUNCTION public.remarketing_demander_livraison(p_id uuid, p_payload jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.remarketing_dossiers;
BEGIN
  PERFORM public.rmk_no_demo();
  SELECT * INTO d FROM public.remarketing_dossiers WHERE id = p_id;
  IF NOT FOUND OR NOT public.is_org_member(d.organization_id, auth.uid()) THEN RAISE EXCEPTION 'Dossier introuvable'; END IF;
  IF d.etape < 7 THEN RAISE EXCEPTION 'Le véhicule n''est pas encore en parc'; END IF;
  UPDATE public.remarketing_dossiers SET etape = 8, livraison = p_payload WHERE id = p_id;
  INSERT INTO public.remarketing_events(dossier_id, kind, message, acteur)
  VALUES (p_id, 'livraison', 'Livraison demandée pour ' || COALESCE(p_payload->>'collaborateur','un collaborateur'), 'Client');
END $$;

-- Admin : lancer l'appel d'offres vers plusieurs prestataires.
CREATE OR REPLACE FUNCTION public.remarketing_lancer_appel_offres(p_dossier uuid, p_prestataires uuid[], p_limite timestamptz DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer := 0; pid uuid;
BEGIN
  PERFORM public.rmk_no_demo();
  IF NOT public.is_staff_admin(auth.uid()) THEN RAISE EXCEPTION 'Réservé à l''équipe Ligneo'; END IF;
  IF p_prestataires IS NULL OR array_length(p_prestataires, 1) IS NULL THEN RAISE EXCEPTION 'Choisis au moins un prestataire'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.remarketing_dossiers WHERE id = p_dossier AND statut = 'en_cours') THEN RAISE EXCEPTION 'Dossier introuvable'; END IF;
  FOREACH pid IN ARRAY p_prestataires LOOP
    INSERT INTO public.remarketing_devis(dossier_id, prestataire_id, statut, date_limite)
    VALUES (p_dossier, pid, 'demande', COALESCE(p_limite, now() + interval '48 hours'))
    ON CONFLICT (dossier_id, prestataire_id) DO NOTHING;
    IF FOUND THEN n := n + 1; END IF;
  END LOOP;
  UPDATE public.remarketing_dossiers SET etape = GREATEST(etape, 3) WHERE id = p_dossier;
  INSERT INTO public.remarketing_events(dossier_id, kind, message, acteur)
  VALUES (p_dossier, 'appel_offres', 'Appel d''offres envoyé à ' || n || ' prestataire' || CASE WHEN n > 1 THEN 's' ELSE '' END, 'Ligneo');
  RETURN n;
END $$;

-- Admin : relier un prestataire à un compte (e-mail de connexion).
CREATE OR REPLACE FUNCTION public.remarketing_lier_prestataire(p_id uuid, p_email text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid;
BEGIN
  PERFORM public.rmk_no_demo();
  IF NOT public.is_staff_admin(auth.uid()) THEN RAISE EXCEPTION 'Réservé à l''équipe Ligneo'; END IF;
  IF p_email IS NULL OR btrim(p_email) = '' THEN
    UPDATE public.remarketing_prestataires SET user_id = NULL WHERE id = p_id;
    RETURN true;
  END IF;
  SELECT id INTO uid FROM auth.users WHERE lower(email) = lower(btrim(p_email)) LIMIT 1;
  IF uid IS NULL THEN RAISE EXCEPTION 'Aucun compte avec cet e-mail : le prestataire doit d''abord créer son compte.'; END IF;
  UPDATE public.remarketing_prestataires SET user_id = uid WHERE id = p_id;
  RETURN true;
END $$;

-- Prestataire : tout son portail en un appel (demandes, chantiers, indicateurs).
CREATE OR REPLACE FUNCTION public.remarketing_presta_overview()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE pr public.remarketing_prestataires; dem jsonb; cha jsonb; env integer; ok integer;
BEGIN
  SELECT * INTO pr FROM public.remarketing_prestataires WHERE user_id = auth.uid() AND actif LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'devis_id', q.id, 'statut', q.statut, 'date_limite', q.date_limite, 'dossier_id', d.id,
      'modele', d.modele, 'immatriculation', d.immatriculation, 'motif', d.motif, 'dommages', d.dommages,
      'remarques', d.remarques, 'kilometrage', d.kilometrage, 'lieu', d.adresse_enlevement,
      'lignes', q.lignes, 'total_ttc', q.total_ttc, 'delai_jours', q.delai_jours, 'garantie_mois', q.garantie_mois,
      'validite_jours', q.validite_jours, 'peinture_cabine', q.peinture_cabine, 'courtoisie', q.courtoisie,
      'commentaire', q.commentaire, 'debut_possible', q.debut_possible
    ) ORDER BY q.date_limite NULLS LAST), '[]'::jsonb)
  INTO dem
  FROM public.remarketing_devis q JOIN public.remarketing_dossiers d ON d.id = q.dossier_id
  WHERE q.prestataire_id = pr.id AND q.statut IN ('demande','recu') AND d.devis_retenu_id IS NULL AND d.statut = 'en_cours';

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'dossier_id', d.id, 'ref', d.ref, 'modele', d.modele, 'immatriculation', d.immatriculation, 'etape', d.etape,
      'chantier_step', COALESCE(d.chantier_step, 0), 'chantier_note', d.chantier_note, 'chantier_maj', d.chantier_maj,
      'chantier_prevu', d.chantier_prevu, 'montant', d.devis_ligneo, 'lignes', d.devis_lignes, 'dommages', d.dommages,
      'created_at', d.created_at,
      'events', COALESCE((SELECT jsonb_agg(jsonb_build_object('at', e.created_at, 'message', e.message, 'acteur', e.acteur) ORDER BY e.created_at DESC)
                          FROM (SELECT * FROM public.remarketing_events x WHERE x.dossier_id = d.id AND x.kind = 'chantier' ORDER BY x.created_at DESC LIMIT 12) e), '[]'::jsonb)
    ) ORDER BY d.updated_at DESC), '[]'::jsonb)
  INTO cha
  FROM public.remarketing_dossiers d
  WHERE d.prestataire_id = pr.id AND d.statut = 'en_cours' AND d.etape BETWEEN 4 AND 7;

  SELECT count(*) FILTER (WHERE statut IN ('recu','retenu','refuse')), count(*) FILTER (WHERE statut = 'retenu')
  INTO env, ok FROM public.remarketing_devis WHERE prestataire_id = pr.id AND created_at > now() - interval '30 days';

  RETURN jsonb_build_object(
    'prestataire', jsonb_build_object('id', pr.id, 'nom', pr.nom, 'specialite', pr.specialite, 'ville', pr.ville, 'rayon_km', pr.rayon_km,
                                      'garantie_mois', pr.garantie_mois, 'tarifs', pr.tarifs, 'delai_moyen_jours', pr.delai_moyen_jours, 'note', pr.note),
    'demandes', dem, 'chantiers', cha, 'devis_envoyes_30j', env, 'devis_acceptes_30j', ok);
END $$;

-- Prestataire : répondre à une demande de devis.
CREATE OR REPLACE FUNCTION public.remarketing_presta_envoyer_devis(p_devis uuid, p_payload jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pr public.remarketing_prestataires; q public.remarketing_devis; d public.remarketing_dossiers; v_lignes jsonb; v_ht numeric;
BEGIN
  PERFORM public.rmk_no_demo();
  SELECT * INTO pr FROM public.remarketing_prestataires WHERE user_id = auth.uid() AND actif LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Compte prestataire introuvable'; END IF;
  SELECT * INTO q FROM public.remarketing_devis WHERE id = p_devis AND prestataire_id = pr.id;
  IF NOT FOUND OR q.statut NOT IN ('demande','recu') THEN RAISE EXCEPTION 'Demande introuvable ou déjà clôturée'; END IF;
  SELECT * INTO d FROM public.remarketing_dossiers WHERE id = q.dossier_id;
  IF d.devis_retenu_id IS NOT NULL OR d.statut <> 'en_cours' THEN RAISE EXCEPTION 'Le client a déjà choisi un devis'; END IF;
  IF jsonb_typeof(p_payload->'lignes') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Ajoute au moins une ligne chiffrée'; END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'label', left(l->>'label', 120), 'type', left(COALESCE(NULLIF(l->>'type',''), 'Forfait'), 30),
      'qte', GREATEST(1, COALESCE((l->>'qte')::numeric, 1)), 'prix_ht', GREATEST(0, COALESCE((l->>'prix_ht')::numeric, 0)))), '[]'::jsonb)
  INTO v_lignes FROM jsonb_array_elements(p_payload->'lignes') l WHERE COALESCE(btrim(l->>'label'), '') <> '';
  IF jsonb_array_length(v_lignes) = 0 THEN RAISE EXCEPTION 'Ajoute au moins une ligne chiffrée'; END IF;
  SELECT COALESCE(SUM((l->>'qte')::numeric * (l->>'prix_ht')::numeric), 0) INTO v_ht FROM jsonb_array_elements(v_lignes) l;
  IF v_ht <= 0 THEN RAISE EXCEPTION 'Le total du devis doit être supérieur à 0'; END IF;

  UPDATE public.remarketing_devis SET
    lignes = v_lignes, total_ht = round(v_ht, 2), total_ttc = round(v_ht * 1.2, 2), statut = 'recu', repondu_le = now(),
    delai_jours = NULLIF(p_payload->>'delai_jours','')::integer,
    debut_possible = NULLIF(p_payload->>'debut_possible','')::date,
    validite_jours = COALESCE(NULLIF(p_payload->>'validite_jours','')::integer, 15),
    garantie_mois = COALESCE(NULLIF(p_payload->>'garantie_mois','')::integer, pr.garantie_mois),
    peinture_cabine = COALESCE((p_payload->>'peinture_cabine')::boolean, false),
    courtoisie = COALESCE((p_payload->>'courtoisie')::boolean, false),
    commentaire = left(NULLIF(p_payload->>'commentaire',''), 1000)
  WHERE id = q.id;

  UPDATE public.remarketing_dossiers SET
    devis_statut = CASE WHEN devis_statut IS NULL OR devis_statut = 'refuse' THEN 'en_attente' ELSE devis_statut END,
    etape = GREATEST(etape, 3)
  WHERE id = d.id;
  INSERT INTO public.remarketing_events(dossier_id, kind, message, acteur)
  VALUES (d.id, 'devis', 'Devis reçu de ' || pr.nom || ' : ' || replace(to_char(round(v_ht * 1.2, 2), 'FM9999990.00'), '.', ',') || ' € TTC', pr.nom);
END $$;

-- Prestataire : mise à jour du chantier (visible en direct par le client et Ligneo).
CREATE OR REPLACE FUNCTION public.remarketing_presta_maj_chantier(p_dossier uuid, p_step integer, p_note text DEFAULT NULL, p_prevu date DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pr public.remarketing_prestataires; d public.remarketing_dossiers;
  labels text[] := ARRAY['Reçu','Diagnostic','Pièces','Réparation','Peinture','Contrôle','Prêt'];
BEGIN
  PERFORM public.rmk_no_demo();
  SELECT * INTO pr FROM public.remarketing_prestataires WHERE user_id = auth.uid() AND actif LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Compte prestataire introuvable'; END IF;
  SELECT * INTO d FROM public.remarketing_dossiers WHERE id = p_dossier AND prestataire_id = pr.id AND statut = 'en_cours';
  IF NOT FOUND THEN RAISE EXCEPTION 'Chantier introuvable'; END IF;
  IF p_step IS NULL OR p_step < 0 OR p_step > 6 THEN RAISE EXCEPTION 'Étape invalide'; END IF;
  UPDATE public.remarketing_dossiers SET
    chantier_step = p_step, chantier_note = left(NULLIF(btrim(COALESCE(p_note,'')), ''), 300), chantier_maj = now(), chantier_prevu = COALESCE(p_prevu, chantier_prevu),
    etape = CASE WHEN p_step = 6 THEN GREATEST(etape, 6) ELSE GREATEST(etape, 5) END
  WHERE id = d.id;
  INSERT INTO public.remarketing_events(dossier_id, kind, message, acteur)
  VALUES (d.id, 'chantier', 'Statut : ' || labels[p_step + 1] || CASE WHEN NULLIF(btrim(COALESCE(p_note,'')), '') IS NOT NULL THEN ' · ' || left(btrim(p_note), 300) ELSE '' END, pr.nom);
END $$;

-- Client : choisir un devis et valider ligne par ligne (p_lignes_off = positions retirées, à partir de 0).
CREATE OR REPLACE FUNCTION public.remarketing_choisir_devis(p_devis uuid, p_lignes_off integer[] DEFAULT '{}')
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE q public.remarketing_devis; d public.remarketing_dossiers; pr public.remarketing_prestataires; v_lignes jsonb; v_total numeric;
BEGIN
  PERFORM public.rmk_no_demo();
  SELECT * INTO q FROM public.remarketing_devis WHERE id = p_devis;
  IF NOT FOUND THEN RAISE EXCEPTION 'Devis introuvable'; END IF;
  SELECT * INTO d FROM public.remarketing_dossiers WHERE id = q.dossier_id;
  IF NOT (public.is_org_member(d.organization_id, auth.uid()) OR public.is_staff_admin(auth.uid())) THEN RAISE EXCEPTION 'Dossier introuvable'; END IF;
  IF q.statut <> 'recu' OR d.devis_retenu_id IS NOT NULL OR d.statut <> 'en_cours' THEN RAISE EXCEPTION 'Ce devis n''est plus disponible'; END IF;
  SELECT * INTO pr FROM public.remarketing_prestataires WHERE id = q.prestataire_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('label', x.l->>'label', 'montant', round((x.l->>'qte')::numeric * (x.l->>'prix_ht')::numeric * 1.2, 2)) ORDER BY x.n), '[]'::jsonb),
         COALESCE(SUM(round((x.l->>'qte')::numeric * (x.l->>'prix_ht')::numeric * 1.2, 2)), 0)
  INTO v_lignes, v_total
  FROM jsonb_array_elements(q.lignes) WITH ORDINALITY AS x(l, n)
  WHERE NOT ((x.n - 1)::integer = ANY (COALESCE(p_lignes_off, '{}'::integer[])));
  IF v_total <= 0 THEN RAISE EXCEPTION 'Garde au moins une ligne'; END IF;

  UPDATE public.remarketing_dossiers SET
    devis_lignes = v_lignes, devis_ligneo = v_total, devis_statut = 'valide', prestataire_id = q.prestataire_id,
    devis_retenu_id = q.id, etape = GREATEST(etape, 4), chantier_step = NULL
  WHERE id = d.id;
  UPDATE public.remarketing_devis SET statut = 'retenu' WHERE id = q.id;
  UPDATE public.remarketing_devis SET statut = 'refuse' WHERE dossier_id = d.id AND id <> q.id AND statut IN ('demande','recu');
  INSERT INTO public.remarketing_events(dossier_id, kind, message, acteur)
  VALUES (d.id, 'devis', 'Devis de ' || pr.nom || ' retenu : ' || replace(to_char(v_total, 'FM9999990.00'), '.', ',') || ' € TTC', CASE WHEN public.is_staff_admin(auth.uid()) THEN 'Admin (au nom du client)' ELSE 'Client' END);
  RETURN v_total;
END $$;


-- Client / admin : devis reçus d'un dossier, avec les infos publiques du prestataire (jamais ses coordonnées).
CREATE OR REPLACE FUNCTION public.remarketing_devis_du_dossier(p_dossier uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.remarketing_dossiers;
BEGIN
  SELECT * INTO d FROM public.remarketing_dossiers WHERE id = p_dossier;
  IF NOT FOUND OR NOT (public.is_org_member(d.organization_id, auth.uid()) OR public.is_staff_admin(auth.uid())) THEN RETURN '[]'::jsonb; END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', q.id, 'statut', q.statut, 'lignes', q.lignes, 'total_ht', q.total_ht, 'total_ttc', q.total_ttc,
      'delai_jours', q.delai_jours, 'debut_possible', q.debut_possible, 'validite_jours', q.validite_jours,
      'garantie_mois', q.garantie_mois, 'peinture_cabine', q.peinture_cabine, 'courtoisie', q.courtoisie,
      'commentaire', q.commentaire, 'repondu_le', q.repondu_le,
      'prestataire', jsonb_build_object('id', p.id, 'nom', p.nom, 'ville', p.ville, 'specialite', p.specialite, 'note', p.note,
         'delai_moyen_jours', p.delai_moyen_jours,
         'chantiers', (SELECT count(*) FROM public.remarketing_dossiers x WHERE x.prestataire_id = p.id AND x.statut = 'livre'))
    ) ORDER BY q.total_ttc)
    FROM public.remarketing_devis q JOIN public.remarketing_prestataires p ON p.id = q.prestataire_id
    WHERE q.dossier_id = p_dossier AND q.statut IN ('recu','retenu','refuse')), '[]'::jsonb);
END $$;

-- Prestataire : enregistrer ses tarifs et sa garantie par défaut.
CREATE OR REPLACE FUNCTION public.remarketing_presta_save_tarifs(p_tarifs jsonb, p_garantie integer DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.rmk_no_demo();
  UPDATE public.remarketing_prestataires
     SET tarifs = COALESCE(p_tarifs, '{}'::jsonb), garantie_mois = COALESCE(p_garantie, garantie_mois)
   WHERE user_id = auth.uid() AND actif;
  IF NOT FOUND THEN RAISE EXCEPTION 'Compte prestataire introuvable'; END IF;
END $$;

REVOKE ALL ON FUNCTION public.rmk_no_demo(), public.remarketing_lancer_appel_offres(uuid, uuid[], timestamptz), public.remarketing_lier_prestataire(uuid, text),
  public.remarketing_presta_overview(), public.remarketing_presta_envoyer_devis(uuid, jsonb), public.remarketing_presta_maj_chantier(uuid, integer, text, date),
  public.remarketing_choisir_devis(uuid, integer[]), public.remarketing_devis_du_dossier(uuid), public.remarketing_presta_save_tarifs(jsonb, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remarketing_lancer_appel_offres(uuid, uuid[], timestamptz), public.remarketing_lier_prestataire(uuid, text),
  public.remarketing_presta_overview(), public.remarketing_presta_envoyer_devis(uuid, jsonb), public.remarketing_presta_maj_chantier(uuid, integer, text, date),
  public.remarketing_choisir_devis(uuid, integer[]), public.remarketing_devis_du_dossier(uuid), public.remarketing_presta_save_tarifs(jsonb, integer) TO authenticated;
-- rmk_no_demo est appelée depuis les autres fonctions (SECURITY DEFINER) : pas besoin de l'ouvrir aux clients.
REVOKE ALL ON FUNCTION public.remarketing_valider_devis(uuid), public.remarketing_refuser_devis(uuid), public.remarketing_demander_livraison(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remarketing_valider_devis(uuid), public.remarketing_refuser_devis(uuid), public.remarketing_demander_livraison(uuid, jsonb) TO authenticated;

-- Seuil d'acceptation automatique (affiché au client, réglable dans l'admin).
UPDATE public.app_settings
   SET value = value || '{"seuil_auto_eur": 300}'::jsonb
 WHERE key = 'remarketing_settings' AND NOT (value ? 'seuil_auto_eur');

-- ---------- Données fictives du compte démo flotte ----------
DO $$
DECLARE
  org uuid; m uuid; l uuid; du uuid; pk uuid;
  d1 uuid; d2 uuid; d3 uuid; d4 uuid;
BEGIN
  SELECT om.organization_id INTO org
    FROM public.organization_members om JOIN auth.users u ON u.id = om.user_id
   WHERE lower(u.email) = 'demo-flotte@transportsligneo.fr' AND om.status = 'active' LIMIT 1;
  IF org IS NULL THEN RAISE NOTICE 'Compte démo flotte introuvable : aucune donnée fictive Remarketing créée.'; RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.remarketing_dossiers WHERE organization_id = org) THEN RAISE NOTICE 'Dossiers démo déjà présents.'; RETURN; END IF;

  INSERT INTO public.remarketing_prestataires(nom, specialite, ville, delai_moyen_jours, note, actif, is_demo, garantie_mois)
  VALUES ('Carrosserie Martin', 'Carrosserie, peinture, jantes', 'Tours', 4.2, 4.8, true, true, 12) RETURNING id INTO m;
  INSERT INTO public.remarketing_prestataires(nom, specialite, ville, delai_moyen_jours, note, actif, is_demo, garantie_mois)
  VALUES ('Auto Centre Loire', 'Carrosserie, mécanique', 'Saint-Cyr-sur-Loire', 5.8, 4.5, true, true, 6) RETURNING id INTO l;
  INSERT INTO public.remarketing_prestataires(nom, specialite, ville, delai_moyen_jours, note, actif, is_demo, garantie_mois)
  VALUES ('Atelier Duval', 'Carrosserie, polissage', 'Joué-lès-Tours', 3.1, 4.6, true, true, 12) RETURNING id INTO du;
  INSERT INTO public.remarketing_parcs(nom, ville, capacite, occupees, cameras, actif, is_demo)
  VALUES ('Parc partenaire Tours Nord', 'Tours', 30, 12, true, true, true) RETURNING id INTO pk;

  -- 1 · Trois devis à comparer
  INSERT INTO public.remarketing_dossiers(organization_id, immatriculation, modele, motif, etape, adresse_enlevement, date_enlevement, contact_site, remarques,
      dommages, devis_statut, devis_classique, kilometrage, created_at)
  VALUES (org, 'AA-123-BB', 'Peugeot 308', 'fin_leasing', 3, 'Parc client, Tours', current_date - 2, 'Claire Martin · 06 00 00 00 00', 'Merci de privilégier une réparation sans remplacement de pièce.',
      ARRAY['Rayure portière AV G','Jante AV D éraflée','Rétroviseur G fissuré'], 'en_attente', 920, 48212, now() - interval '2 days') RETURNING id INTO d1;
  INSERT INTO public.remarketing_devis(dossier_id, prestataire_id, statut, lignes, total_ht, total_ttc, delai_jours, debut_possible, validite_jours, garantie_mois, peinture_cabine, courtoisie, commentaire, date_limite, repondu_le) VALUES
   (d1, m, 'recu', '[{"label":"Rayure portière AV G","type":"Peinture","qte":1,"prix_ht":200},{"label":"Jante AV D","type":"Main d''œuvre","qte":1,"prix_ht":80},{"label":"Rétroviseur G","type":"Pièce","qte":1,"prix_ht":90},{"label":"Polissage complet","type":"Main d''œuvre","qte":1,"prix_ht":50}]', 420, 504, 4, current_date + 1, 15, 12, true, false, 'Réparation sans remplacement de la portière, peinture en cabine.', now() + interval '1 day', now() - interval '20 hours'),
   (d1, l, 'recu', '[{"label":"Rayure portière AV G","type":"Peinture","qte":1,"prix_ht":240},{"label":"Jante AV D","type":"Main d''œuvre","qte":1,"prix_ht":100},{"label":"Rétroviseur G","type":"Pièce","qte":1,"prix_ht":110}]', 450, 540, 6, current_date + 2, 15, 6, true, true, NULL, now() + interval '1 day', now() - interval '14 hours'),
   (d1, du, 'recu', '[{"label":"Rayure portière AV G","type":"Peinture","qte":1,"prix_ht":255},{"label":"Jante AV D","type":"Main d''œuvre","qte":1,"prix_ht":90},{"label":"Rétroviseur G","type":"Pièce","qte":1,"prix_ht":125},{"label":"Polissage complet","type":"Main d''œuvre","qte":1,"prix_ht":65}]', 535, 642, 3, current_date + 1, 30, 12, true, false, 'Disponible immédiatement.', now() + interval '1 day', now() - interval '9 hours');
  INSERT INTO public.remarketing_events(dossier_id, kind, message, acteur, created_at) VALUES
   (d1, 'dossier', 'Dossier ouvert', 'Client', now() - interval '2 days'),
   (d1, 'prise_en_charge', 'Véhicule enlevé par Julien M., état des lieux signé', 'Ligneo', now() - interval '47 hours'),
   (d1, 'appel_offres', 'Appel d''offres envoyé à 3 prestataires', 'Ligneo', now() - interval '44 hours'),
   (d1, 'devis', 'Devis reçu de Carrosserie Martin : 504,00 € TTC', 'Carrosserie Martin', now() - interval '20 hours'),
   (d1, 'devis', 'Devis reçu de Auto Centre Loire : 540,00 € TTC', 'Auto Centre Loire', now() - interval '14 hours'),
   (d1, 'devis', 'Devis reçu de Atelier Duval : 642,00 € TTC', 'Atelier Duval', now() - interval '9 hours');

  -- 2 · Chantier en direct
  INSERT INTO public.remarketing_dossiers(organization_id, immatriculation, modele, motif, etape, adresse_enlevement, date_enlevement, dommages, devis_statut, devis_classique, devis_ligneo,
      devis_lignes, prestataire_id, chantier_step, chantier_note, chantier_maj, chantier_prevu, kilometrage, created_at)
  VALUES (org, 'BB-456-CC', 'Peugeot 3008', 'nouveau_collaborateur', 5, 'Agence Tours Centre', current_date - 6, ARRAY['Pare-chocs avant','Aile avant droite'], 'valide', 1100, 640,
      '[{"label":"Pare-chocs avant","montant":360},{"label":"Aile avant droite","montant":280}]'::jsonb, m, 3, 'Peinture en cabine jeudi matin', now() - interval '3 hours', current_date + 2, 31840, now() - interval '6 days') RETURNING id INTO d2;
  INSERT INTO public.remarketing_events(dossier_id, kind, message, acteur, created_at) VALUES
   (d2, 'dossier', 'Dossier ouvert', 'Client', now() - interval '6 days'),
   (d2, 'prise_en_charge', 'Véhicule enlevé par Julien M., état des lieux signé', 'Ligneo', now() - interval '5 days'),
   (d2, 'devis', 'Devis de Carrosserie Martin retenu : 640,00 € TTC', 'Client', now() - interval '4 days'),
   (d2, 'trajet', 'Convoyage vers Carrosserie Martin · 23 km', 'Ligneo', now() - interval '3 days 6 hours'),
   (d2, 'chantier', 'Statut : Reçu · véhicule réceptionné', 'Carrosserie Martin', now() - interval '3 days 5 hours'),
   (d2, 'chantier', 'Statut : Pièces · pare-chocs avant monté à blanc', 'Carrosserie Martin', now() - interval '26 hours'),
   (d2, 'chantier', 'Statut : Réparation · aile avant droite redressée', 'Carrosserie Martin', now() - interval '3 hours');

  -- 3 · En parc partenaire, prêt à livrer
  INSERT INTO public.remarketing_dossiers(organization_id, immatriculation, modele, motif, etape, adresse_enlevement, dommages, devis_statut, devis_classique, devis_ligneo,
      devis_lignes, prestataire_id, parc_id, chantier_step, chantier_maj, kilometrage, created_at, factures)
  VALUES (org, 'CC-789-DD', 'Renault Trafic', 'remise_vente', 7, 'Dépôt Joué-lès-Tours', ARRAY['Pare-chocs arrière','Feu arrière fissuré'], 'valide', 780, 410,
      '[{"label":"Pare-chocs arrière","montant":290},{"label":"Feu arrière","montant":120}]'::jsonb, du, pk, 6, now() - interval '2 days', 87420, now() - interval '11 days',
      '[{"ref":"FA-2026-1201","emetteur":"Atelier Duval","objet":"Remise en état (2 lignes)","statut":"a_regler","ttc":410}]'::jsonb) RETURNING id INTO d3;
  INSERT INTO public.remarketing_events(dossier_id, kind, message, acteur, created_at) VALUES
   (d3, 'dossier', 'Dossier ouvert', 'Client', now() - interval '11 days'),
   (d3, 'devis', 'Devis de Atelier Duval retenu : 410,00 € TTC', 'Client', now() - interval '9 days'),
   (d3, 'chantier', 'Statut : Prêt · contrôle qualité validé', 'Atelier Duval', now() - interval '2 days'),
   (d3, 'parc', 'Véhicule en stationnement au Parc partenaire Tours Nord', 'Ligneo', now() - interval '1 day');

  -- 4 · Dossier terminé : historique complet, factures, livraison
  INSERT INTO public.remarketing_dossiers(organization_id, immatriculation, modele, motif, etape, statut, adresse_enlevement, date_enlevement, dommages, devis_statut, devis_classique, devis_ligneo,
      devis_lignes, prestataire_id, parc_id, chantier_step, chantier_maj, kilometrage, created_at, livre_le, facture_ref, facture_statut, livraison, factures)
  VALUES (org, 'DD-321-EE', 'Citroën C4', 'fin_leasing', 8, 'livre', 'Parc client, Tours', current_date - 12, ARRAY['Rayure portière AV G','Jante AV D','Rétroviseur G'], 'valide', 1180, 505,
      '[{"label":"Rayure portière AV G","montant":240},{"label":"Jante AV D","montant":95},{"label":"Rétroviseur G","montant":110},{"label":"Polissage complet","montant":60}]'::jsonb, m, pk, 6, now() - interval '6 days', 52118,
      now() - interval '14 days', now() - interval '5 days', 'FAC-DEMO-0391', 'payee', '{"collaborateur":"Sophie Lambert","adresse":"12 rue Nationale, Tours","creneau":"Matin"}'::jsonb,
      '[{"ref":"FA-2026-1187","emetteur":"Carrosserie Martin","objet":"Remise en état (4 lignes)","statut":"payee","ttc":505},{"ref":"LG-2026-0391","emetteur":"Transports Ligneo","objet":"Convoyage de livraison · 60 km","statut":"payee","ttc":86.4},{"ref":"LG-2026-0392","emetteur":"Transports Ligneo","objet":"Enlèvement et trajet atelier","statut":"offert","ttc":0}]'::jsonb) RETURNING id INTO d4;
  INSERT INTO public.remarketing_events(dossier_id, kind, message, acteur, created_at) VALUES
   (d4, 'dossier', 'Demande de remise en état créée · 3 dégâts signalés', 'Client', now() - interval '14 days'),
   (d4, 'prise_en_charge', 'Enlèvement par Julien M. · état des lieux signé des deux parties', 'Ligneo', now() - interval '14 days' + interval '2 hours'),
   (d4, 'appel_offres', 'Appel d''offres envoyé à 3 prestataires', 'Ligneo', now() - interval '14 days' + interval '6 hours'),
   (d4, 'devis', 'Devis de Carrosserie Martin retenu : 505,00 € TTC', 'Client', now() - interval '13 days' + interval '3 hours'),
   (d4, 'trajet', 'Convoyage vers Carrosserie Martin · 23 km · 31 min · suivi GPS', 'Ligneo', now() - interval '13 days' + interval '9 hours'),
   (d4, 'chantier', 'Statut : Réparation · travaux en cours', 'Carrosserie Martin', now() - interval '11 days'),
   (d4, 'chantier', 'Statut : Peinture · séchage en cabine 24 h', 'Carrosserie Martin', now() - interval '9 days'),
   (d4, 'chantier', 'Statut : Prêt · contrôle qualité validé', 'Carrosserie Martin', now() - interval '6 days'),
   (d4, 'trajet', 'Convoyage retour · 60 km · 52 min · suivi GPS', 'Ligneo', now() - interval '5 days' + interval '1 hour'),
   (d4, 'livraison', 'Livraison à Sophie Lambert · état des lieux de livraison signé', 'Ligneo', now() - interval '5 days' + interval '2 hours'),
   (d4, 'cloture', 'Dossier clôturé et factures émises', 'Ligneo', now() - interval '5 days' + interval '3 hours');
END $$;
