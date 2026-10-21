import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface DriverIdentity {
  prenom: string;
  nom: string;
  ville: string;
  avatarUrl: string | null;
  initiales: string;
}

/** Identité du convoyeur connecté (nom, ville, photo) pour l'en-tête et le menu Plus. */
export function useDriverIdentity(): DriverIdentity {
  const { user } = useAuth();
  const [id, setId] = useState<DriverIdentity>({ prenom: "", nom: "", ville: "", avatarUrl: null, initiales: "··" });

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("convoyeurs")
        .select("prenom, nom, ville, avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled || !data) return;
      const prenom = data.prenom ?? "";
      const nom = data.nom ?? "";
      setId({
        prenom,
        nom,
        ville: data.ville ?? "",
        avatarUrl: data.avatar_url ?? null,
        initiales: `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase() || "··",
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return id;
}
