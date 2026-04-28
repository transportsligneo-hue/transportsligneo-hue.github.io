import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/flotte/societe")({
  component: FlotteSociete,
});

interface OrgInfo {
  legal_name: string;
  commercial_name: string | null;
  siret: string | null;
  vat_number: string | null;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  primary_contact_phone: string | null;
  billing_address: string | null;
}

function FlotteSociete() {
  const { user } = useAuth();
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: mem } = await supabase
        .from("organization_members").select("organization_id")
        .eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle();
      if (!mem) { setLoading(false); return; }
      const { data } = await supabase
        .from("organizations")
        .select("legal_name, commercial_name, siret, vat_number, primary_contact_name, primary_contact_email, primary_contact_phone, billing_address")
        .eq("id", mem.organization_id).maybeSingle();
      setOrg(data as OrgInfo | null);
      setLoading(false);
    })();
  }, [user]);

  if (loading) return <p className="text-pro-muted">Chargement…</p>;
  if (!org) return <p className="text-pro-muted">Aucune flotte rattachée.</p>;

  const fields: Array<[string, string | null]> = [
    ["Raison sociale", org.legal_name],
    ["Nom commercial", org.commercial_name],
    ["SIRET", org.siret],
    ["N° TVA", org.vat_number],
    ["Contact principal", org.primary_contact_name],
    ["Email", org.primary_contact_email],
    ["Téléphone", org.primary_contact_phone],
    ["Adresse", org.billing_address],
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-pro-text">Ma flotte</h1>
        <p className="text-sm text-pro-muted mt-1">Informations de votre flotte partenaire.</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Informations</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
            {fields.map(([label, val]) => (
              <div key={label}>
                <dt className="text-xs uppercase tracking-wider text-pro-muted">{label}</dt>
                <dd className="text-sm text-pro-text mt-1">{val || "—"}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
