-- 1) Convoyeurs : protection par liste blanche (future-proof)
CREATE OR REPLACE FUNCTION public.convoyeurs_protect_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  allowed text[] := array[
    'nom','prenom','telephone','ville','disponibilite','permis','message',
    'permis_numero','annees_experience','permis_photo_url','avatar_url',
    'iban','bic','titulaire_compte','updated_at'
  ];
  merged jsonb;
  k text;
begin
  if public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'super_admin')
     or auth.role() = 'service_role' or auth.uid() is null
     or current_user in ('postgres','supabase_admin') then
    return new;
  end if;

  merged := to_jsonb(old);
  foreach k in array allowed loop
    merged := jsonb_set(merged, array[k], to_jsonb(new) -> k, true);
  end loop;

  new := jsonb_populate_record(old, merged);
  return new;
end;
$function$;

-- 2) Avis clients : lecture publique limitée aux colonnes d'affichage
DROP POLICY IF EXISTS avis_public_read ON public.avis_clients;
CREATE POLICY avis_public_read ON public.avis_clients
  FOR SELECT TO anon
  USING (statut = 'publie');

REVOKE SELECT ON public.avis_clients FROM anon;
GRANT SELECT (id, note, commentaire, nom_affiche_public, ville, type_client, date_avis, statut)
  ON public.avis_clients TO anon;

-- 3) Fidélité : réservé à l'administration (les clients passent par le serveur)
DROP POLICY IF EXISTS loyalty_settings_read_auth ON public.loyalty_settings;
CREATE POLICY loyalty_settings_read_auth ON public.loyalty_settings
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));
