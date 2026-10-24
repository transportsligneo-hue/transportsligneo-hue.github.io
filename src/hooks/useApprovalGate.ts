import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentOrgAccountType } from "@/hooks/useCurrentOrgAccountType";

// Colonnes ajoutées par la migration « validation interne » : accès non typé tant que types.ts n'est pas régénéré.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const sbAny = supabase as any;

/** Indique si les demandes de cet utilisateur doivent d'abord être validées par un administrateur de son organisation. */
export function useApprovalGate() {
  const { user } = useAuth();
  const { data: org } = useCurrentOrgAccountType();
  const orgId = org?.orgId ?? null;
  const q = useQuery({
    queryKey: ["approval-gate", orgId, user?.id],
    enabled: !!orgId && !!user?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const [{ data: o }, { data: m }] = await Promise.all([
        sbAny.from("organizations").select("validation_required").eq("id", orgId).maybeSingle(),
        sbAny.from("organization_members").select("member_role").eq("organization_id", orgId).eq("user_id", user!.id).eq("status", "active").maybeSingle(),
      ]);
      const role = (m?.member_role as string | undefined) ?? null;
      return { enabled: !!o?.validation_required, isAdmin: role === "owner" || role === "admin", role };
    },
  });
  const d = q.data;
  return { orgId, required: !!d?.enabled && !d?.isAdmin && !!d?.role, enabled: !!d?.enabled, isAdmin: !!d?.isAdmin, loading: q.isLoading };
}
