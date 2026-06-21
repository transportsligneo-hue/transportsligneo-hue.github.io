-- Permettre aux convoyeurs de lire les trajets sur lesquels ils ont une attribution.
-- Sans cette policy, la vue trajets_assigned_safe (security_invoker=on) renvoie 0 ligne
-- côté driver, ce qui masque numéro mission, client, véhicule, adresses, dates…
CREATE POLICY "Convoyeurs read assigned trajets"
  ON public.trajets
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.attributions a
      JOIN public.convoyeurs c ON c.id = a.convoyeur_id
      WHERE a.trajet_id = trajets.id
        AND c.user_id = auth.uid()
    )
  );

-- Index pour que la sous-requête EXISTS reste rapide même avec beaucoup d'attributions.
CREATE INDEX IF NOT EXISTS idx_attributions_trajet_convoyeur
  ON public.attributions (trajet_id, convoyeur_id);
