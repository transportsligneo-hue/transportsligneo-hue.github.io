DROP FUNCTION IF EXISTS public.get_missions_client_flags(uuid[]);

CREATE OR REPLACE FUNCTION public.get_missions_client_flags(p_mission_ids uuid[])
 RETURNS TABLE(mission_id uuid, recharge_seule boolean, annulation_motif text, incident_titre text, immatriculation text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with visible as (
    select m.id, m.numero, m.immatriculation
    from missions m
    where m.id = any(p_mission_ids)
      and (
        m.user_id = auth.uid()
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.email(), ''))
        or m.organization_id in (select organization_id from organization_members where user_id = auth.uid() and status = 'active')
        or m.fleet_organization_id in (select organization_id from organization_members where user_id = auth.uid() and status = 'active')
        or m.organization_id = (select organization_id from profiles where user_id = auth.uid())
      )
  ),
  rech as (
    select tr.mission_id,
           bool_or(coalesce((tr.options_meta ->> 'recharge_seule')::boolean, false)
                   or tr.type_mission ilike 'recharg%') as recharge
    from trajets tr
    where tr.mission_id in (select id from visible)
    group by tr.mission_id
  ),
  plaque as (
    select distinct on (tr.mission_id) tr.mission_id,
           upper(nullif(trim(coalesce(nullif(tr.immatriculation, ''), nullif(tr.vehicule_immatriculation, ''))), '')) as plaque
    from trajets tr
    where tr.mission_id in (select id from visible)
      and coalesce(nullif(trim(coalesce(tr.immatriculation, '')), ''), nullif(trim(coalesce(tr.vehicule_immatriculation, '')), '')) is not null
    order by tr.mission_id, tr.created_at asc nulls last
  ),
  att as (
    select distinct on (tr.mission_id) tr.mission_id,
           nullif(trim(concat_ws(' — ', nullif(a.annulation_categorie, ''), nullif(a.annulation_motif, ''))), '') as motif
    from attributions a
    join trajets tr on tr.id = a.trajet_id
    where tr.mission_id in (select id from visible)
    order by tr.mission_id, a.updated_at desc nulls last
  ),
  inc as (
    select distinct on (tr.mission_id) tr.mission_id, i.titre
    from mission_incidents i
    join attributions a on a.id = i.attribution_id
    join trajets tr on tr.id = a.trajet_id
    where tr.mission_id in (select id from visible)
    order by tr.mission_id, i.created_at desc
  )
  select v.id,
         coalesce(rech.recharge, false),
         att.motif,
         inc.titre,
         upper(nullif(trim(coalesce(nullif(v.immatriculation, ''), plaque.plaque)), ''))
  from visible v
  left join rech on rech.mission_id = v.id
  left join plaque on plaque.mission_id = v.id
  left join att on att.mission_id = v.id
  left join inc on inc.mission_id = v.id;
$function$;

GRANT EXECUTE ON FUNCTION public.get_missions_client_flags(uuid[]) TO authenticated;