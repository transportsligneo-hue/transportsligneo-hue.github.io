CREATE OR REPLACE FUNCTION public.get_missions_client_flags(p_mission_ids uuid[])
RETURNS TABLE (
  mission_id uuid,
  recharge_seule boolean,
  annulation_motif text,
  incident_titre text,
  immatriculation text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
  linked as (
    select v.id as m_id,
           tr.id as t_id,
           tr.created_at as t_created_at,
           tr.options_meta as t_options_meta,
           tr.type_mission as t_type_mission,
           coalesce(nullif(tr.immatriculation, ''), nullif(tr.vehicule_immatriculation, '')) as t_plaque
    from visible v
    join trajets tr
      on tr.mission_id = v.id
      or (
        tr.numero_mission is not null
        and (tr.numero_mission = v.numero or tr.numero_mission like v.numero || '.%' or tr.numero_mission like v.numero || '-%')
        and (
          v.immatriculation is null
          or upper(regexp_replace(coalesce(v.immatriculation, ''), '[^A-Za-z0-9]', '', 'g'))
             = upper(regexp_replace(coalesce(tr.immatriculation, tr.vehicule_immatriculation, ''), '[^A-Za-z0-9]', '', 'g'))
        )
      )
  ),
  rech as (
    select l.m_id,
           bool_or(coalesce((l.t_options_meta ->> 'recharge_seule')::boolean, false)
                   or l.t_type_mission ilike 'recharg%') as recharge
    from linked l
    group by l.m_id
  ),
  plaque as (
    select distinct on (l.m_id) l.m_id,
           upper(nullif(trim(l.t_plaque), '')) as plaque
    from linked l
    where nullif(trim(coalesce(l.t_plaque, '')), '') is not null
    order by l.m_id, l.t_created_at asc nulls last
  ),
  att as (
    select distinct on (l.m_id) l.m_id,
           nullif(trim(concat_ws(' — ', nullif(a.annulation_categorie, ''), nullif(a.annulation_motif, ''))), '') as motif
    from linked l
    join attributions a on a.trajet_id = l.t_id
    order by l.m_id, a.updated_at desc nulls last
  ),
  inc as (
    select distinct on (l.m_id) l.m_id, i.titre
    from linked l
    join attributions a on a.trajet_id = l.t_id
    join mission_incidents i on i.attribution_id = a.id
    order by l.m_id, i.created_at desc
  )
  select v.id,
         coalesce(rech.recharge, false),
         att.motif,
         inc.titre,
         upper(nullif(trim(coalesce(nullif(v.immatriculation, ''), plaque.plaque)), ''))
  from visible v
  left join rech on rech.m_id = v.id
  left join plaque on plaque.m_id = v.id
  left join att on att.m_id = v.id
  left join inc on inc.m_id = v.id;
$$;