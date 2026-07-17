import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrgLogo } from "@/components/OrgLogo";
import { OrgLogoUploader } from "@/components/OrgLogoUploader";

export const Route = createFileRoute("/_authenticated/entreprise/societe")({
  component: EntrepriseSociete,
});

interface OrgInfo {
  id: string;
  legal_name: string;
  commercial_name: string | null;
  logo_url: string | null;
  account_type: string | null;
  siret: string | null;
  vat_number: string | null;
  sector: string | null;
  size: string | null;
  website: string | null;
  billing_address: string | null;
  billing_email: string | null;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  primary_contact_phone: string | null;
}

function EntrepriseSociete() {
  const { user } = useAuth();
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [canEditLogo, setCanEditLogo] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: mem } = await supabase
        .from("organization_members")
        .select("organization_id, member_role")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      if (!mem) {
        setLoading(false);
        return;
      }
      setCanEditLogo(mem.member_role === "owner" || mem.member_role === "admin");
      const { data } = await supabase
        .from("organizations")
        .select(
          "id, legal_name, commercial_name, logo_url, account_type, siret, vat_number, sector, size, website, billing_address, billing_email, primary_contact_name, primary_contact_email, primary_contact_phone" as never,
        )
        .eq("id", mem.organization_id)
        .maybeSingle();
      setOrg(data as unknown as OrgInfo | null);
      setLoading(false);
    })();
  }, [user]);

  if (loading) return <p className="text-pro-muted">Chargement…</p>;
  if (!org) return <p className="text-pro-muted">Aucune organisation rattachée.</p>;

  const fields: Array<[string, string | null | undefined]> = [
    ["Raison sociale", org.legal_name],
    ["Nom commercial", org.commercial_name],
    ["SIRET", org.siret],
    ["N° TVA", org.vat_number],
    ["Secteur", org.sector],
    ["Taille", org.size],
    ["Site web", org.website],
    ["Adresse de facturation", org.billing_address],
    ["Email de facturation", org.billing_email],
    ["Contact principal", org.primary_contact_name],
    ["Email contact", org.primary_contact_email],
    ["Téléphone contact", org.primary_contact_phone],
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <OrgLogo name={org.legal_name} url={org.logo_url} size={56} />
        <div>
          <h1 className="text-2xl font-semibold text-pro-text">{org.legal_name}</h1>
          <p className="text-sm text-pro-muted mt-1">
            {org.account_type === "flotte" ? "Compte Flotte" : "Compte B2B"} · Coordonnées et informations légales.
          </p>
        </div>
      </div>

      {canEditLogo && (
        <OrgLogoUploader
          organizationId={org.id}
          organizationName={org.legal_name}
          value={org.logo_url}
          onChange={(url) => setOrg({ ...org, logo_url: url })}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informations</CardTitle>
        </CardHeader>
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
      <p className="text-xs text-pro-muted">
        Pour modifier les informations légales, contactez votre responsable Ligneo.
      </p>
    </div>
  );
}
