-- 1. Add 'actif' column to user_roles for suspend/activate
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS actif boolean NOT NULL DEFAULT true;

-- 2. Create disponibilites_convoyeurs table
CREATE TABLE IF NOT EXISTS public.disponibilites_convoyeurs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  convoyeur_id uuid NOT NULL REFERENCES public.convoyeurs(id) ON DELETE CASCADE,
  date_dispo date NOT NULL,
  statut text NOT NULL DEFAULT 'disponible' CHECK (statut IN ('disponible', 'indisponible')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (convoyeur_id, date_dispo)
);

CREATE INDEX IF NOT EXISTS idx_dispos_convoyeur_date
  ON public.disponibilites_convoyeurs (convoyeur_id, date_dispo);

ALTER TABLE public.disponibilites_convoyeurs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Convoyeurs manage own dispos"
  ON public.disponibilites_convoyeurs
  FOR ALL
  TO authenticated
  USING (
    convoyeur_id IN (SELECT id FROM public.convoyeurs WHERE user_id = auth.uid())
  )
  WITH CHECK (
    convoyeur_id IN (SELECT id FROM public.convoyeurs WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins manage all dispos"
  ON public.disponibilites_convoyeurs
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_dispos_updated_at
  BEFORE UPDATE ON public.disponibilites_convoyeurs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Performance indexes
CREATE INDEX IF NOT EXISTS idx_missions_user_statut
  ON public.missions (user_id, statut);

CREATE INDEX IF NOT EXISTS idx_missions_statut_date
  ON public.missions (statut, date_prise_en_charge);

CREATE INDEX IF NOT EXISTS idx_attributions_convoyeur_statut
  ON public.attributions (convoyeur_id, statut);