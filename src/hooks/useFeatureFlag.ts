import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type FeatureFlagKey = "compte_kilometres";

export const featureFlagQueryKey = (key: FeatureFlagKey) => ["feature-flag", key] as const;

/** Interrupteur global réglé depuis l'admin. Activé par défaut tant que la valeur n'est pas lue. */
export function useFeatureFlag(key: FeatureFlagKey): boolean {
  const { data } = useQuery({
    queryKey: featureFlagQueryKey(key),
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("feature_flags").select("enabled").eq("key", key).maybeSingle();
      return data ? Boolean(data.enabled) : true;
    },
  });
  return data ?? false;
}

/** Routes masquées quand le Compte Kilomètres est désactivé. */
export const isLoyaltyPath = (path: string) => /\/fidelite(\/|$)/.test(path);
