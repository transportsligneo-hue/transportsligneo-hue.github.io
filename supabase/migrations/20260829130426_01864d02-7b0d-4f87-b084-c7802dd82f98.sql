alter table public.devis add column if not exists public_token text;
update public.devis set public_token = encode(gen_random_bytes(24),'hex') where public_token is null;
alter table public.devis alter column public_token set default encode(gen_random_bytes(24),'hex');
alter table public.devis alter column public_token set not null;
create unique index if not exists devis_public_token_key on public.devis(public_token);

alter table public.devis_otp_challenges alter column client_user_id drop not null;
alter table public.devis_otp_challenges alter column email drop not null;
alter table public.devis_otp_challenges add column if not exists phone text;