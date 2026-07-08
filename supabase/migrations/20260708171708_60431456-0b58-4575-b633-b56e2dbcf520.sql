
-- ============================================================
-- LOT 1 : Fondations Attribution Missions (Catalogue & Direct)
-- ============================================================

-- 1) Colonnes supplémentaires sur trajets
ALTER TABLE public.trajets
  ADD COLUMN IF NOT EXISTS attribution_mode text NOT NULL DEFAULT 'direct'
    CHECK (attribution_mode IN ('direct','catalogue','mixte')),
  ADD COLUMN IF NOT EXISTS allow_counter_offer boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS proposal_expires_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_trajets_attribution_mode ON public.trajets(attribution_mode);
CREATE INDEX IF NOT EXISTS idx_trajets_publication_mode ON public.trajets(statut_publication, attribution_mode);

-- 2) RPC : admin propose une mission à un convoyeur (mode direct/mixte)
CREATE OR REPLACE FUNCTION public.admin_propose_mission_to_convoyeur(
  _trajet_id uuid,
  _convoyeur_id uuid,
  _expires_in_hours int DEFAULT 48
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_attr_id uuid;
  v_trajet RECORD;
  v_convoyeur_user uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT (public.has_role(v_uid,'admin'::public.app_role) OR public.has_role(v_uid,'super_admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT * INTO v_trajet FROM public.trajets WHERE id = _trajet_id FOR UPDATE;
  IF v_trajet.id IS NULL THEN RAISE EXCEPTION 'Trajet introuvable'; END IF;

  SELECT user_id INTO v_convoyeur_user FROM public.convoyeurs WHERE id = _convoyeur_id AND statut = 'valide';
  IF v_convoyeur_user IS NULL THEN RAISE EXCEPTION 'Convoyeur non validé'; END IF;

  -- Bloque si déjà une attribution active
  IF EXISTS (
    SELECT 1 FROM public.attributions
    WHERE trajet_id = _trajet_id
      AND statut IN ('propose','accepte','en_cours','en_attente_validation')
  ) THEN
    RAISE EXCEPTION 'Une attribution active existe déjà pour ce trajet';
  END IF;

  INSERT INTO public.attributions (trajet_id, convoyeur_id, statut, mode, statut_convoyeur, is_public)
  VALUES (_trajet_id, _convoyeur_id, 'propose', 'directe', 'en_attente', false)
  RETURNING id INTO v_attr_id;

  UPDATE public.trajets
     SET statut_publication = 'publie',
         proposal_expires_at = now() + make_interval(hours => COALESCE(_expires_in_hours, 48)),
         updated_at = now()
   WHERE id = _trajet_id;

  -- Notification convoyeur
  PERFORM public.create_user_notification(
    v_convoyeur_user, 'mission_proposee', 'Nouvelle mission proposée',
    'Une mission vient de vous être proposée. Vous avez ' || COALESCE(_expires_in_hours,48) || 'h pour répondre.',
    '/convoyeur/missions', 'mission', 'high',
    'proposal:' || v_attr_id::text, 'attribution', v_attr_id,
    jsonb_build_object('trajet_id', _trajet_id, 'depart', v_trajet.depart, 'arrivee', v_trajet.arrivee)
  );

  PERFORM public.create_admin_notification(
    'mission_offre', 'Mission proposée à un convoyeur',
    'Mission ' || COALESCE(v_trajet.depart,'') || ' → ' || COALESCE(v_trajet.arrivee,''),
    '/admin/attributions', 'attribution', v_attr_id, '{}'::jsonb
  );

  RETURN v_attr_id;
END;
$$;

-- 3) RPC : convoyeur répond à une proposition
CREATE OR REPLACE FUNCTION public.driver_respond_to_proposal(
  _attribution_id uuid,
  _accept boolean,
  _reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_attr RECORD;
  v_conv RECORD;
  v_trajet RECORD;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  SELECT a.*, c.user_id AS conv_user_id
    INTO v_attr
    FROM public.attributions a
    JOIN public.convoyeurs c ON c.id = a.convoyeur_id
   WHERE a.id = _attribution_id
   FOR UPDATE;
  IF v_attr.id IS NULL THEN RAISE EXCEPTION 'Attribution introuvable'; END IF;
  IF v_attr.conv_user_id <> v_uid THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF v_attr.statut <> 'propose' THEN RAISE EXCEPTION 'Cette proposition n''est plus en attente'; END IF;

  SELECT * INTO v_trajet FROM public.trajets WHERE id = v_attr.trajet_id FOR UPDATE;

  IF _accept THEN
    UPDATE public.attributions
       SET statut = 'accepte',
           statut_convoyeur = 'accepte',
           repondu_at = now(),
           updated_at = now()
     WHERE id = _attribution_id;

    UPDATE public.trajets
       SET statut_publication = 'attribue',
           statut = 'attribue',
           updated_at = now()
     WHERE id = v_attr.trajet_id;

    PERFORM public.create_admin_notification(
      'mission_acceptee', 'Mission acceptée par le convoyeur',
      COALESCE(v_trajet.depart,'') || ' → ' || COALESCE(v_trajet.arrivee,''),
      '/admin/attributions', 'attribution', _attribution_id, '{}'::jsonb
    );
  ELSE
    UPDATE public.attributions
       SET statut = 'refusee',
           statut_convoyeur = 'refuse',
           refus_motif = _reason,
           repondu_at = now(),
           updated_at = now()
     WHERE id = _attribution_id;

    UPDATE public.trajets
       SET statut_publication = CASE
              WHEN v_trajet.attribution_mode IN ('catalogue','mixte') THEN 'publie'
              ELSE 'brouillon'
           END,
           updated_at = now()
     WHERE id = v_attr.trajet_id;

    PERFORM public.create_admin_notification(
      'driver_action', 'Mission refusée par le convoyeur',
      'Motif : ' || COALESCE(_reason,'(non précisé)'),
      '/admin/attributions', 'attribution', _attribution_id,
      jsonb_build_object('reason', _reason)
    );
  END IF;
END;
$$;

-- 4) RPC : convoyeur candidate (avec tarif proposé, contre-offre optionnelle)
CREATE OR REPLACE FUNCTION public.driver_apply_to_mission(
  _trajet_id uuid,
  _proposed_price numeric DEFAULT NULL,
  _message text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_conv_id uuid;
  v_trajet RECORD;
  v_type text;
  v_final_price numeric;
  v_offre_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  SELECT id INTO v_conv_id FROM public.convoyeurs WHERE user_id = v_uid AND statut = 'valide';
  IF v_conv_id IS NULL THEN RAISE EXCEPTION 'Convoyeur non validé'; END IF;

  SELECT * INTO v_trajet FROM public.trajets WHERE id = _trajet_id;
  IF v_trajet.id IS NULL THEN RAISE EXCEPTION 'Trajet introuvable'; END IF;
  IF v_trajet.statut_publication <> 'publie' OR v_trajet.attribution_mode NOT IN ('catalogue','mixte') THEN
    RAISE EXCEPTION 'Mission indisponible au catalogue';
  END IF;

  v_final_price := COALESCE(_proposed_price, v_trajet.prix_convoyeur_fixe, v_trajet.prix_convoyeur, v_trajet.prix_suggere, 0);

  IF _proposed_price IS NOT NULL AND _proposed_price <> COALESCE(v_trajet.prix_convoyeur_fixe, v_trajet.prix_convoyeur, v_trajet.prix_suggere, 0) THEN
    IF NOT v_trajet.allow_counter_offer THEN
      RAISE EXCEPTION 'Les contre-offres ne sont pas autorisées sur cette mission';
    END IF;
    v_type := 'contre_proposition';
  ELSE
    v_type := 'acceptation';
  END IF;

  INSERT INTO public.mission_offres (
    trajet_id, convoyeur_id, prix_propose, prix_suggere_snapshot,
    type_offre, statut, message
  ) VALUES (
    _trajet_id, v_conv_id, v_final_price,
    COALESCE(v_trajet.prix_convoyeur_fixe, v_trajet.prix_convoyeur, v_trajet.prix_suggere),
    v_type, 'en_attente', NULLIF(trim(COALESCE(_message,'')),'')
  ) RETURNING id INTO v_offre_id;

  PERFORM public.create_admin_notification(
    CASE WHEN v_type='contre_proposition' THEN 'mission_offre' ELSE 'mission_offre' END,
    CASE WHEN v_type='contre_proposition' THEN 'Contre-offre reçue' ELSE 'Nouvelle candidature reçue' END,
    COALESCE(v_trajet.depart,'') || ' → ' || COALESCE(v_trajet.arrivee,'') || ' — ' || v_final_price::text || ' €',
    '/admin/candidatures', 'mission_offre', v_offre_id,
    jsonb_build_object('trajet_id', _trajet_id, 'convoyeur_id', v_conv_id, 'prix', v_final_price)
  );

  RETURN v_offre_id;
END;
$$;

-- 5) RPC : admin retient une offre gagnante et crée l'attribution
CREATE OR REPLACE FUNCTION public.admin_award_offer(_offre_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_offre RECORD;
  v_trajet RECORD;
  v_conv_user uuid;
  v_attr_id uuid;
  r RECORD;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT (public.has_role(v_uid,'admin'::public.app_role) OR public.has_role(v_uid,'super_admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT * INTO v_offre FROM public.mission_offres WHERE id = _offre_id FOR UPDATE;
  IF v_offre.id IS NULL THEN RAISE EXCEPTION 'Offre introuvable'; END IF;

  SELECT * INTO v_trajet FROM public.trajets WHERE id = v_offre.trajet_id FOR UPDATE;
  SELECT user_id INTO v_conv_user FROM public.convoyeurs WHERE id = v_offre.convoyeur_id;

  UPDATE public.mission_offres SET statut = 'accepte', is_winning = true, updated_at = now() WHERE id = _offre_id;

  INSERT INTO public.attributions (trajet_id, convoyeur_id, statut, mode, statut_convoyeur, is_public)
  VALUES (v_offre.trajet_id, v_offre.convoyeur_id, 'accepte', 'catalogue', 'accepte', false)
  RETURNING id INTO v_attr_id;

  UPDATE public.trajets
     SET statut_publication = 'attribue', statut = 'attribue',
         prix_convoyeur = v_offre.prix_propose,
         updated_at = now()
   WHERE id = v_offre.trajet_id;

  -- Refuse les autres offres et les notifie
  FOR r IN
    SELECT mo.id, c.user_id
      FROM public.mission_offres mo
      JOIN public.convoyeurs c ON c.id = mo.convoyeur_id
     WHERE mo.trajet_id = v_offre.trajet_id AND mo.id <> _offre_id AND mo.statut = 'en_attente'
  LOOP
    UPDATE public.mission_offres SET statut = 'refuse', updated_at = now() WHERE id = r.id;
    IF r.user_id IS NOT NULL THEN
      PERFORM public.create_user_notification(
        r.user_id, 'candidature_refusee', 'Candidature non retenue',
        'Une autre candidature a été retenue pour cette mission.',
        '/convoyeur/missions', 'mission', 'normal',
        'offer-lost:' || r.id::text, 'mission_offre', r.id, '{}'::jsonb
      );
    END IF;
  END LOOP;

  IF v_conv_user IS NOT NULL THEN
    PERFORM public.create_user_notification(
      v_conv_user, 'candidature_acceptee', 'Candidature retenue',
      'Vous avez été sélectionné pour cette mission.',
      '/convoyeur/missions', 'mission', 'high',
      'offer-won:' || _offre_id::text, 'attribution', v_attr_id, '{}'::jsonb
    );
  END IF;

  RETURN v_attr_id;
END;
$$;

-- 6) RPC : admin publie une mission au catalogue
CREATE OR REPLACE FUNCTION public.admin_publish_to_catalogue(
  _trajet_id uuid,
  _allow_counter_offer boolean DEFAULT true,
  _expires_in_hours int DEFAULT 168
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT (public.has_role(v_uid,'admin'::public.app_role) OR public.has_role(v_uid,'super_admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE public.trajets
     SET attribution_mode = 'catalogue',
         allow_counter_offer = COALESCE(_allow_counter_offer, true),
         statut_publication = 'publie',
         proposal_expires_at = now() + make_interval(hours => COALESCE(_expires_in_hours, 168)),
         published_at = COALESCE(published_at, now()),
         updated_at = now()
   WHERE id = _trajet_id;
END;
$$;

-- 7) RPC : admin fait une contre-proposition sur une offre
CREATE OR REPLACE FUNCTION public.admin_counter_offer(
  _offre_id uuid,
  _counter_price numeric,
  _message text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_offre RECORD;
  v_conv_user uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT (public.has_role(v_uid,'admin'::public.app_role) OR public.has_role(v_uid,'super_admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT mo.*, c.user_id AS conv_user INTO v_offre
    FROM public.mission_offres mo
    JOIN public.convoyeurs c ON c.id = mo.convoyeur_id
   WHERE mo.id = _offre_id
   FOR UPDATE;
  IF v_offre.id IS NULL THEN RAISE EXCEPTION 'Offre introuvable'; END IF;

  UPDATE public.mission_offres
     SET admin_counter_offer = _counter_price,
         admin_counter_at = now(),
         admin_counter_by = v_uid,
         statut = 'contre_offre_admin',
         message = COALESCE(_message, message),
         updated_at = now()
   WHERE id = _offre_id;

  IF v_offre.conv_user IS NOT NULL THEN
    PERFORM public.create_user_notification(
      v_offre.conv_user, 'contre_offre_admin', 'Contre-proposition reçue',
      'L''administrateur vous propose ' || _counter_price::text || ' €.',
      '/convoyeur/missions', 'mission', 'high',
      'counter:' || _offre_id::text, 'mission_offre', _offre_id,
      jsonb_build_object('prix', _counter_price)
    );
  END IF;
END;
$$;

-- 8) RPC : admin refuse une candidature
CREATE OR REPLACE FUNCTION public.admin_reject_offer(_offre_id uuid, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_offre RECORD;
  v_conv_user uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT (public.has_role(v_uid,'admin'::public.app_role) OR public.has_role(v_uid,'super_admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT mo.*, c.user_id AS conv_user INTO v_offre
    FROM public.mission_offres mo
    JOIN public.convoyeurs c ON c.id = mo.convoyeur_id
   WHERE mo.id = _offre_id FOR UPDATE;
  IF v_offre.id IS NULL THEN RAISE EXCEPTION 'Offre introuvable'; END IF;

  UPDATE public.mission_offres SET statut = 'refuse', message = COALESCE(_reason, message), updated_at = now()
   WHERE id = _offre_id;

  IF v_offre.conv_user IS NOT NULL THEN
    PERFORM public.create_user_notification(
      v_offre.conv_user, 'candidature_refusee', 'Candidature refusée',
      COALESCE(_reason, 'Votre candidature n''a pas été retenue.'),
      '/convoyeur/missions', 'mission', 'normal',
      'reject:' || _offre_id::text, 'mission_offre', _offre_id, '{}'::jsonb
    );
  END IF;
END;
$$;

-- 9) Fonction d'expiration automatique (à appeler périodiquement)
CREATE OR REPLACE FUNCTION public.expire_stale_proposals()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT a.id AS attr_id, a.trajet_id, t.attribution_mode
      FROM public.attributions a
      JOIN public.trajets t ON t.id = a.trajet_id
     WHERE a.statut = 'propose'
       AND t.proposal_expires_at IS NOT NULL
       AND t.proposal_expires_at < now()
  LOOP
    UPDATE public.attributions
       SET statut = 'refusee', statut_convoyeur = 'expire', updated_at = now(),
           refus_motif = COALESCE(refus_motif, 'Expiré automatiquement')
     WHERE id = r.attr_id;

    UPDATE public.trajets
       SET statut_publication = CASE WHEN r.attribution_mode IN ('catalogue','mixte') THEN 'publie' ELSE 'brouillon' END,
           updated_at = now()
     WHERE id = r.trajet_id;

    PERFORM public.create_admin_notification(
      'driver_action', 'Proposition expirée',
      'Le convoyeur n''a pas répondu à temps.',
      '/admin/attributions', 'attribution', r.attr_id, '{}'::jsonb
    );
  END LOOP;
END;
$$;
