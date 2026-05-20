import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import DevisGenerator, { type DevisGeneratorPrefill } from "@/components/DevisGenerator";

export const Route = createFileRoute("/_authenticated/dashboard-pro/devis-instantane")({
  component: ProDevisInstantane,
});

function ProDevisInstantane() {
  const { user } = useAuth();
  const [prefill, setPrefill] = useState<DevisGeneratorPrefill>({});

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("nom, prenom, telephone, email, societe")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setPrefill({
          nom: data?.nom ?? "",
          prenom: data?.prenom ?? "",
          telephone: data?.telephone ?? "",
          email: data?.email ?? user.email ?? "",
          societe: data?.societe ?? "",
        });
      });
    return () => { cancelled = true; };
  }, [user]);

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-pro-text">Devis instantané</h1>
        <p className="text-pro-muted text-sm mt-0.5">
          Estimateur premium — vos coordonnées société sont déjà renseignées.
        </p>
      </div>
      <div className="bg-white rounded-xl border border-pro-border p-6 md:p-8">
        <DevisGenerator
          prefill={prefill}
          hideAccountStep
          successRedirect="/dashboard-pro/missions"
        />
      </div>
    </div>
  );
}
