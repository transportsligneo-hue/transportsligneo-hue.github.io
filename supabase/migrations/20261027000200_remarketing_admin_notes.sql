-- Remarketing admin : notes internes sur les prestataires (privées, jamais visibles du prestataire ni du client).
alter table public.remarketing_prestataires add column if not exists notes_admin text;
