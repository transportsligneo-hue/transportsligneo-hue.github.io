import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import DevisGenerator, { type DevisGeneratorPrefill } from "@/components/DevisGenerator";

export const Route = createFileRoute("/_authenticated/dashboard-client/nouvelle-reservation")({
  component: NouvelleReservation,
});

function NouvelleReservation() {
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
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl text-primary tracking-[0.1em] uppercase">Devis instantané</h1>
        <p className="text-cream/50 text-sm mt-1">
          Estimateur premium — vos coordonnées sont déjà renseignées.
        </p>
      </div>
      <div className="card-premium rounded p-6 md:p-8">
        <DevisGenerator
          prefill={prefill}
          hideAccountStep
          successRedirect="/dashboard-client/devis"
        />
      </div>
    </div>
  );
}
