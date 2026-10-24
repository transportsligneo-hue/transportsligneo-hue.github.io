-- Validation interne des demandes (entreprises / flottes)
-- Une organisation peut exiger qu'un administrateur valide les demandes créées par ses collaborateurs
-- (logistique, comptabilité) avant qu'elles n'arrivent chez Transports Ligneo.

ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS validation_required boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.org_approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL,
  requester_label text,
  resume text,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','refused')),
  decided_by uuid,
  decided_at timestamptz,
  motif text,
  demande_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_org_approval_org ON public.org_approval_requests(organization_id, status);
ALTER TABLE public.org_approval_requests ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.ligneo_is_org_member(_org uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.organization_members m WHERE m.organization_id=_org AND m.user_id=auth.uid() AND m.status='active')
$$;
CREATE OR REPLACE FUNCTION public.ligneo_is_org_admin(_org uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.organization_members m WHERE m.organization_id=_org AND m.user_id=auth.uid() AND m.status='active' AND m.member_role IN ('owner','admin'))
$$;
GRANT EXECUTE ON FUNCTION public.ligneo_is_org_member(uuid), public.ligneo_is_org_admin(uuid) TO authenticated;

DROP POLICY IF EXISTS "approval_select" ON public.org_approval_requests;
CREATE POLICY "approval_select" ON public.org_approval_requests FOR SELECT TO authenticated
  USING (requested_by = auth.uid() OR public.ligneo_is_org_admin(organization_id));
DROP POLICY IF EXISTS "approval_insert" ON public.org_approval_requests;
CREATE POLICY "approval_insert" ON public.org_approval_requests FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid() AND public.ligneo_is_org_member(organization_id) AND status = 'pending' AND NOT public.is_demo_account());

-- Activer / désactiver la validation (administrateur de l'organisation)
CREATE OR REPLACE FUNCTION public.set_org_validation_required(_org uuid, _on boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.ligneo_is_org_admin(_org) THEN RAISE EXCEPTION 'Réservé aux administrateurs' USING ERRCODE='42501'; END IF;
  IF public.is_demo_account() THEN RAISE EXCEPTION 'Action indisponible en démonstration' USING ERRCODE='42501'; END IF;
  UPDATE public.organizations SET validation_required = _on WHERE id = _org;
END $$;
GRANT EXECUTE ON FUNCTION public.set_org_validation_required(uuid, boolean) TO authenticated;

-- Approuver / refuser : à l'approbation, la demande part chez Transports Ligneo comme une demande normale
CREATE OR REPLACE FUNCTION public.decide_org_request(_id uuid, _approve boolean, _motif text DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.org_approval_requests; cols text; new_id uuid;
BEGIN
  SELECT * INTO r FROM public.org_approval_requests WHERE id=_id FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Demande introuvable'; END IF;
  IF NOT public.ligneo_is_org_admin(r.organization_id) THEN RAISE EXCEPTION 'Réservé aux administrateurs' USING ERRCODE='42501'; END IF;
  IF public.is_demo_account() THEN RAISE EXCEPTION 'Action indisponible en démonstration' USING ERRCODE='42501'; END IF;
  IF r.status <> 'pending' THEN RAISE EXCEPTION 'Demande déjà traitée'; END IF;
  IF _approve THEN
    SELECT string_agg(quote_ident(c.column_name), ',') INTO cols
      FROM information_schema.columns c
     WHERE c.table_schema='public' AND c.table_name='demandes_convoyage' AND r.payload ? c.column_name AND c.column_name <> 'id';
    EXECUTE format('INSERT INTO public.demandes_convoyage (%s) SELECT %s FROM jsonb_populate_record(NULL::public.demandes_convoyage, $1) RETURNING id', cols, cols)
      INTO new_id USING r.payload;
  END IF;
  UPDATE public.org_approval_requests
     SET status = CASE WHEN _approve THEN 'approved' ELSE 'refused' END, decided_by = auth.uid(), decided_at = now(), motif = _motif, demande_id = new_id
   WHERE id = _id;
  RETURN new_id;
END $$;
GRANT EXECUTE ON FUNCTION public.decide_org_request(uuid, boolean, text) TO authenticated;
