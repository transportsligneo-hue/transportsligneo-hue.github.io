
-- =========================================================
-- Programme de fidélité « Compte Kilomètres Ligneo »
-- =========================================================

-- 1) Barème configurable
CREATE TABLE public.loyalty_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  seuil_km_min numeric NOT NULL DEFAULT 0,
  seuil_km_max numeric,
  taux numeric NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.loyalty_settings TO authenticated;
GRANT ALL ON public.loyalty_settings TO service_role;
ALTER TABLE public.loyalty_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loyalty_settings_read_auth" ON public.loyalty_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "loyalty_settings_admin_manage" ON public.loyalty_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

INSERT INTO public.loyalty_settings (label, seuil_km_min, seuil_km_max, taux, sort_order) VALUES
  ('0 à 4 000 km', 0, 4000, 1, 1),
  ('4 001 à 10 000 km', 4001, 10000, 2, 2),
  ('10 001 à 20 000 km', 10001, 20000, 3, 3),
  ('Au-delà de 20 000 km', 20001, NULL, 4, 4);

-- 2) Comptes fidélité
CREATE TABLE public.loyalty_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL UNIQUE,
  email text,
  km_cumules_periode numeric NOT NULL DEFAULT 0,
  montant_ht_cumule_periode numeric NOT NULL DEFAULT 0,
  date_debut_periode date NOT NULL DEFAULT CURRENT_DATE,
  solde_avoir numeric NOT NULL DEFAULT 0,
  taux_notifie numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_loyalty_accounts_client ON public.loyalty_accounts(client_id);
GRANT SELECT ON public.loyalty_accounts TO authenticated;
GRANT ALL ON public.loyalty_accounts TO service_role;
ALTER TABLE public.loyalty_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loyalty_accounts_self_read" ON public.loyalty_accounts
  FOR SELECT TO authenticated USING (client_id = auth.uid());
CREATE POLICY "loyalty_accounts_admin_all" ON public.loyalty_accounts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- 3) Historique des primes
CREATE TABLE public.loyalty_rewards_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loyalty_account_id uuid NOT NULL REFERENCES public.loyalty_accounts(id) ON DELETE CASCADE,
  date_calcul timestamptz NOT NULL DEFAULT now(),
  km_au_calcul numeric NOT NULL DEFAULT 0,
  montant_ht_periode numeric NOT NULL DEFAULT 0,
  taux_applique numeric NOT NULL DEFAULT 0,
  montant_avoir_genere numeric NOT NULL DEFAULT 0,
  montant_utilise numeric NOT NULL DEFAULT 0,
  date_expiration_avoir date,
  statut text NOT NULL DEFAULT 'actif',
  source text NOT NULL DEFAULT 'auto',
  note text,
  created_by uuid,
  notified_at timestamptz,
  expiry_reminder_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT loyalty_rewards_statut_chk CHECK (statut IN ('actif','partiel','utilise','expire'))
);
CREATE INDEX idx_loyalty_rewards_account ON public.loyalty_rewards_history(loyalty_account_id);
CREATE INDEX idx_loyalty_rewards_statut ON public.loyalty_rewards_history(statut, date_expiration_avoir);
GRANT SELECT ON public.loyalty_rewards_history TO authenticated;
GRANT ALL ON public.loyalty_rewards_history TO service_role;
ALTER TABLE public.loyalty_rewards_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loyalty_rewards_self_read" ON public.loyalty_rewards_history
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.loyalty_accounts a
                 WHERE a.id = loyalty_account_id AND a.client_id = auth.uid()));
CREATE POLICY "loyalty_rewards_admin_all" ON public.loyalty_rewards_history
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- 4) Utilisations d'avoir
CREATE TABLE public.loyalty_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loyalty_account_id uuid NOT NULL REFERENCES public.loyalty_accounts(id) ON DELETE CASCADE,
  reward_id uuid REFERENCES public.loyalty_rewards_history(id) ON DELETE SET NULL,
  mission_id uuid,
  devis_id uuid,
  montant numeric NOT NULL,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_loyalty_redemptions_account ON public.loyalty_redemptions(loyalty_account_id);
GRANT SELECT ON public.loyalty_redemptions TO authenticated;
GRANT ALL ON public.loyalty_redemptions TO service_role;
ALTER TABLE public.loyalty_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loyalty_redemptions_self_read" ON public.loyalty_redemptions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.loyalty_accounts a
                 WHERE a.id = loyalty_account_id AND a.client_id = auth.uid()));
CREATE POLICY "loyalty_redemptions_admin_all" ON public.loyalty_redemptions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- 5) Triggers updated_at
CREATE TRIGGER trg_loyalty_settings_updated BEFORE UPDATE ON public.loyalty_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_loyalty_accounts_updated BEFORE UPDATE ON public.loyalty_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_loyalty_rewards_updated BEFORE UPDATE ON public.loyalty_rewards_history
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6) Barème : taux pour un kilométrage
CREATE OR REPLACE FUNCTION public.loyalty_rate_for_km(_km numeric)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((
    SELECT s.taux FROM public.loyalty_settings s
    WHERE COALESCE(_km, 0) >= s.seuil_km_min
      AND (s.seuil_km_max IS NULL OR COALESCE(_km, 0) <= s.seuil_km_max)
    ORDER BY s.seuil_km_min DESC LIMIT 1
  ), 0);
$$;

-- 7) Récupération / création du compte
CREATE OR REPLACE FUNCTION public.loyalty_get_or_create_account(_client_id uuid, _email text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF _client_id IS NULL THEN RETURN NULL; END IF;
  SELECT id INTO v_id FROM public.loyalty_accounts WHERE client_id = _client_id;
  IF v_id IS NULL THEN
    INSERT INTO public.loyalty_accounts (client_id, email)
    VALUES (_client_id, _email)
    ON CONFLICT (client_id) DO UPDATE SET email = COALESCE(public.loyalty_accounts.email, EXCLUDED.email)
    RETURNING id INTO v_id;
  ELSIF _email IS NOT NULL THEN
    UPDATE public.loyalty_accounts SET email = COALESCE(email, _email) WHERE id = v_id;
  END IF;
  RETURN v_id;
END;
$$;

-- 8) Cumul automatique à la fin de mission
CREATE OR REPLACE FUNCTION public.loyalty_accrue_mission()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_account uuid;
  v_km numeric := 0;
  v_ht numeric := 0;
BEGIN
  IF NEW.statut <> 'terminee' OR COALESCE(OLD.statut,'') = 'terminee' THEN
    RETURN NEW;
  END IF;
  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;

  v_account := public.loyalty_get_or_create_account(NEW.user_id, NEW.email);
  IF v_account IS NULL THEN RETURN NEW; END IF;

  SELECT COALESCE(f.distance_km, 0), COALESCE(f.total_ht, f.prix_ht, 0)
    INTO v_km, v_ht
  FROM public.factures f
  WHERE f.mission_id = NEW.id
  ORDER BY f.created_at DESC LIMIT 1;

  IF COALESCE(v_km, 0) = 0 AND NEW.devis_id IS NOT NULL THEN
    SELECT COALESCE(d.distance_km, 0) INTO v_km FROM public.devis d WHERE d.id = NEW.devis_id;
  END IF;
  IF COALESCE(v_ht, 0) = 0 THEN
    v_ht := ROUND(COALESCE(NEW.prix_total, 0) / 1.2, 2);
  END IF;

  UPDATE public.loyalty_accounts
     SET km_cumules_periode = km_cumules_periode + COALESCE(v_km, 0),
         montant_ht_cumule_periode = montant_ht_cumule_periode + COALESCE(v_ht, 0),
         updated_at = now()
   WHERE id = v_account;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_loyalty_accrue_mission
AFTER UPDATE OF statut ON public.missions
FOR EACH ROW EXECUTE FUNCTION public.loyalty_accrue_mission();

-- 9) Clôture des périodes échues (12 mois glissants)
CREATE OR REPLACE FUNCTION public.loyalty_close_due_periods()
RETURNS TABLE (
  account_id uuid, client_id uuid, email text, km numeric,
  montant_ht numeric, taux numeric, avoir numeric, expiration date, reward_id uuid
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record; v_taux numeric; v_avoir numeric; v_exp date; v_reward uuid;
BEGIN
  FOR r IN
    SELECT * FROM public.loyalty_accounts
    WHERE date_debut_periode + INTERVAL '12 months' <= CURRENT_DATE
    FOR UPDATE
  LOOP
    v_taux := public.loyalty_rate_for_km(r.km_cumules_periode);
    v_avoir := ROUND(COALESCE(r.montant_ht_cumule_periode,0) * v_taux / 100.0, 2);
    v_exp := CURRENT_DATE + INTERVAL '24 months';
    v_reward := NULL;

    IF v_avoir > 0 THEN
      INSERT INTO public.loyalty_rewards_history (
        loyalty_account_id, km_au_calcul, montant_ht_periode, taux_applique,
        montant_avoir_genere, date_expiration_avoir, statut, source)
      VALUES (r.id, r.km_cumules_periode, r.montant_ht_cumule_periode, v_taux,
              v_avoir, v_exp, 'actif', 'auto')
      RETURNING id INTO v_reward;
    END IF;

    UPDATE public.loyalty_accounts
       SET solde_avoir = solde_avoir + v_avoir,
           km_cumules_periode = 0,
           montant_ht_cumule_periode = 0,
           date_debut_periode = CURRENT_DATE,
           taux_notifie = 0,
           updated_at = now()
     WHERE id = r.id;

    IF v_avoir > 0 THEN
      account_id := r.id; client_id := r.client_id; email := r.email;
      km := r.km_cumules_periode; montant_ht := r.montant_ht_cumule_periode;
      taux := v_taux; avoir := v_avoir; expiration := v_exp; reward_id := v_reward;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;

-- 10) Expiration des avoirs
CREATE OR REPLACE FUNCTION public.loyalty_expire_avoirs()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; v_count integer := 0; v_reste numeric;
BEGIN
  FOR r IN
    SELECT * FROM public.loyalty_rewards_history
    WHERE statut IN ('actif','partiel')
      AND date_expiration_avoir IS NOT NULL
      AND date_expiration_avoir < CURRENT_DATE
  LOOP
    v_reste := GREATEST(COALESCE(r.montant_avoir_genere,0) - COALESCE(r.montant_utilise,0), 0);
    UPDATE public.loyalty_rewards_history SET statut = 'expire' WHERE id = r.id;
    IF v_reste > 0 THEN
      UPDATE public.loyalty_accounts
         SET solde_avoir = GREATEST(solde_avoir - v_reste, 0), updated_at = now()
       WHERE id = r.loyalty_account_id;
    END IF;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- 11) Utilisation d'un avoir (client)
CREATE OR REPLACE FUNCTION public.loyalty_apply_avoir(
  _montant numeric, _mission_id uuid DEFAULT NULL, _devis_id uuid DEFAULT NULL)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_account public.loyalty_accounts%ROWTYPE;
  v_reste numeric; r record; v_dispo numeric; v_take numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;
  IF COALESCE(_montant,0) <= 0 THEN RAISE EXCEPTION 'Montant invalide'; END IF;

  SELECT * INTO v_account FROM public.loyalty_accounts WHERE client_id = auth.uid() FOR UPDATE;
  IF v_account.id IS NULL THEN RAISE EXCEPTION 'Aucun compte fidélité'; END IF;
  IF v_account.solde_avoir < _montant THEN RAISE EXCEPTION 'Solde d''avoir insuffisant'; END IF;

  v_reste := _montant;
  FOR r IN
    SELECT * FROM public.loyalty_rewards_history
    WHERE loyalty_account_id = v_account.id
      AND statut IN ('actif','partiel')
      AND (date_expiration_avoir IS NULL OR date_expiration_avoir >= CURRENT_DATE)
    ORDER BY date_expiration_avoir NULLS LAST, date_calcul
  LOOP
    EXIT WHEN v_reste <= 0;
    v_dispo := GREATEST(COALESCE(r.montant_avoir_genere,0) - COALESCE(r.montant_utilise,0), 0);
    CONTINUE WHEN v_dispo <= 0;
    v_take := LEAST(v_dispo, v_reste);

    UPDATE public.loyalty_rewards_history
       SET montant_utilise = COALESCE(montant_utilise,0) + v_take,
           statut = CASE WHEN COALESCE(montant_utilise,0) + v_take >= montant_avoir_genere
                         THEN 'utilise' ELSE 'partiel' END
     WHERE id = r.id;

    INSERT INTO public.loyalty_redemptions (loyalty_account_id, reward_id, mission_id, devis_id, montant, created_by)
    VALUES (v_account.id, r.id, _mission_id, _devis_id, v_take, auth.uid());

    v_reste := v_reste - v_take;
  END LOOP;

  IF v_reste > 0 THEN RAISE EXCEPTION 'Avoirs disponibles insuffisants'; END IF;

  UPDATE public.loyalty_accounts
     SET solde_avoir = GREATEST(solde_avoir - _montant, 0), updated_at = now()
   WHERE id = v_account.id;

  RETURN (SELECT solde_avoir FROM public.loyalty_accounts WHERE id = v_account.id);
END;
$$;

-- 12) Ajustement manuel admin
CREATE OR REPLACE FUNCTION public.admin_loyalty_adjust(
  _account_id uuid, _montant_avoir numeric, _taux numeric, _note text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_acc public.loyalty_accounts%ROWTYPE;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;
  IF _note IS NULL OR length(btrim(_note)) < 3 THEN
    RAISE EXCEPTION 'Une note justificative est obligatoire';
  END IF;
  SELECT * INTO v_acc FROM public.loyalty_accounts WHERE id = _account_id FOR UPDATE;
  IF v_acc.id IS NULL THEN RAISE EXCEPTION 'Compte introuvable'; END IF;

  INSERT INTO public.loyalty_rewards_history (
    loyalty_account_id, km_au_calcul, montant_ht_periode, taux_applique,
    montant_avoir_genere, date_expiration_avoir, statut, source, note, created_by)
  VALUES (_account_id, v_acc.km_cumules_periode, v_acc.montant_ht_cumule_periode,
          COALESCE(_taux, 0), COALESCE(_montant_avoir, 0),
          (CURRENT_DATE + INTERVAL '24 months')::date,
          CASE WHEN COALESCE(_montant_avoir,0) > 0 THEN 'actif' ELSE 'utilise' END,
          'ajustement_admin', _note, auth.uid())
  RETURNING id INTO v_id;

  UPDATE public.loyalty_accounts
     SET solde_avoir = GREATEST(solde_avoir + COALESCE(_montant_avoir,0), 0), updated_at = now()
   WHERE id = _account_id;

  RETURN v_id;
END;
$$;

-- 13) Tâche planifiée quotidienne
SELECT cron.schedule(
  'loyalty-daily',
  '5 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--89dab15e-bf0e-453b-bb30-b452a3afe7db.lovable.app/api/public/hooks/loyalty-daily',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdtcXNhYnF3eGZzdmJua3l6amhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxODIxNzEsImV4cCI6MjA5MTc1ODE3MX0.mEaDbjifqWmAMq-SvVgy8H7tGCV4nJaePYzeX-P46M8"}'::jsonb,
    body := '{"source":"cron"}'::jsonb
  );
  $$
);
