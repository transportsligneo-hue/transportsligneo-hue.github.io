-- 1) avis_clients : vue publique limitée aux colonnes d'affichage, suppression de la lecture anonyme de la table brute
create or replace view public.avis_publics
with (security_barrier = true) as
select id, note, commentaire, nom_affiche_public, ville, type_client, date_avis
from public.avis_clients
where statut = 'publie';

grant select on public.avis_publics to anon;
grant select on public.avis_publics to authenticated;

drop policy if exists avis_public_read on public.avis_clients;

-- 2) convoyeurs : ajout du champ delai_paiement_defaut à la liste des champs verrouillés
drop policy if exists "Convoyeurs can update own record" on public.convoyeurs;
drop function if exists public.convoyeurs_self_update_allowed(uuid, text, text, text, integer, numeric, uuid, text, text, boolean, text);

create or replace function public.convoyeurs_self_update_allowed(
  _id uuid,
  _statut text,
  _account_status text,
  _niveau text,
  _missions_terminees integer,
  _note_moyenne numeric,
  _organization_id uuid,
  _type_convoyeur text,
  _training_status text,
  _has_completed_training boolean,
  _email text,
  _delai_paiement_defaut public.convoyeurs.delai_paiement_defaut%TYPE
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  SELECT public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
      OR EXISTS (
        SELECT 1 FROM public.convoyeurs c
        WHERE c.id = _id
          AND c.statut IS NOT DISTINCT FROM _statut
          AND c.account_status IS NOT DISTINCT FROM _account_status
          AND c.niveau IS NOT DISTINCT FROM _niveau
          AND c.missions_terminees IS NOT DISTINCT FROM _missions_terminees
          AND c.note_moyenne IS NOT DISTINCT FROM _note_moyenne
          AND c.organization_id IS NOT DISTINCT FROM _organization_id
          AND c.type_convoyeur IS NOT DISTINCT FROM _type_convoyeur
          AND c.training_status IS NOT DISTINCT FROM _training_status
          AND c.has_completed_training IS NOT DISTINCT FROM _has_completed_training
          AND c.email IS NOT DISTINCT FROM _email
          AND c.delai_paiement_defaut IS NOT DISTINCT FROM _delai_paiement_defaut
      );
$$;

create policy "Convoyeurs can update own record" on public.convoyeurs
for update to authenticated
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and public.convoyeurs_self_update_allowed(id, statut, account_status, niveau, missions_terminees, note_moyenne, organization_id, type_convoyeur, training_status, has_completed_training, email, delai_paiement_defaut)
);

-- 3) organization_members : empêcher l'escalade de rôle par un admin d'organisation
create or replace function public.is_org_owner(_org_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = _org_id
      AND user_id = _user_id
      AND status = 'active'
      AND member_role = 'owner'
  );
$$;

create or replace function public.org_member_role_guard(_id uuid, _user_id uuid, _new_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  SELECT _user_id IS DISTINCT FROM auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.id = _id
        AND om.member_role = _new_role
    );
$$;

drop policy if exists "Org admins can manage own org members" on public.organization_members;

create policy "Org admins can manage own org members" on public.organization_members
for all to authenticated
using (
  public.is_org_admin(organization_id, auth.uid())
  and (member_role <> 'owner' or public.is_org_owner(organization_id, auth.uid()))
)
with check (
  public.is_org_admin(organization_id, auth.uid())
  and (member_role <> 'owner' or public.is_org_owner(organization_id, auth.uid()))
  and public.org_member_role_guard(id, user_id, member_role)
);