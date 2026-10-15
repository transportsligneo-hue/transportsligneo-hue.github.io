create or replace function public.is_demo_account()
returns boolean language sql stable security definer set search_path=public as $$
  select coalesce(lower(auth.jwt()->>'email') = 'demo-flotte@transportsligneo.fr', false)
$$;
grant execute on function public.is_demo_account() to authenticated, anon;

do $$
declare t text; c text;
begin
  foreach t in array array['missions','devis','devis_lots','devis_lignes','devis_brouillons','demandes_convoyage','b2b_transport_requests','vehicles','vehicle_documents','vehicle_costs','vehicle_maintenances','vehicle_finance_contracts','vehicle_service_events','conducteurs_flotte','conducteur_vehicules','organizations','organization_members','organization_sites','org_invitations','fleet_driver_invitations','client_default_addresses','profiles','factures','api_keys','api_webhook_endpoints','chat_messages','chat_conversations','user_mfa_settings','fleet_settings']
  loop
    if to_regclass('public.'||t) is null then continue; end if;
    foreach c in array array['insert','update','delete'] loop
      execute format('drop policy if exists %I on public.%I', 'demo_block_'||c, t);
      if c = 'insert' then
        execute format('create policy %I on public.%I as restrictive for insert to authenticated with check (not public.is_demo_account())', 'demo_block_'||c, t);
      else
        execute format('create policy %I on public.%I as restrictive for %s to authenticated using (not public.is_demo_account())', 'demo_block_'||c, t, c);
      end if;
    end loop;
  end loop;
end $$;