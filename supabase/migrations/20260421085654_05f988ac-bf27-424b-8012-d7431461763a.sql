-- 1) Ajout colonnes optionnelles sur trajets (nullable, zéro régression)
ALTER TABLE public.trajets
  ADD COLUMN IF NOT EXISTS prix_suggere numeric,
  ADD COLUMN IF NOT EXISTS statut_publication text NOT NULL DEFAULT 'brouillon';

-- 2) Table des offres convoyeurs
CREATE TABLE IF NOT EXISTS public.mission_offres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trajet_id uuid NOT NULL REFERENCES public.trajets(id) ON DELETE CASCADE,
  convoyeur_id uuid NOT NULL REFERENCES public.convoyeurs(id) ON DELETE CASCADE,
  prix_propose numeric NOT NULL,
  prix_suggere_snapshot numeric,
  type_offre text NOT NULL DEFAULT 'contre_proposition',
  statut text NOT NULL DEFAULT 'en_attente',
  message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trajet_id, convoyeur_id)
);

CREATE INDEX IF NOT EXISTS idx_mission_offres_trajet ON public.mission_offres(trajet_id);
CREATE INDEX IF NOT EXISTS idx_mission_offres_convoyeur ON public.mission_offres(convoyeur_id);
CREATE INDEX IF NOT EXISTS idx_mission_offres_statut ON public.mission_offres(statut);
CREATE INDEX IF NOT EXISTS idx_trajets_publication ON public.trajets(statut_publication);

-- 3) Trigger updated_at
CREATE TRIGGER trg_mission_offres_updated_at
BEFORE UPDATE ON public.mission_offres
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) RLS
ALTER TABLE public.mission_offres ENABLE ROW LEVEL SECURITY;

-- Admin : tout gérer
CREATE POLICY "Admins can manage all offres"
ON public.mission_offres
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Convoyeur : voir ses propres offres
CREATE POLICY "Convoyeurs can read own offres"
ON public.mission_offres
FOR SELECT
TO authenticated
USING (
  convoyeur_id IN (
    SELECT id FROM public.convoyeurs WHERE user_id = auth.uid()
  )
);

-- Convoyeur : créer une offre sur un trajet publié uniquement
CREATE POLICY "Convoyeurs can create own offres on published trajets"
ON public.mission_offres
FOR INSERT
TO authenticated
WITH CHECK (
  convoyeur_id IN (
    SELECT id FROM public.convoyeurs WHERE user_id = auth.uid() AND statut = 'valide'
  )
  AND trajet_id IN (
    SELECT id FROM public.trajets WHERE statut_publication = 'publie'
  )
);

-- Convoyeur : modifier/retirer ses propres offres tant qu'elles sont en_attente
CREATE POLICY "Convoyeurs can update own pending offres"
ON public.mission_offres
FOR UPDATE
TO authenticated
USING (
  convoyeur_id IN (
    SELECT id FROM public.convoyeurs WHERE user_id = auth.uid()
  )
  AND statut = 'en_attente'
)
WITH CHECK (
  convoyeur_id IN (
    SELECT id FROM public.convoyeurs WHERE user_id = auth.uid()
  )
);

-- Convoyeur : voir les trajets publiés (extension de la policy existante)
-- La policy existante "Convoyeurs can see assigned trajets" est conservée.
-- On ajoute une policy permissive supplémentaire pour les trajets publiés.
CREATE POLICY "Convoyeurs can see published trajets"
ON public.trajets
FOR SELECT
TO authenticated
USING (
  statut_publication = 'publie'
  AND EXISTS (
    SELECT 1 FROM public.convoyeurs
    WHERE user_id = auth.uid() AND statut = 'valide'
  )
);