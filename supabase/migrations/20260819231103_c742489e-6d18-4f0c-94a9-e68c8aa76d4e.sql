create or replace function public.convoyeurs_protect_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'super_admin') or auth.role() = 'service_role' then
    return new;
  end if;

  new.statut := old.statut;
  new.account_status := old.account_status;
  new.niveau := old.niveau;
  new.missions_terminees := old.missions_terminees;
  new.note_moyenne := old.note_moyenne;
  new.organization_id := old.organization_id;
  new.user_id := old.user_id;
  return new;
end;
$$;

drop trigger if exists convoyeurs_protect_privileged_columns on public.convoyeurs;
create trigger convoyeurs_protect_privileged_columns
before update on public.convoyeurs
for each row execute function public.convoyeurs_protect_privileged_columns();