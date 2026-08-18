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
  AlertTriangle,
  UserPlus,
} from "lucide-react";
import { PageHeader, Card, Button, FormField, TextInput, Badge } from "@/components/admin/AdminUI";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TEMPLATES as TEMPLATES_MAP } from "@/lib/email-templates/registry";
import { PushNotificationToggle } from "@/components/PushNotificationToggle";
import { toast } from "sonner";
import { confirmToast } from "@/lib/confirm-toast";
import { RegimeFacturationCard } from "@/components/admin/RegimeFacturationCard";
import { AvisGoogleHistoryCard } from "@/components/admin/AvisGoogleHistoryCard";

const EMAIL_TEMPLATES = Object.entries(TEMPLATES_MAP).map(([name, t]) => ({
  name,
  subject: (t as { subject?: string }).subject ?? null,
}));

export const Route = createFileRoute("/_authenticated/admin/parametres")({
  component: AdminParametres,
});

const ROLES = [
  { key: "super_admin", label: "Super Admin", level: "Système", desc: "Accès total, gestion des admins et permissions système." },
  { key: "admin", label: "Admin", level: "Système", desc: "Gestion opérationnelle complète (clients, missions, finance)." },
  { key: "manager", label: "Manager", level: "Organisation", desc: "Gestion d'une organisation (membres, missions internes)." },
  { key: "convoyeur", label: "Convoyeur", level: "Utilisateur", desc: "Convoyeur indépendant." },
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
          <div className="flex items-center gap-3">
            {savedAt ? (
              <span className="text-xs text-emerald-600 font-medium">Sauvegardé à {savedAt}</span>
            ) : null}
            <PushNotificationToggle />
          </div>
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
          <TabsTrigger value="inscriptions" className="data-[state=active]:bg-pro-bg-soft data-[state=active]:text-pro-accent rounded-lg">
            <UserPlus size={14} className="mr-1.5" /> Inscriptions
          </TabsTrigger>
          <TabsTrigger value="roles" className="data-[state=active]:bg-pro-bg-soft data-[state=active]:text-pro-accent rounded-lg">
            <ShieldCheck size={14} className="mr-1.5" /> Rôles &amp; permissions
          </TabsTrigger>
          <TabsTrigger value="maintenance" className="data-[state=active]:bg-red-50 data-[state=active]:text-red-700 rounded-lg">
            <AlertTriangle size={14} className="mr-1.5" /> Maintenance
          </TabsTrigger>
        </TabsList>

        {/* === ENTREPRISE === */}
        <TabsContent value="entreprise" className="mt-0 space-y-4">
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

          <DevisAcceptationToggleCard />
          <DriverScreenProtectionCard />
          <AvisGoogleCard />
          <AvisGoogleHistoryCard />
        </TabsContent>


        {/* === FACTURATION === */}
        <TabsContent value="facturation" className="mt-0 space-y-4">
          <RegimeFacturationCard />

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

          <FactureMentionCard />
          <RelancesCard />
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
        {/* === INSCRIPTIONS === */}
        <TabsContent value="inscriptions" className="mt-0 space-y-4">
          <RegistrationGateCard />
        </TabsContent>

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

        {/* === MAINTENANCE === */}
        <TabsContent value="maintenance" className="mt-0">
          <ResetOperationalCard />
        </TabsContent>
      </Tabs>

      <p className="text-xs text-pro-muted mt-6 flex items-center gap-1.5">
        <SettingsIcon size={12} /> Le régime de facturation et les taux de TVA sont désormais persistés en base et propagés à toute la plateforme. Les autres paramètres restent locaux.
      </p>
    </div>
  );
}


function ResetOperationalCard() {
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<Record<string, number> | null>(null);
  const REQUIRED = "RESET";

  const run = async () => {
    if (confirmText !== REQUIRED) {
      toast.error(`Tapez exactement "${REQUIRED}" pour confirmer.`);
      return;
    }
    if (!(await confirmToast("Dernière confirmation : effacer toutes les missions, trajets, attributions et l'historique driver ?"))) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("admin_reset_operational_data" as never);
      if (error) throw error;
      setReport(data as Record<string, number>);
      setConfirmText("");
      toast.success("Reset opérationnel effectué.");
    } catch (e) {
      toast.error("Échec du reset", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
          <AlertTriangle size={18} />
        </div>
        <div>
          <h3 className="font-semibold text-pro-text">Reset opérationnel complet</h3>
          <p className="text-sm text-pro-muted mt-1 max-w-2xl">
            Supprime <strong>tous les trajets, missions, attributions, inspections, positions GPS, étapes,
            selfies, signatures, incidents et documents</strong> liés aux missions. Les comptes (clients, convoyeurs),
            les devis, les factures, les leads B2B et les paramètres ne sont <strong>pas touchés</strong>.
          </p>
          <p className="text-xs text-red-600 mt-2 font-medium">⚠️ Action irréversible.</p>
        </div>
      </div>

      <div className="rounded-lg border border-red-200 bg-red-50/40 p-4 space-y-3">
        <FormField label={`Pour confirmer, tapez "${REQUIRED}" ci-dessous`}>
          <TextInput
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
            placeholder={REQUIRED}
          />
        </FormField>
        <div className="flex justify-end">
          <button
            onClick={run}
            disabled={loading || confirmText !== REQUIRED}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <AlertTriangle size={14} />
            {loading ? "Suppression en cours…" : "Lancer le reset opérationnel"}
          </button>
        </div>
      </div>

      {report && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
          <p className="text-sm font-semibold text-emerald-800 mb-2">Lignes supprimées :</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-mono text-emerald-900">
            {Object.entries(report).map(([table, count]) => (
              <div key={table} className="flex justify-between bg-white/60 rounded px-2 py-1">
                <span className="truncate">{table}</span>
                <span className="font-bold">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function FactureMentionCard() {
  const [text, setText] = useState("");
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("app_settings" as never)
        .select("value")
        .eq("key" as never, "facture_mention_default" as never)
        .maybeSingle();
      const v = (data as { value?: { text?: string; active?: boolean } } | null)?.value;
      setText(v?.text ?? "");
      setActive(!!v?.active);
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("app_settings" as never)
      .upsert({ key: "facture_mention_default", value: { text, active } } as never, { onConflict: "key" } as never);
    setSaving(false);
    if (error) toast.error("Échec de l'enregistrement", { description: error.message });
    else toast.success("Mention légale par défaut enregistrée");
  };

  return (
    <Card>
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
          <Receipt size={18} />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-pro-text">Mention légale par défaut sur les factures</h3>
          <p className="text-xs text-pro-muted mt-1">
            Affichée en pied de toutes les factures clients qui n'ont pas d'override.
            Exemple : informations sur l'auto-liquidation, médiation, etc.
          </p>
        </div>
      </div>

      <FormField label="Texte de la mention">
        <textarea
          className="w-full rounded-md border border-pro-border bg-white px-3 py-2 text-sm min-h-[100px] focus:outline-none focus:ring-2 focus:ring-pro-accent/30"
          value={text}
          disabled={loading}
          placeholder="Ex. : En cas de retard de paiement, indemnité forfaitaire de 40 € (art. L441-10 du Code de commerce)."
          onChange={(e) => setText(e.target.value)}
        />
      </FormField>

      <label className="mt-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={active} disabled={loading} onChange={(e) => setActive(e.target.checked)} />
        Afficher cette mention sur les factures
      </label>

      <div className="mt-4 flex justify-end">
        <Button icon={<Save size={14} />} onClick={save} disabled={saving || loading}>
          {saving ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </Card>
  );
}

function RelancesCard() {
  const [autoRelances, setAutoRelances] = useState(true);
  const [autoRetard, setAutoRetard] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("app_settings" as never)
        .select("key, value")
        .in("key" as never, ["factures.auto_relances", "factures.auto_retard"] as never);
      const rows = (data as Array<{ key: string; value: { enabled?: boolean } }> | null) ?? [];
      const r = rows.find((x) => x.key === "factures.auto_relances");
      const t = rows.find((x) => x.key === "factures.auto_retard");
      setAutoRelances(r?.value?.enabled ?? true);
      setAutoRetard(t?.value?.enabled ?? true);
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("app_settings" as never)
      .upsert(
        [
          { key: "factures.auto_relances", value: { enabled: autoRelances } },
          { key: "factures.auto_retard", value: { enabled: autoRetard } },
        ] as never,
        { onConflict: "key" } as never,
      );
    setSaving(false);
    if (error) toast.error("Échec de l'enregistrement", { description: error.message });
    else toast.success("Réglages relances enregistrés");
  };

  return (
    <Card>
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
          <AlertTriangle size={18} />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-pro-text">Relances & retards de factures</h3>
          <p className="text-xs text-pro-muted mt-1">
            Désactive les automatismes pour les clients qui ont leur propre cycle de paiement (plateformes B2B type CCAT, paiement à 60-90j contractuel, etc.).
            Le passage manuel d'un statut depuis la liste des factures reste toujours possible.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <label className="flex items-start justify-between gap-3 p-3 rounded-lg border border-pro-border hover:bg-pro-bg-soft/40 cursor-pointer">
          <div>
            <p className="text-sm font-medium text-pro-text">Relances automatiques par email</p>
            <p className="text-xs text-pro-muted mt-0.5">Envoyer un rappel email aux clients dont la facture dépasse l'échéance.</p>
          </div>
          <input
            type="checkbox"
            checked={autoRelances}
            disabled={loading}
            onChange={(e) => setAutoRelances(e.target.checked)}
            className="mt-1 h-5 w-9 appearance-none rounded-full bg-pro-border checked:bg-emerald-500 transition relative cursor-pointer after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition checked:after:translate-x-4"
          />
        </label>

        <label className="flex items-start justify-between gap-3 p-3 rounded-lg border border-pro-border hover:bg-pro-bg-soft/40 cursor-pointer">
          <div>
            <p className="text-sm font-medium text-pro-text">Passage automatique en "En retard"</p>
            <p className="text-xs text-pro-muted mt-0.5">Marquer automatiquement les factures dont la date d'échéance est dépassée.</p>
          </div>
          <input
            type="checkbox"
            checked={autoRetard}
            disabled={loading}
            onChange={(e) => setAutoRetard(e.target.checked)}
            className="mt-1 h-5 w-9 appearance-none rounded-full bg-pro-border checked:bg-emerald-500 transition relative cursor-pointer after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition checked:after:translate-x-4"
          />
        </label>
      </div>

      <div className="mt-4 flex justify-end">
        <Button icon={<Save size={14} />} onClick={save} disabled={saving || loading}>
          {saving ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>

      <p className="text-[11px] text-pro-muted mt-3">
        Tip : tu peux aussi désactiver les relances pour un client précis depuis sa fiche dans <code>Admin &gt; Clients</code>.
      </p>
    </Card>
  );
}


function AvisGoogleCard() {
  const [url, setUrl] = useState("");
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [delayHours, setDelayHours] = useState(2);
  const [sendToContact, setSendToContact] = useState(true);
  const [channel, setChannel] = useState<"email" | "sms" | "email+sms">("email");
  const [smsFrom, setSmsFrom] = useState("Ligneo");
  const [smsCount, setSmsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "google_review")
        .maybeSingle();
      const v = (data as { value?: { url?: string; auto_enabled?: boolean; delay_hours?: number; send_to_contact?: boolean; channel?: "email" | "sms" | "email+sms"; sms_from?: string } } | null)?.value;
      if (v) {
        setUrl(v.url ?? "");
        setAutoEnabled(!!v.auto_enabled);
        setDelayHours(typeof v.delay_hours === "number" ? v.delay_hours : 2);
        setSendToContact(v.send_to_contact !== false);
        setChannel(v.channel ?? "email");
        setSmsFrom(v.sms_from ?? "Ligneo");
      }
      const month = new Date().toISOString().slice(0, 7);
      const { data: counter } = await supabase.from("app_settings").select("value").eq("key", `sms_sent_${month}`).maybeSingle();
      setSmsCount(typeof counter?.value === "number" ? counter.value : 0);
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("app_settings").upsert(
      {
        key: "google_review",
        value: {
          url: url.trim(),
          auto_enabled: autoEnabled,
          delay_hours: Math.max(0, Number(delayHours) || 0),
          send_to_contact: sendToContact,
          channel,
          sms_from: smsFrom.trim() || "Ligneo",
        } as unknown as never,
      },
      { onConflict: "key" },
    );
    setSaving(false);
    if (error) toast.error("Échec sauvegarde", { description: error.message });
    else toast.success("Paramètres avis Google enregistrés");
  };

  return (
    <Card>
      <h2 className="font-semibold text-pro-text flex items-center gap-2">
        <ExternalLink size={16} className="text-pro-accent" />
        Avis Google
      </h2>
      <p className="text-xs text-pro-muted mt-1">
        Lien de votre fiche Google Business utilisé dans toutes les demandes d'avis envoyées après une mission
        (client et contact livraison).
      </p>

      <div className="mt-4 space-y-3">
        <FormField label="Lien avis Google">
          <TextInput
            value={url}
            disabled={loading}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://g.page/r/.../review"
          />
        </FormField>

        <label className="flex items-center gap-2 text-xs text-pro-text">
          <input
            type="checkbox"
            checked={autoEnabled}
            disabled={loading}
            onChange={(e) => setAutoEnabled(e.target.checked)}
          />
          Envoi automatique après le passage de la mission en « Terminée »
        </label>

        <FormField label="Délai avant envoi automatique (heures)">
          <TextInput
            type="number"
            min={0}
            value={String(delayHours)}
            disabled={loading}
            onChange={(e) => setDelayHours(Number(e.target.value))}
          />
        </FormField>

        <FormField label="Canal de la demande d'avis">
          <select
            value={channel}
            disabled={loading}
            onChange={(e) => setChannel(e.target.value as "email" | "sms" | "email+sms")}
            className="w-full rounded-md border border-pro-border bg-transparent px-2 py-1.5 text-xs text-pro-text outline-none focus:border-pro-accent"
          >
            <option value="email">Email seul</option>
            <option value="sms">SMS seul</option>
            <option value="email+sms">Email + SMS</option>
          </select>
        </FormField>

        {(channel === "sms" || channel === "email+sms") && (
          <FormField label="Expéditeur SMS (nom ou numéro E.164)">
            <TextInput
              value={smsFrom}
              disabled={loading}
              onChange={(e) => setSmsFrom(e.target.value)}
              placeholder="Ligneo"
            />
          </FormField>
        )}

        <label className="flex items-center gap-2 text-xs text-pro-text">
          <input
            type="checkbox"
            checked={sendToContact}
            disabled={loading}
            onChange={(e) => setSendToContact(e.target.checked)}
          />
          Inclure le contact livraison (email et/ou téléphone valides requis)
        </label>

        <div className="rounded-lg border border-pro-border bg-pro-surface px-3 py-2">
          <p className="text-[11px] text-pro-muted">
            SMS envoyés ce mois-ci : <strong className="text-pro-text">{smsCount}</strong>
          </p>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <Button icon={<Save size={14} />} onClick={save} disabled={saving || loading}>
          {saving ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </Card>
  );
}


function DevisAcceptationToggleCard() {
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "devis_acceptation_obligatoire")
        .maybeSingle();
      const v = (data as { value?: unknown } | null)?.value;
      setEnabled(v === true || v === "true");
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "devis_acceptation_obligatoire", value: enabled as unknown as never });
    setSaving(false);
    if (error) toast.error("Échec sauvegarde", { description: error.message });
    else toast.success("Paramètre mis à jour");
  };

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h2 className="font-semibold text-pro-text flex items-center gap-2">
            <ShieldCheck size={16} className="text-pro-accent" />
            Acceptation de devis obligatoire
          </h2>
          <p className="text-xs text-pro-muted mt-1">
            Si activé, chaque client doit accepter explicitement le devis et les CGV (case à cocher horodatée)
            avant la création de la demande de convoyage. Les clients marqués comme "exemptés" dans leur fiche
            peuvent valider directement.
          </p>
        </div>
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            disabled={loading}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-5 w-9 appearance-none rounded-full bg-pro-border checked:bg-emerald-500 transition relative cursor-pointer after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition checked:after:translate-x-4"
          />
          <span className="text-xs font-medium text-pro-text">{enabled ? "Activée" : "Désactivée"}</span>
        </label>
      </div>
      <div className="mt-4 flex justify-end">
        <Button icon={<Save size={14} />} onClick={save} disabled={saving || loading}>
          {saving ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </Card>
  );
}

function DriverScreenProtectionCard() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("app_settings" as never)
        .select("value")
        .eq("key" as never, "driver_screen_protection" as never)
        .maybeSingle();
      const v = (data as { value?: { enabled?: boolean } } | null)?.value;
      setEnabled(!!v?.enabled);
      setLoading(false);
    })();
  }, []);

  const save = async (next: boolean) => {
    setSaving(true);
    const { error } = await supabase
      .from("app_settings" as never)
      .upsert({ key: "driver_screen_protection", value: { enabled: next } } as never, { onConflict: "key" } as never);
    setSaving(false);
    if (error) {
      toast.error("Échec de l'enregistrement", { description: error.message });
      return;
    }
    setEnabled(next);
    toast.success(next ? "Protection anti-capture activée" : "Protection anti-capture désactivée");
  };

  return (
    <Card>
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
          <ShieldCheck size={18} />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-pro-text">Protection anti-capture d'écran (Convoyeur)</h3>
          <p className="text-xs text-pro-muted mt-1 max-w-2xl">
            Applique dans l'app convoyeur : clic droit désactivé, impression et raccourcis de capture bloqués,
            flou automatique du contenu quand l'onglet passe en arrière-plan (heuristique captures iOS/Android).
            Note : aucun site web ne peut réellement empêcher une capture système, il s'agit d'une dissuasion.
          </p>
        </div>
        <label className="flex items-center gap-2 shrink-0">
          <input
            type="checkbox"
            className="w-10 h-6 appearance-none rounded-full bg-pro-border checked:bg-emerald-500 relative cursor-pointer transition-colors
              before:content-[''] before:absolute before:top-0.5 before:left-0.5 before:w-5 before:h-5 before:bg-white before:rounded-full before:transition-transform
              checked:before:translate-x-4 disabled:opacity-50"
            disabled={loading || saving}
            checked={enabled}
            onChange={(e) => save(e.target.checked)}
          />
          <span className="text-xs font-medium text-pro-text">{enabled ? "Activée" : "Désactivée"}</span>
        </label>
      </div>
    </Card>
  );
}
