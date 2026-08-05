import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Building2, Save, CheckCircle2, AlertTriangle, Landmark, PenLine } from "lucide-react";
import { PageHeader, Card, Button, FormField, TextInput, Badge } from "@/components/admin/AdminUI";
import { COMPANY_REQUIRED_FIELDS, isCompanyComplete, type CompanyInfo } from "@/lib/doc-branding";

export const Route = createFileRoute("/_authenticated/admin/informations-legales")({
  component: AdminInformationsLegales,
});

type Form = Record<string, string>;

const FIELDS: { key: keyof CompanyInfo; label: string; group: "identite" | "adresse" | "banque" | "signature"; placeholder?: string }[] = [
  { key: "raison_sociale", label: "Raison sociale", group: "identite", placeholder: "Transports Ligneo" },
  { key: "forme_juridique", label: "Forme juridique", group: "identite", placeholder: "SASU" },
  { key: "capital_social", label: "Capital social", group: "identite", placeholder: "10 000 €" },
  { key: "rcs", label: "RCS", group: "identite", placeholder: "Tours 900 000 000" },
  { key: "siret", label: "SIRET", group: "identite", placeholder: "900 000 000 00012" },
  { key: "tva_intra", label: "N° TVA intracommunautaire", group: "identite", placeholder: "FR00900000000" },
  { key: "adresse_ligne1", label: "Adresse du siège", group: "adresse", placeholder: "12 rue ..." },
  { key: "adresse_cp", label: "Code postal", group: "adresse", placeholder: "37000" },
  { key: "adresse_ville", label: "Ville", group: "adresse", placeholder: "Tours" },
  { key: "adresse_pays", label: "Pays", group: "adresse", placeholder: "France" },
  { key: "email_contact", label: "E-mail de contact", group: "adresse", placeholder: "contact@..." },
  { key: "telephone", label: "Téléphone", group: "adresse", placeholder: "07 82 45 61 81" },
  { key: "site_web", label: "Site web", group: "adresse", placeholder: "www.transportsligneo.fr" },
  { key: "banque_nom", label: "Banque", group: "banque" },
  { key: "iban", label: "IBAN", group: "banque", placeholder: "FR76 ..." },
  { key: "bic", label: "BIC", group: "banque" },
  { key: "signataire_nom", label: "Nom du signataire", group: "signature" },
  { key: "signataire_fonction", label: "Fonction du signataire", group: "signature", placeholder: "Fondateur" },
  { key: "assurance_mention", label: "Mention assurance", group: "signature", placeholder: "RC Pro convoyage — assureur, n° police" },
];

function AdminInformationsLegales() {
  const qc = useQueryClient();
  const [form, setForm] = useState<Form>({});
  const [rowId, setRowId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("company_settings").select("*").limit(1).maybeSingle();
      if (error) toast.error("Lecture impossible : " + error.message);
      if (data) {
        setRowId(data.id as string);
        const f: Form = {};
        FIELDS.forEach(({ key }) => {
          f[key as string] = ((data as Record<string, unknown>)[key as string] as string) ?? "";
        });
        setForm(f);
      }
      setLoading(false);
    })();
  }, []);

  const asCompany = form as unknown as CompanyInfo;
  const complete = isCompanyComplete(asCompany);
  const missing = COMPANY_REQUIRED_FIELDS.filter((k) => !(form[k as string] || "").trim());

  const save = async () => {
    setSaving(true);
    const payload: Record<string, string | boolean> = { singleton: true };
    FIELDS.forEach(({ key }) => {
      payload[key as string] = (form[key as string] || "").trim();
    });
    const { error } = rowId
      ? await supabase.from("company_settings").update(payload as never).eq("id", rowId)
      : await supabase.from("company_settings").insert(payload as never);
    setSaving(false);
    if (error) {
      toast.error("Enregistrement impossible : " + error.message);
      return;
    }
    toast.success("Informations légales enregistrées");
    qc.invalidateQueries({ queryKey: ["company-info"] });
    qc.invalidateQueries({ queryKey: ["company-info-full"] });
    if (!rowId) {
      const { data } = await supabase.from("company_settings").select("id").limit(1).maybeSingle();
      if (data) setRowId(data.id as string);
    }
  };

  const group = (g: string) => FIELDS.filter((f) => f.group === g);

  const renderGroup = (title: string, icon: React.ReactNode, g: string) => (
    <Card className="space-y-4">
      <div className="flex items-center gap-2 text-pro-text font-semibold text-sm">
        {icon}
        {title}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {group(g).map(({ key, label, placeholder }) => (
          <FormField key={key as string} label={label} required={COMPANY_REQUIRED_FIELDS.includes(key)}>
            <TextInput
              value={form[key as string] ?? ""}
              placeholder={placeholder}
              maxLength={200}
              onChange={(e) => setForm((p) => ({ ...p, [key as string]: e.target.value }))}
            />
          </FormField>
        ))}
      </div>
    </Card>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Réglages · Facturation"
        title="Informations légales de l'entreprise"
        subtitle="Saisies une seule fois, ces données alimentent tous les documents officiels (devis, factures, attestations, contrats)."
        actions={
          <Button icon={<Save className="w-4 h-4" />} onClick={save} disabled={saving || loading}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        }
      />

      {complete ? (
        <Card className="flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <div className="text-sm text-pro-text">
            Fiche complète — la génération de documents officiels est active.
          </div>
          <Badge tone="success">Complet</Badge>
        </Card>
      ) : (
        <Card className="flex items-start gap-3 border-amber-300 bg-amber-50">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
          <div className="text-sm text-amber-900">
            <p className="font-semibold">Fiche incomplète — génération des devis et factures bloquée.</p>
            <p className="mt-1">Champs manquants : {missing.join(", ")}</p>
          </div>
        </Card>
      )}

      {renderGroup("Identité de la société", <Building2 className="w-4 h-4 text-pro-accent" />, "identite")}
      {renderGroup("Siège et contacts", <Building2 className="w-4 h-4 text-pro-accent" />, "adresse")}
      {renderGroup("Coordonnées bancaires (factures)", <Landmark className="w-4 h-4 text-pro-accent" />, "banque")}
      {renderGroup("Signature et assurance", <PenLine className="w-4 h-4 text-pro-accent" />, "signature")}
    </div>
  );
}
