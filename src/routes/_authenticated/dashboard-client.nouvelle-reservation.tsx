import { createFileRoute } from "@tanstack/react-router";
import ClientPageHeader from "@/components/dashboard/ClientPageHeader";
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
      <ClientPageHeader
        breadcrumb="Nouvelle réservation"
        eyebrow="Devis instantané"
        title="Nouvelle"
        highlight="réservation"
        subtitle="Estimateur en ligne — vos coordonnées sont déjà renseignées."
      />
      {/* Pas de wrapper card-premium : le DevisGenerator a son propre fond navy
          et le wrapping écrasait le contraste sur le shell client lumineux. */}
      <DevisGenerator
        prefill={prefill}
        hideAccountStep
        successRedirect="/dashboard-client/devis"
      />
    </div>
  );
}
