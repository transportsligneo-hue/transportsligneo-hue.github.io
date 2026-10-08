REVOKE EXECUTE ON FUNCTION public.can_order_devis(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_read_devis_lots(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.accept_org_invitation(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.list_org_members(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_order_devis(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_read_devis_lots(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accept_org_invitation(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_org_members(uuid) TO authenticated, service_role;