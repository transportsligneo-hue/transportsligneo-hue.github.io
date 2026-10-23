-- Sécurité renforcée des clés API : portée (lecture/écriture), IP autorisées, date d'expiration.
alter table public.api_keys
  add column if not exists scope text not null default 'write',
  add column if not exists allowed_ips text[] not null default '{}',
  add column if not exists expires_at timestamptz;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'api_keys_scope_check') then
    alter table public.api_keys add constraint api_keys_scope_check check (scope in ('read','write'));
  end if;
end $$;
