
-- Indicateurs par mission visibles côté client/flotte : recharge uniquement, motif d'annulation, dernier incident.
create or replace function public.get_missions_client_flags(p_mission_ids uuid[])
returns table(mission_id uuid, recharge_seule boolean, annulation_motif text, incident_titre text)
language sql
stable
security definer
set search_path = public
as $$
  with visible as (
    select m.id, m.numero
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
         inc.titre
  from visible v
  left join rech on rech.mission_id = v.id
  left join att on att.mission_id = v.id
  left join inc on inc.mission_id = v.id;
$$;

revoke all on function public.get_missions_client_flags(uuid[]) from public, anon;
grant execute on function public.get_missions_client_flags(uuid[]) to authenticated;
