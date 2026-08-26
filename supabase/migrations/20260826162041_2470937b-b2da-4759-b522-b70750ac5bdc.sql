CREATE OR REPLACE FUNCTION public.attributions_protect_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL
     AND coalesce(current_setting('request.jwt.claims', true), '') = '' THEN
    RETURN NEW;
  END IF;

  IF has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) THEN
    RETURN NEW;
  END IF;

  NEW.is_public        := OLD.is_public;
  NEW.mode             := OLD.mode;
  NEW.pdf_share_client := OLD.pdf_share_client;
  NEW.trajet_id        := OLD.trajet_id;
  NEW.convoyeur_id     := OLD.convoyeur_id;
  NEW.numero_mission   := OLD.numero_mission;

  IF NEW.statut_convoyeur IS DISTINCT FROM OLD.statut_convoyeur THEN
    IF OLD.statut_convoyeur IS DISTINCT FROM 'en_attente'
       OR NEW.statut_convoyeur NOT IN ('accepte', 'refuse') THEN
      NEW.statut_convoyeur := OLD.statut_convoyeur;
      NEW.repondu_at       := OLD.repondu_at;
      NEW.refus_motif      := OLD.refus_motif;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

UPDATE public.attributions a
   SET numero_mission = NULL
  FROM public.trajets t
 WHERE a.trajet_id = t.id
   AND t.numero_mission IS NOT NULL;

WITH cible AS (
  SELECT a.id,
         public.mission_numero_base(t.numero_mission) || public.mission_leg_suffix(t.id) AS num,
         a.created_at
    FROM public.attributions a
    JOIN public.trajets t ON t.id = a.trajet_id
   WHERE t.numero_mission IS NOT NULL
),
unique_num AS (
  SELECT id,
         num || CASE WHEN row_number() OVER (PARTITION BY num ORDER BY created_at, id) > 1
                     THEN '.' || row_number() OVER (PARTITION BY num ORDER BY created_at, id)
                     ELSE '' END AS num
    FROM cible
)
UPDATE public.attributions a
   SET numero_mission = u.num, updated_at = now()
  FROM unique_num u
 WHERE a.id = u.id;