import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type OrgAccountType = "b2b_standard" | "flotte";

/**
 * Retourne le account_type de l'organisation "principale" de l'utilisateur pro.
 * Regarde d'abord profiles.organization_id, sinon la 1ère organization_members active.
 * Défaut : "b2b_standard" (compat rétro).
 */
export function useCurrentOrgAccountType() {
  const { user, isAuthenticated } = useAuth();

  return useQuery({
    queryKey: ["current-org-account-type", user?.id],
    enabled: !!user?.id && isAuthenticated,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<{
      orgId: string | null;
      accountType: OrgAccountType;
      logoUrl: string | null;
      name: string | null;
    }> => {
      if (!user?.id) return { orgId: null, accountType: "b2b_standard", logoUrl: null, name: null };

      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id, type_client, societe, nom, prenom")
        .eq("user_id", user.id)
        .maybeSingle();

      let orgId = profile?.organization_id ?? null;

      if (!orgId) {
        const { data: memberships } = await supabase
          .from("organization_members")
          .select("organization_id")
          .eq("user_id", user.id)
          .eq("status", "active")
          .limit(1);
        orgId = memberships?.[0]?.organization_id ?? null;
      }

      // Fallback : pas d'organisation mais un profil "flotte" → on garde le thème Flotte
      // (cas CAT France et autres comptes flotte historiques sans row organizations)
      if (!orgId) {
        const fallbackType: OrgAccountType =
          (profile?.type_client as string | null) === "flotte" ? "flotte" : "b2b_standard";
        const fallbackName =
          profile?.societe ||
          [profile?.prenom, profile?.nom].filter(Boolean).join(" ").trim() ||
          null;
        return { orgId: null, accountType: fallbackType, logoUrl: null, name: fallbackName };

      }

      const { data: org } = await supabase
        .from("organizations")
        .select("account_type, logo_url, legal_name, commercial_name")
        .eq("id", orgId)
        .maybeSingle();

      const accountType = (org?.account_type as OrgAccountType | null) ??
        ((profile?.type_client as string | null) === "flotte" ? "flotte" : "b2b_standard");
      return {
        orgId,
        accountType,
        logoUrl: (org as { logo_url?: string | null } | null)?.logo_url ?? null,
        name: org?.commercial_name ?? org?.legal_name ?? profile?.societe ?? null,
      };
    },
  });
}

