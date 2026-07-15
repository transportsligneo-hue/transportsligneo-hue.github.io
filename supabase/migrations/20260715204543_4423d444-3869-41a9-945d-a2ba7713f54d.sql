-- Finalisation du reset formation : réinitialise tous les convoyeurs et purge les certificats résiduels
UPDATE public.convoyeurs
SET has_completed_training = false,
    training_status = 'not_started',
    training_completed_at = NULL;

TRUNCATE TABLE public.formation_certificates RESTART IDENTITY CASCADE;