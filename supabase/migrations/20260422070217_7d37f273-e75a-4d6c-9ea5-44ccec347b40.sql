-- 1. Ajouter etape_courante sur attributions (champ texte libre, nullable pour rétrocompat)
ALTER TABLE public.attributions
  ADD COLUMN IF NOT EXISTS etape_courante text;

-- 2. Table d'historique des étapes
CREATE TABLE IF NOT EXISTS public.mission_etape_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  attribution_id uuid NOT NULL REFERENCES public.attributions(id) ON DELETE CASCADE,
  etape text NOT NULL,
  notes text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mission_etape_history_attribution
  ON public.mission_etape_history(attribution_id, created_at DESC);

ALTER TABLE public.mission_etape_history ENABLE ROW LEVEL SECURITY;

-- Admins gèrent tout
CREATE POLICY "Admins manage etape history"
  ON public.mission_etape_history FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Convoyeurs lisent l'historique de leurs missions
CREATE POLICY "Convoyeurs read own etape history"
  ON public.mission_etape_history FOR SELECT
  TO authenticated
  USING (
    attribution_id IN (
      SELECT a.id FROM public.attributions a
      JOIN public.convoyeurs c ON c.id = a.convoyeur_id
      WHERE c.user_id = auth.uid()
    )
  );

-- Convoyeurs ajoutent des étapes sur leurs missions
CREATE POLICY "Convoyeurs insert own etape history"
  ON public.mission_etape_history FOR INSERT
  TO authenticated
  WITH CHECK (
    attribution_id IN (
      SELECT a.id FROM public.attributions a
      JOIN public.convoyeurs c ON c.id = a.convoyeur_id
      WHERE c.user_id = auth.uid()
    )
  );