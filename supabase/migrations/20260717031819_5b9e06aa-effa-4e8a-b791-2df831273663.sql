-- Supprime l'ancienne signature sans argument qui rendait admin_create_test_mission
-- ambiguë via PostgREST (la RPC échouait dès qu'on ne passait pas de convoyeur cible).
DROP FUNCTION IF EXISTS public.admin_create_test_mission();