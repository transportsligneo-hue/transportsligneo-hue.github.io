ALTER TABLE public.attributions
  ADD COLUMN IF NOT EXISTS annulation_categorie text,
  ADD COLUMN IF NOT EXISTS annulation_motif text,
  ADD COLUMN IF NOT EXISTS annulation_at timestamptz,
  ADD COLUMN IF NOT EXISTS annulation_par uuid,
  ADD COLUMN IF NOT EXISTS annulation_facturable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS annulation_indemnite numeric,
  ADD COLUMN IF NOT EXISTS annulation_passage_vide boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.admin_cancel_mission(
  _attribution_id uuid,
  _categorie text,
  _motif text DEFAULT NULL,
  _facturable boolean DEFAULT false,
  _indemnite numeric DEFAULT NULL,
  _passage_vide boolean DEFAULT false,
  _cancel_trajet boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_trajet uuid;
BEGIN
  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  IF _categorie IS NULL OR btrim(_categorie) = '' THEN
    RAISE EXCEPTION 'Motif d''annulation requis';
  END IF;

  UPDATE public.attributions
     SET statut = 'annule',
         annulation_categorie = _categorie,
         annulation_motif = NULLIF(btrim(coalesce(_motif, '')), ''),
         annulation_at = now(),
         annulation_par = auth.uid(),
         annulation_facturable = coalesce(_facturable, false),
         annulation_indemnite = _indemnite,
         annulation_passage_vide = coalesce(_passage_vide, false),
         updated_at = now()
   WHERE id = _attribution_id
   RETURNING trajet_id INTO v_trajet;

  IF v_trajet IS NULL THEN
    RAISE EXCEPTION 'Mission introuvable';
  END IF;

  IF coalesce(_cancel_trajet, true) THEN
    UPDATE public.trajets
       SET statut = 'annule',
           statut_publication = 'annule'
     WHERE id = v_trajet;
  END IF;

  INSERT INTO public.mission_etape_history (attribution_id, etape, notes, created_by)
  VALUES (
    _attribution_id,
    'mission_annulee',
    'Annulation admin · ' || _categorie
      || coalesce(' · ' || NULLIF(btrim(coalesce(_motif, '')), ''), '')
      || CASE WHEN coalesce(_facturable, false) THEN ' · facturable' ELSE ' · non facturable' END
      || coalesce(' · indemnité ' || _indemnite::text || ' EUR', ''),
    auth.uid()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_cancel_mission(uuid, text, text, boolean, numeric, boolean, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_cancel_mission(uuid, text, text, boolean, numeric, boolean, boolean) TO authenticated;