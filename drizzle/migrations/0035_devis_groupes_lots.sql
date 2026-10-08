ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS devis_lot_id uuid;
CREATE INDEX IF NOT EXISTS missions_devis_lot_idx ON public.missions(devis_lot_id);

CREATE OR REPLACE FUNCTION public.can_order_devis(_devis_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.devis d
    LEFT JOIN public.profiles p ON p.user_id = d.user_id
    WHERE d.id = _devis_id AND (
      d.user_id = _user_id
      OR (p.organization_id IS NOT NULL AND (public.is_org_owner(p.organization_id, _user_id) OR public.is_org_admin(p.organization_id, _user_id)))
    )
  )
$$;

CREATE OR REPLACE FUNCTION public.can_read_devis_lots(_devis_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.can_order_devis(_devis_id, _user_id)
    OR public.has_role(_user_id, 'admin') OR public.has_role(_user_id, 'super_admin')
$$;

CREATE TABLE public.devis_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  devis_id uuid NOT NULL REFERENCES public.devis(id) ON DELETE CASCADE,
  numero int NOT NULL,
  nom text,
  created_by uuid,
  nb_lignes int NOT NULL DEFAULT 0,
  nb_missions int NOT NULL DEFAULT 0,
  total_ttc numeric NOT NULL DEFAULT 0,
  total_ht numeric NOT NULL DEFAULT 0,
  signer_name text,
  signature_data text,
  signed_at timestamptz,
  paiement_statut text NOT NULL DEFAULT 'non_requis',
  statut text NOT NULL DEFAULT 'valide',
  facture_id uuid,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.devis_lots TO authenticated;
GRANT ALL ON public.devis_lots TO service_role;
ALTER TABLE public.devis_lots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lots lisibles" ON public.devis_lots FOR SELECT TO authenticated
  USING (public.can_read_devis_lots(devis_id, auth.uid()));

CREATE TABLE public.devis_lignes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  devis_id uuid NOT NULL REFERENCES public.devis(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  type_ligne text NOT NULL DEFAULT 'aller_simple' CHECK (type_ligne IN ('aller_simple','livraison_simple','livraison_restitution')),
  depart text,
  arrivee text,
  date_enlevement date,
  heure_enlevement text,
  date_livraison date,
  heure_livraison text,
  adresse_retour text,
  date_restitution date,
  heure_restitution text,
  contact_nom text,
  contact_tel text,
  immatriculation text,
  vin text,
  marque text,
  modele text,
  energie text,
  prix_aller numeric NOT NULL DEFAULT 0,
  prix_retour numeric NOT NULL DEFAULT 0,
  statut text NOT NULL DEFAULT 'a_valider' CHECK (statut IN ('a_valider','validee')),
  lot_id uuid REFERENCES public.devis_lots(id) ON DELETE SET NULL,
  mission_ids uuid[] NOT NULL DEFAULT '{}',
  mission_numero text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX devis_lignes_devis_idx ON public.devis_lignes(devis_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.devis_lignes TO authenticated;
GRANT ALL ON public.devis_lignes TO service_role;
ALTER TABLE public.devis_lignes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lignes lisibles" ON public.devis_lignes FOR SELECT TO authenticated
  USING (public.can_read_devis_lots(devis_id, auth.uid()));
CREATE POLICY "Lignes ajout" ON public.devis_lignes FOR INSERT TO authenticated
  WITH CHECK (statut = 'a_valider' AND lot_id IS NULL AND public.can_order_devis(devis_id, auth.uid()));
CREATE POLICY "Lignes modif" ON public.devis_lignes FOR UPDATE TO authenticated
  USING (statut = 'a_valider' AND public.can_order_devis(devis_id, auth.uid()))
  WITH CHECK (statut = 'a_valider' AND lot_id IS NULL AND public.can_order_devis(devis_id, auth.uid()));
CREATE POLICY "Lignes suppression" ON public.devis_lignes FOR DELETE TO authenticated
  USING (statut = 'a_valider' AND public.can_order_devis(devis_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.validate_devis_lot(_devis_id uuid, _ligne_ids uuid[], _nom text, _signer_name text, _signature text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  d record; l record; v_lot uuid; v_num int; v_target text; v_user uuid; v_org uuid; v_type text;
  v_idx int; v_total numeric := 0; v_count int := 0; v_missions int := 0; v_missing text := '';
  v_m1 uuid; v_m2 uuid; v_grp uuid; v_client text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_order_devis(_devis_id, auth.uid()) THEN
    RAISE EXCEPTION 'Vous n''êtes pas autorisé à valider ce devis';
  END IF;
  IF _ligne_ids IS NULL OR array_length(_ligne_ids, 1) IS NULL THEN RAISE EXCEPTION 'Sélection vide'; END IF;
  IF coalesce(trim(_signature), '') = '' THEN RAISE EXCEPTION 'Signature requise'; END IF;
  SELECT * INTO d FROM public.devis WHERE id = _devis_id FOR UPDATE;
  IF d.expires_at IS NOT NULL AND d.expires_at < now() THEN RAISE EXCEPTION 'Devis expiré'; END IF;

  FOR l IN SELECT * FROM public.devis_lignes WHERE devis_id = _devis_id AND id = ANY(_ligne_ids) FOR UPDATE LOOP
    IF l.statut <> 'a_valider' THEN RAISE EXCEPTION 'Une ligne est déjà validée'; END IF;
    IF coalesce(trim(l.depart),'') = '' OR coalesce(trim(l.arrivee),'') = '' OR l.date_enlevement IS NULL OR coalesce(trim(l.immatriculation),'') = ''
       OR (l.type_ligne = 'livraison_restitution' AND l.date_restitution IS NULL) THEN
      v_missing := v_missing || l.id::text || ',';
    END IF;
    v_count := v_count + 1;
    v_total := v_total + l.prix_aller + CASE WHEN l.type_ligne = 'livraison_restitution' THEN l.prix_retour ELSE 0 END;
  END LOOP;
  IF v_count <> array_length(_ligne_ids, 1) THEN RAISE EXCEPTION 'Lignes introuvables'; END IF;
  IF v_missing <> '' THEN RAISE EXCEPTION 'CHAMPS_MANQUANTS:%', rtrim(v_missing, ','); END IF;

  v_target := regexp_replace(coalesce(d.numero,''), '^DEV-TLG-', 'MIS-TLG-');
  v_user := d.user_id;
  SELECT organization_id, type_client, coalesce(nullif(societe,''), trim(coalesce(prenom,'')||' '||coalesce(nom,''))) INTO v_org, v_type, v_client FROM public.profiles WHERE user_id = v_user LIMIT 1;
  v_grp := coalesce(d.mission_group_id, gen_random_uuid());
  IF d.mission_group_id IS NULL THEN UPDATE public.devis SET mission_group_id = v_grp WHERE id = d.id; END IF;

  SELECT coalesce(max(numero),0)+1 INTO v_num FROM public.devis_lots WHERE devis_id = _devis_id;
  INSERT INTO public.devis_lots (devis_id, numero, nom, created_by, nb_lignes, total_ttc, total_ht, signer_name, signature_data, signed_at, paiement_statut)
  VALUES (_devis_id, v_num, nullif(trim(coalesce(_nom,'')),''), auth.uid(), v_count, round(v_total,2), round(v_total/1.2,2),
    nullif(trim(coalesce(_signer_name,'')),''), _signature, now(),
    CASE WHEN coalesce(d.paiement_immediat, true) THEN 'a_payer' ELSE 'non_requis' END)
  RETURNING id INTO v_lot;

  SELECT coalesce(max(leg_index),0) INTO v_idx FROM public.missions WHERE devis_id = _devis_id;

  FOR l IN SELECT * FROM public.devis_lignes WHERE id = ANY(_ligne_ids) ORDER BY position, created_at LOOP
    v_idx := v_idx + 1; v_m2 := NULL;
    INSERT INTO public.missions (numero, devis_id, devis_lot_id, user_id, organization_id, fleet_organization_id,
      nom, prenom, email, telephone, ville_depart, ville_arrivee, date_prise_en_charge, type_trajet,
      marque, modele, carburant, vin, immatriculation, remarques, prix_total, statut,
      mission_group_id, leg_type, leg_index, contact_arrivee_nom, contact_arrivee_tel)
    VALUES (v_target, d.id, v_lot, v_user, v_org, CASE WHEN v_type='flotte' THEN v_org END,
      coalesce(d.nom,''), coalesce(d.prenom,''), coalesce(d.email,''), d.telephone, l.depart, l.arrivee, l.date_enlevement,
      CASE WHEN l.type_ligne='livraison_restitution' THEN 'aller_retour' ELSE 'aller_simple' END,
      l.marque, l.modele, l.energie, nullif(upper(trim(coalesce(l.vin,''))),''), upper(trim(l.immatriculation)),
      d.message, l.prix_aller, 'en_attente',
      CASE WHEN l.type_ligne='livraison_restitution' THEN gen_random_uuid() ELSE v_grp END,
      CASE WHEN l.type_ligne='livraison_restitution' THEN 'aller' ELSE 'simple' END, v_idx, l.contact_nom, l.contact_tel)
    RETURNING id INTO v_m1;
    v_missions := v_missions + 1;
    IF l.type_ligne = 'livraison_restitution' THEN
      v_idx := v_idx + 1;
      INSERT INTO public.missions (numero, devis_id, devis_lot_id, user_id, organization_id, fleet_organization_id,
        nom, prenom, email, telephone, ville_depart, ville_arrivee, date_prise_en_charge, type_trajet,
        marque, modele, carburant, vin, immatriculation, remarques, prix_total, statut,
        mission_group_id, leg_type, leg_index, contact_depart_nom, contact_depart_tel)
      SELECT v_target, d.id, v_lot, v_user, v_org, CASE WHEN v_type='flotte' THEN v_org END,
        coalesce(d.nom,''), coalesce(d.prenom,''), coalesce(d.email,''), d.telephone, l.arrivee,
        coalesce(nullif(trim(coalesce(l.adresse_retour,'')),''), l.depart), l.date_restitution, 'aller_retour',
        l.marque, l.modele, l.energie, nullif(upper(trim(coalesce(l.vin,''))),''), upper(trim(l.immatriculation)),
        d.message, l.prix_retour, 'en_attente', m.mission_group_id, 'retour', v_idx, l.contact_nom, l.contact_tel
      FROM public.missions m WHERE m.id = v_m1
      RETURNING id INTO v_m2;
      v_missions := v_missions + 1;
    END IF;
    UPDATE public.devis_lignes SET statut='validee', lot_id=v_lot,
      mission_ids = CASE WHEN v_m2 IS NULL THEN ARRAY[v_m1] ELSE ARRAY[v_m1, v_m2] END,
      mission_numero = v_target, updated_at = now()
    WHERE id = l.id;
  END LOOP;

  UPDATE public.devis_lots SET nb_missions = v_missions WHERE id = v_lot;

  PERFORM public.create_admin_notification('devis_lot_valide',
    'Lot validé : ' || coalesce(nullif(trim(coalesce(_nom,'')),''), 'Lot ' || v_num),
    coalesce(v_client, d.email, 'Client') || ' · ' || v_missions || ' mission(s) · ' || to_char(round(v_total,2), 'FM999G999D00') || ' €',
    '/admin/devis/' || d.id, 'devis', d.id, jsonb_build_object('lot_id', v_lot, 'missions', v_missions, 'total', round(v_total,2)));
  RETURN v_lot;
END $$;

CREATE OR REPLACE FUNCTION public.cancel_devis_lot(_lot_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_lot record;
BEGIN
  SELECT * INTO v_lot FROM public.devis_lots WHERE id = _lot_id FOR UPDATE;
  IF v_lot.id IS NULL THEN RAISE EXCEPTION 'Lot introuvable'; END IF;
  IF auth.uid() IS NULL OR NOT (public.can_order_devis(v_lot.devis_id, auth.uid()) OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')) THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;
  IF v_lot.statut <> 'valide' THEN RAISE EXCEPTION 'Lot déjà annulé'; END IF;
  IF EXISTS (SELECT 1 FROM public.missions WHERE devis_lot_id = _lot_id AND statut NOT IN ('en_attente','annulee')) THEN
    RAISE EXCEPTION 'Une mission du lot a déjà démarré ou est confirmée : contactez Transports Ligneo';
  END IF;
  UPDATE public.missions SET statut = 'annulee', updated_at = now() WHERE devis_lot_id = _lot_id;
  UPDATE public.devis_lignes SET statut='a_valider', lot_id=NULL, mission_ids='{}', mission_numero=NULL, updated_at=now() WHERE lot_id = _lot_id;
  UPDATE public.devis_lots SET statut='annule', cancelled_at=now() WHERE id = _lot_id;
  PERFORM public.create_admin_notification('devis_lot_annule', 'Lot annulé : ' || coalesce(v_lot.nom, 'Lot ' || v_lot.numero), NULL,
    '/admin/devis/' || v_lot.devis_id, 'devis', v_lot.devis_id, jsonb_build_object('lot_id', _lot_id));
END $$;

REVOKE EXECUTE ON FUNCTION public.validate_devis_lot(uuid, uuid[], text, text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.cancel_devis_lot(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.validate_devis_lot(uuid, uuid[], text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_devis_lot(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_order_devis(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_devis_lots(uuid, uuid) TO authenticated;