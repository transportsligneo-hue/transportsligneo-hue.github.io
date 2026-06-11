-- ============ PHASE 1 : cycle de vie devis, numérotation, expiration, archivage ============

-- Nouvelles colonnes cycle de vie
ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS expires_at timestamptz DEFAULT (now() + interval '30 days');
ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS sent_at timestamptz;
ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS refused_at timestamptz;
UPDATE public.devis SET expires_at = created_at + interval '30 days' WHERE expires_at IS NULL;

-- Numérotation unique DEV-YYYY-000001 (séquence globale, aucun doublon ni réutilisation)
CREATE SEQUENCE IF NOT EXISTS public.devis_numero_seq START 1;

CREATE OR REPLACE FUNCTION public.next_devis_numero()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v bigint;
BEGIN
  v := nextval('public.devis_numero_seq');
  RETURN 'DEV-' || EXTRACT(YEAR FROM now())::int::text || '-' || lpad(v::text, 6, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.devis_set_numero()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND (NEW.numero IS NULL OR length(trim(NEW.numero)) = 0 OR NEW.numero !~ '^DEV-') THEN
    NEW.numero := public.next_devis_numero();
  ELSIF TG_OP = 'UPDATE' AND (NEW.numero IS NULL OR length(trim(NEW.numero)) = 0) THEN
    NEW.numero := public.next_devis_numero();
  END IF;
  RETURN NEW;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS devis_numero_unique_idx ON public.devis(numero);

-- Historique des statuts de devis
CREATE TABLE IF NOT EXISTS public.devis_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  devis_id uuid NOT NULL REFERENCES public.devis(id) ON DELETE CASCADE,
  old_statut text,
  new_statut text NOT NULL,
  changed_by uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.devis_status_history TO authenticated;
GRANT ALL ON public.devis_status_history TO service_role;
ALTER TABLE public.devis_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read devis history" ON public.devis_status_history
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role));
CREATE POLICY "Clients read own devis history" ON public.devis_status_history
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.devis d
    WHERE d.id = devis_status_history.devis_id
      AND (d.user_id = auth.uid() OR lower(d.email) = lower(coalesce(auth.jwt()->>'email','')))
  ));

CREATE OR REPLACE FUNCTION public.log_devis_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.devis_status_history(devis_id, old_statut, new_statut, changed_by)
    VALUES (NEW.id, NULL, coalesce(NEW.statut, 'genere'), auth.uid());
  ELSIF NEW.statut IS DISTINCT FROM OLD.statut THEN
    INSERT INTO public.devis_status_history(devis_id, old_statut, new_statut, changed_by)
    VALUES (NEW.id, OLD.statut, NEW.statut, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_devis_status_history ON public.devis;
CREATE TRIGGER trg_devis_status_history
  AFTER INSERT OR UPDATE OF statut ON public.devis
  FOR EACH ROW EXECUTE FUNCTION public.log_devis_status_change();

-- Interdiction de suppression des devis (archivage uniquement)
DROP POLICY IF EXISTS "Admins can delete devis" ON public.devis;
REVOKE DELETE ON public.devis FROM authenticated;
REVOKE DELETE ON public.devis FROM anon;

-- Expiration automatique quotidienne
DO $do$ BEGIN PERFORM cron.unschedule('expire-devis'); EXCEPTION WHEN OTHERS THEN NULL; END $do$;
SELECT cron.schedule('expire-devis', '15 2 * * *',
  $cron$UPDATE public.devis SET statut = 'expire' WHERE statut IN ('genere','envoye','en_attente') AND expires_at IS NOT NULL AND expires_at < now() AND paid_at IS NULL AND locked_at IS NULL AND archived_at IS NULL$cron$);

-- ============ PHASE 2 : preuve de signature ============
ALTER TABLE public.devis_acceptations ADD COLUMN IF NOT EXISTS signature_url text;

-- Accès au bucket privé devis-acceptes
DROP POLICY IF EXISTS "Clients upload own devis acceptes" ON storage.objects;
CREATE POLICY "Clients upload own devis acceptes" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'devis-acceptes' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "Clients read own devis acceptes" ON storage.objects;
CREATE POLICY "Clients read own devis acceptes" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'devis-acceptes' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "Admins read devis acceptes" ON storage.objects;
CREATE POLICY "Admins read devis acceptes" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'devis-acceptes' AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));

-- ============ PHASE 3 : tarification étendue ville/département + portées ============
ALTER TABLE public.client_pricing_rules ADD COLUMN IF NOT EXISTS departement_depart text;
ALTER TABLE public.client_pricing_rules ADD COLUMN IF NOT EXISTS departement_arrivee text;
ALTER TABLE public.client_pricing_rules ADD COLUMN IF NOT EXISTS client_scope text NOT NULL DEFAULT 'client';

CREATE OR REPLACE FUNCTION public.resolve_client_pricing_rule(_user_id uuid, _email text, _depart text, _arrivee text, _is_aller_retour boolean)
RETURNS TABLE(rule_id uuid, prix_ttc numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_trip_type text := CASE WHEN _is_aller_retour THEN 'aller_retour' ELSE 'aller' END;
  v_email text := lower(coalesce(_email, ''));
  v_depart text := lower(coalesce(_depart, ''));
  v_arrivee text := lower(coalesce(_arrivee, ''));
  v_dep_cp text := substring(v_depart from '\d{5}');
  v_arr_cp text := substring(v_arrivee from '\d{5}');
  v_dep_dept text;
  v_arr_dept text;
  v_type_client text;
BEGIN
  v_dep_dept := CASE WHEN v_dep_cp IS NOT NULL THEN left(v_dep_cp, 2) END;
  v_arr_dept := CASE WHEN v_arr_cp IS NOT NULL THEN left(v_arr_cp, 2) END;

  SELECT p.type_client INTO v_type_client
  FROM public.profiles p
  WHERE (_user_id IS NOT NULL AND p.user_id = _user_id)
     OR (length(v_email) > 0 AND lower(p.email) = v_email)
  LIMIT 1;

  RETURN QUERY
  WITH candidates AS (
    SELECT r.id AS cid, r.trip_type, r.priority, r.prix_ttc AS r_prix_ttc,
      r.prix_aller_simple, r.prix_aller_retour,
      CASE
        WHEN (_user_id IS NOT NULL AND r.client_user_id = _user_id)
          OR (length(v_email) > 0 AND lower(coalesce(r.client_email,'')) = v_email) THEN 100000
        WHEN r.client_user_id IS NULL AND r.client_email IS NULL
          AND r.client_scope = 'professionnel'
          AND coalesce(v_type_client, 'particulier') IN ('b2b','flotte') THEN 50000
        WHEN r.client_user_id IS NULL AND r.client_email IS NULL
          AND r.client_scope = 'particulier'
          AND coalesce(v_type_client, 'particulier') = 'particulier' THEN 40000
        WHEN r.client_user_id IS NULL AND r.client_email IS NULL
          AND r.client_scope = 'tous' THEN 30000
        ELSE NULL
      END AS scope_score,
      CASE
        WHEN r.ville_depart IS NOT NULL AND position(lower(r.ville_depart) in v_depart) > 0 THEN 2
        WHEN r.ville_depart IS NULL AND r.departement_depart IS NOT NULL
          AND v_dep_dept IS NOT NULL AND r.departement_depart = v_dep_dept THEN 1
        WHEN r.ville_depart IS NULL AND r.departement_depart IS NULL THEN 0
        ELSE NULL
      END AS dep_level,
      CASE
        WHEN r.ville_arrivee IS NOT NULL AND position(lower(r.ville_arrivee) in v_arrivee) > 0 THEN 2
        WHEN r.ville_arrivee IS NULL AND r.departement_arrivee IS NOT NULL
          AND v_arr_dept IS NOT NULL AND r.departement_arrivee = v_arr_dept THEN 1
        WHEN r.ville_arrivee IS NULL AND r.departement_arrivee IS NULL THEN 0
        ELSE NULL
      END AS arr_level
    FROM public.client_pricing_rules r
    WHERE r.active = true
      AND (r.trip_type = 'any' OR r.trip_type = v_trip_type)
  )
  SELECT c.cid,
    coalesce(
      CASE WHEN v_trip_type = 'aller_retour' THEN c.prix_aller_retour END,
      CASE WHEN v_trip_type = 'aller' THEN c.prix_aller_simple END,
      c.r_prix_ttc
    ) AS picked_price
  FROM candidates c
  WHERE c.scope_score IS NOT NULL AND c.dep_level IS NOT NULL AND c.arr_level IS NOT NULL
    AND coalesce(
      CASE WHEN v_trip_type = 'aller_retour' THEN c.prix_aller_retour END,
      CASE WHEN v_trip_type = 'aller' THEN c.prix_aller_simple END,
      c.r_prix_ttc
    ) > 0
  ORDER BY
    (c.scope_score
     + c.dep_level * 200 + c.arr_level * 200
     + CASE WHEN c.trip_type = v_trip_type THEN 5 ELSE 0 END
     + coalesce(c.priority, 0)) DESC
  LIMIT 1;
END;
$$;

-- ============ PHASE 4 : aller-retour + missions liées ============
ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS date_retour date;
ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS heure_retour text;
ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS recuperation_retour_identique boolean NOT NULL DEFAULT true;
ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS adresse_recuperation_retour text;
ALTER TABLE public.demandes_convoyage ADD COLUMN IF NOT EXISTS date_retour date;
ALTER TABLE public.demandes_convoyage ADD COLUMN IF NOT EXISTS heure_retour text;
ALTER TABLE public.demandes_convoyage ADD COLUMN IF NOT EXISTS recuperation_retour_identique boolean NOT NULL DEFAULT true;
ALTER TABLE public.demandes_convoyage ADD COLUMN IF NOT EXISTS adresse_recuperation_retour text;

ALTER TABLE public.trajets ADD COLUMN IF NOT EXISTS type_mission text NOT NULL DEFAULT 'livraison';
ALTER TABLE public.trajets ADD COLUMN IF NOT EXISTS commande_ref text;
ALTER TABLE public.trajets ADD COLUMN IF NOT EXISTS parent_trajet_id uuid REFERENCES public.trajets(id);

-- Création automatique des missions livraison + restitution à la validation d'un devis aller-retour
CREATE OR REPLACE FUNCTION public.auto_create_trajet_from_devis()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_existing uuid;
  v_livraison_id uuid;
  v_is_ar boolean;
BEGIN
  IF NEW.paid_at IS NOT NULL AND (OLD.paid_at IS NULL OR OLD IS NULL) THEN
    SELECT id INTO v_existing FROM public.trajets WHERE devis_id = NEW.id LIMIT 1;
    IF v_existing IS NULL THEN
      v_is_ar := (NEW.depart_retour IS NOT NULL AND length(trim(NEW.depart_retour)) > 0);

      INSERT INTO public.trajets (
        devis_id, depart, arrivee, date_trajet, heure_trajet,
        marque, modele, client_nom, client_email, client_telephone,
        prix_client, prix, commission_convoyeur_pct,
        statut, statut_publication, pricing_mode,
        vin, carte_grise_recto_url, carte_grise_verso_url,
        contact_depart_nom, contact_depart_tel, contact_depart_note,
        contact_arrivee_nom, contact_arrivee_tel, contact_arrivee_note,
        type_mission, commande_ref
      ) VALUES (
        NEW.id, NEW.depart, NEW.arrivee, NEW.date_souhaitee, COALESCE(NEW.heure_souhaitee, ''),
        COALESCE(NEW.marque, ''), COALESCE(NEW.modele, ''),
        TRIM(NEW.prenom || ' ' || NEW.nom), NEW.email, COALESCE(NEW.telephone, ''),
        NEW.prix_estime, NEW.prix_estime, 65,
        'en_attente', 'brouillon', 'fixe',
        NEW.vin, NEW.carte_grise_recto_url, NEW.carte_grise_verso_url,
        NEW.contact_depart_nom, NEW.contact_depart_tel, NEW.contact_depart_note,
        NEW.contact_arrivee_nom, NEW.contact_arrivee_tel, NEW.contact_arrivee_note,
        'livraison', NEW.numero
      ) RETURNING id INTO v_livraison_id;

      IF v_is_ar THEN
        INSERT INTO public.trajets (
          devis_id, depart, arrivee, date_trajet, heure_trajet,
          marque, modele, client_nom, client_email, client_telephone,
          prix_client, prix, commission_convoyeur_pct,
          statut, statut_publication, pricing_mode,
          vin,
          contact_depart_nom, contact_depart_tel, contact_depart_note,
          contact_arrivee_nom, contact_arrivee_tel, contact_arrivee_note,
          type_mission, commande_ref, parent_trajet_id, immatriculation
        ) VALUES (
          NEW.id,
          CASE
            WHEN COALESCE(NEW.recuperation_retour_identique, true) THEN NEW.arrivee
            ELSE COALESCE(NULLIF(trim(COALESCE(NEW.adresse_recuperation_retour, '')), ''), NEW.depart_retour)
          END,
          COALESCE(NULLIF(trim(COALESCE(NEW.arrivee_retour, '')), ''), NEW.depart),
          COALESCE(NEW.date_retour, NEW.date_souhaitee), COALESCE(NEW.heure_retour, ''),
          COALESCE(NEW.marque_retour, NEW.marque, ''), COALESCE(NEW.modele_retour, NEW.modele, ''),
          TRIM(NEW.prenom || ' ' || NEW.nom), NEW.email, COALESCE(NEW.telephone, ''),
          NULL, 0, 65,
          CASE WHEN NEW.date_retour IS NOT NULL THEN 'en_attente' ELSE 'en_attente_planification' END,
          'brouillon', 'fixe',
          NEW.vin_retour,
          NEW.contact_arrivee_nom, NEW.contact_arrivee_tel, NEW.contact_arrivee_note,
          NEW.contact_depart_nom, NEW.contact_depart_tel, NEW.contact_depart_note,
          'restitution', NEW.numero, v_livraison_id, NEW.immatriculation_retour
        );
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;