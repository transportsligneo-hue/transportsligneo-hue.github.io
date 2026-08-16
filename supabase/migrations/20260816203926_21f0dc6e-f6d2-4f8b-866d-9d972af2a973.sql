ALTER VIEW public.trajets_assigned_safe SET (security_invoker = off);
GRANT SELECT ON public.trajets_assigned_safe TO authenticated;