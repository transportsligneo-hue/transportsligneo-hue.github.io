import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Settings as SettingsIcon,
  Building2,
  Receipt,
  Mail,
  CreditCard,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Save,
} from "lucide-react";
import { PageHeader, Card, Button, FormField, TextInput, Badge } from "@/components/admin/AdminUI";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EMAIL_TEMPLATES } from "@/lib/email-templates/registry";

export const Route = createFileRoute("/_authenticated/admin/parametres")({
  component: AdminParametres,
});

const ROLES = [
  { key: "super_admin", label: "Super Admin", level: "Système", desc: "Accès total, gestion des admins et permissions système." },
  { key: "admin", label: "Admin", level: "Système", desc: "Gestion opérationnelle complète (clients, missions, finance)." },
  { key: "manager", label: "Manager", level: "Organisation", desc: "Gestion d'une organisation (membres, missions internes)." },
  { key: "convoyeur", label: "Convoyeur", level: "Utilisateur", desc: "Convoyeur indépendant ou salarié." },
  { key: "sous_traitant", label: "Sous-traitant", level: "Utilisateur", desc: "Convoyeur externe partenaire." },
  { key: "client", label: "Client", level: "Utilisateur", desc: "Espace client particulier." },
];

const PERMISSION_MATRIX: { label: string; roles: Record<string, boolean> }[] = [
  { label: "Voir tous les utilisateurs", roles: { super_admin: true, admin: true, manager: false, convoyeur: false, sous_traitant: false, client: false } },
  { label: "Suspendre / supprimer un compte", roles: { super_admin: true, admin: true, manager: false, convoyeur: false, sous_traitant: false, client: false } },
  { label: "Gérer les rôles", roles: { super_admin: true, admin: false, manager: false, convoyeur: false, sous_traitant: false, client: false } },
  { label: "Voir les paiements & factures", roles: { super_admin: true, admin: true, manager: false, convoyeur: false, sous_traitant: false, client: false } },
  { label: "Publier / attribuer un trajet", roles: { super_admin: true, admin: true, manager: false, convoyeur: false, sous_traitant: false, client: false } },
  { label: "Accepter une mission", roles: { super_admin: false, admin: false, manager: false, convoyeur: true, sous_traitant: true, client: false } },
  { label: "Réaliser une inspection", roles: { super_admin: false, admin: false, manager: false, convoyeur: true, sous_traitant: true, client: false } },
  { label: "Créer un devis", roles: { super_admin: false, admin: false, manager: false, convoyeur: false, sous_traitant: false, client: true } },
];

interface AppSetting {
  raison_sociale: string;
  adresse: string;
  siret: string;
  tva_intra: string;
  email_contact: string;
  telephone: string;
  tva_taux: string;
  prefix_devis: string;
  prefix_facture: string;
  prefix_mission: string;
  conditions_paiement: string;
  iban: string;
  bic: string;
}

const DEFAULT_SETTINGS: AppSetting = {
  raison_sociale: "Transports Ligneo",
  adresse: "",
  siret: "",
  tva_intra: "",
  email_contact: "contact@transportsligneo.fr",
  telephone: "",
  tva_taux: "20",
  prefix_devis: "DEV-TLG",
  prefix_facture: "FAC-TLG",
  prefix_mission: "MIS-TLG",
  conditions_paiement: "Paiement à 30 jours fin de mois.",
  iban: "",
  bic: "",
};

function AdminParametres() {
  const [tab, setTab] = useState("entreprise");
  const [settings, setSettings] = useState<AppSetting>(DEFAULT_SETTINGS);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("tlg_app_settings");
      if (raw) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
    } catch {}
  }, []);

  const save = () => {
    localStorage.setItem("tlg_app_settings", JSON.stringify(settings));
    setSavedAt(new Date().toLocaleTimeString("fr-FR"));
  };

  const set = <K extends keyof AppSetting>(k: K, v: AppSetting[K]) =>
    setSettings((s) => ({ ...s, [k]: v }));

  return (
    <div>
      <PageHeader
        title="Paramètres"
        subtitle="Configuration globale, facturation, emails, intégrations et rôles."
        actions={
          savedAt ? (
            <span className="text-xs text-emerald-600 font-medium">Sauvegardé à {savedAt}</span>
          ) : null
        }
      />

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="bg-white border border-pro-border rounded-xl p-1 h-auto flex flex-wrap gap-1 mb-6">
          <TabsTrigger value="entreprise" className="data-[state=active]:bg-pro-bg-soft data-[state=active]:text-pro-accent rounded-lg">
            <Building2 size={14} className="mr-1.5" /> Entreprise
          </TabsTrigger>
          <TabsTrigger value="facturation" className="data-[state=active]:bg-pro-bg-soft data-[state=active]:text-pro-accent rounded-lg">
            <Receipt size={14} className="mr-1.5" /> Facturation
          </TabsTrigger>
          <TabsTrigger value="emails" className="data-[state=active]:bg-pro-bg-soft data-[state=active]:text-pro-accent rounded-lg">
            <Mail size={14} className="mr-1.5" /> Templates emails
          </TabsTrigger>
          <TabsTrigger value="stripe" className="data-[state=active]:bg-pro-bg-soft data-[state=active]:text-pro-accent rounded-lg">
            <CreditCard size={14} className="mr-1.5" /> Stripe
          </TabsTrigger>
          <TabsTrigger value="roles" className="data-[state=active]:bg-pro-bg-soft data-[state=active]:text-pro-accent rounded-lg">
            <ShieldCheck size={14} className="mr-1.5" /> Rôles &amp; permissions
          </TabsTrigger>
        </TabsList>

        {/* === ENTREPRISE === */}
        <TabsContent value="entreprise" className="mt-0">
          <Card>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Raison sociale">
                <TextInput value={settings.raison_sociale} onChange={(e) => set("raison_sociale", e.target.value)} />
              </FormField>
              <FormField label="Email de contact">
                <TextInput value={settings.email_contact} onChange={(e) => set("email_contact", e.target.value)} />
              </FormField>
              <FormField label="Téléphone">
                <TextInput value={settings.telephone} onChange={(e) => set("telephone", e.target.value)} />
              </FormField>
              <FormField label="SIRET">
                <TextInput value={settings.siret} onChange={(e) => set("siret", e.target.value)} />
              </FormField>
              <FormField label="N° TVA intracommunautaire">
                <TextInput value={settings.tva_intra} onChange={(e) => set("tva_intra", e.target.value)} />
              </FormField>
              <div className="md:col-span-2">
                <FormField label="Adresse complète">
                  <TextInput value={settings.adresse} onChange={(e) => set("adresse", e.target.value)} />
                </FormField>
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <Button icon={<Save size={14} />} onClick={save}>Enregistrer</Button>
            </div>
          </Card>
        </TabsContent>

        {/* === FACTURATION === */}
        <TabsContent value="facturation" className="mt-0">
          <Card>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField label="TVA appliquée (%)">
                <TextInput type="number" value={settings.tva_taux} onChange={(e) => set("tva_taux", e.target.value)} />
              </FormField>
              <FormField label="Préfixe devis">
                <TextInput value={settings.prefix_devis} onChange={(e) => set("prefix_devis", e.target.value)} />
              </FormField>
              <FormField label="Préfixe facture">
                <TextInput value={settings.prefix_facture} onChange={(e) => set("prefix_facture", e.target.value)} />
              </FormField>
              <FormField label="Préfixe mission">
                <TextInput value={settings.prefix_mission} onChange={(e) => set("prefix_mission", e.target.value)} />
              </FormField>
              <FormField label="IBAN">
                <TextInput value={settings.iban} onChange={(e) => set("iban", e.target.value)} />
              </FormField>
              <FormField label="BIC">
                <TextInput value={settings.bic} onChange={(e) => set("bic", e.target.value)} />
              </FormField>
              <div className="md:col-span-3">
                <FormField label="Conditions de paiement (mention facture)">
                  <TextInput value={settings.conditions_paiement} onChange={(e) => set("conditions_paiement", e.target.value)} />
                </FormField>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-between">
              <p className="text-xs text-pro-muted">
                La numérotation est gérée automatiquement via la séquence DB ({settings.prefix_facture}-AAAA-NNN).
              </p>
              <Button icon={<Save size={14} />} onClick={save}>Enregistrer</Button>
            </div>
          </Card>
        </TabsContent>

        {/* === TEMPLATES EMAILS === */}
        <TabsContent value="emails" className="mt-0">
          <Card padded={false}>
            <div className="px-6 py-4 border-b border-pro-border">
              <h2 className="font-semibold text-pro-text">Templates transactionnels</h2>
              <p className="text-xs text-pro-muted mt-1">
                {EMAIL_TEMPLATES.length} templates enregistrés. Ouvrez un aperçu pour vérifier le rendu HTML.
              </p>
            </div>
            <div className="divide-y divide-pro-border">
              {EMAIL_TEMPLATES.map((t) => (
                <div key={t.name} className="px-6 py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-pro-accent">{t.name}</p>
                    <p className="text-sm text-pro-text mt-0.5 truncate">{t.subject ?? "—"}</p>
                  </div>
                  <a
                    href={`/lovable/email/transactional/preview?template=${encodeURIComponent(t.name)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-pro-accent hover:underline inline-flex items-center gap-1 shrink-0"
                  >
                    Aperçu <ExternalLink size={11} />
                  </a>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* === STRIPE === */}
        <TabsContent value="stripe" className="mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <CreditCard size={18} />
                </div>
                <div>
                  <p className="font-semibold text-pro-text">Stripe Live</p>
                  <p className="text-xs text-pro-muted">Production — paiements réels</p>
                </div>
                <Badge tone="success" icon={<CheckCircle2 size={11} />}>Connecté</Badge>
              </div>
              <p className="text-xs text-pro-muted mb-2">Webhook</p>
              <code className="block text-[11px] bg-pro-bg-soft border border-pro-border rounded px-2 py-1.5 break-all">
                /api/public/devis/webhook
              </code>
            </Card>
            <Card>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <CreditCard size={18} />
                </div>
                <div>
                  <p className="font-semibold text-pro-text">Stripe Sandbox</p>
                  <p className="text-xs text-pro-muted">Test — sans débit réel</p>
                </div>
                <Badge tone="success" icon={<CheckCircle2 size={11} />}>Connecté</Badge>
              </div>
              <p className="text-xs text-pro-muted mb-2">Webhook B2B</p>
              <code className="block text-[11px] bg-pro-bg-soft border border-pro-border rounded px-2 py-1.5 break-all">
                /api/public/b2b/webhook
              </code>
            </Card>
          </div>
        </TabsContent>

        {/* === RÔLES & PERMISSIONS === */}
        <TabsContent value="roles" className="mt-0 space-y-6">
          <Card padded={false}>
            <div className="px-6 py-4 border-b border-pro-border">
              <h2 className="font-semibold text-pro-text">Rôles disponibles</h2>
              <p className="text-xs text-pro-muted mt-1">Hiérarchie d'accès dans la plateforme.</p>
            </div>
            <div className="divide-y divide-pro-border">
              {ROLES.map((r) => (
                <div key={r.key} className="px-6 py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-pro-text">{r.label}</p>
                    <p className="text-xs text-pro-muted mt-0.5">{r.desc}</p>
                  </div>
                  <Badge tone={r.level === "Système" ? "purple" : r.level === "Organisation" ? "info" : "neutral"}>
                    {r.level}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>

          <Card padded={false}>
            <div className="px-6 py-4 border-b border-pro-border">
              <h2 className="font-semibold text-pro-text">Matrice des permissions</h2>
              <p className="text-xs text-pro-muted mt-1">
                Lecture seule — la modification fine sera disponible via la table <code className="font-mono">role_permissions</code>.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-pro-bg-soft/60 border-b border-pro-border">
                  <tr>
                    <th className="text-left py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-pro-text-soft">Action</th>
                    {ROLES.map((r) => (
                      <th key={r.key} className="text-center py-3 px-3 text-[11px] font-semibold uppercase tracking-wider text-pro-text-soft">
                        {r.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PERMISSION_MATRIX.map((row, idx) => (
                    <tr key={idx} className="border-b border-pro-border last:border-0">
                      <td className="py-3 px-4 text-pro-text">{row.label}</td>
                      {ROLES.map((r) => (
                        <td key={r.key} className="text-center py-3 px-3">
                          {row.roles[r.key] ? (
                            <CheckCircle2 className="inline text-emerald-600" size={16} />
                          ) : (
                            <XCircle className="inline text-pro-border" size={16} />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <p className="text-xs text-pro-muted mt-6 flex items-center gap-1.5">
        <SettingsIcon size={12} /> Les paramètres entreprise &amp; facturation sont stockés localement pour l'instant — branchés sur la DB lors d'un prochain incrément.
      </p>
    </div>
  );
}
