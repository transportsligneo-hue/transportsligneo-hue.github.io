import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft,
  Ban,
  CheckCircle,
  Mail,
  Phone,
  Building2,
  MapPin,
  Calendar,
  Receipt,
  Truck,
  AlertTriangle,
  Loader2,
  Save,
  Send,
  KeyRound,
  AtSign,
} from "lucide-react";
import {
  AdminPageHeader,
  AdminSection,
  AdminField,
  AdminBadge,
  AdminStatCard,
  AdminEmpty,
} from "@/components/admin/ui";
import { LogoUploader } from "@/components/LogoUploader";
import { ClientLogo } from "@/components/admin/ClientLogo";
import { AdminAvatarUploader } from "@/components/admin/AdminAvatarUploader";
import { ClientPricingRulesBlock } from "@/components/admin/ClientPricingRulesBlock";
import { ClientDefaultAddressesBlock } from "@/components/admin/ClientDefaultAddressesBlock";
import { AdminOrgContextBanner, type OrgContextKind } from "@/components/admin/AdminOrgContextBanner";
import { toast } from "sonner";
import { confirmToast } from "@/lib/confirm-toast";


export const Route = createFileRoute("/_authenticated/admin/clients/$clientId")({
  component: AdminClientDetail,
});

interface Profile {
  user_id: string;
  prenom: string | null;
  nom: string | null;
  email: string | null;
  telephone: string | null;
  societe: string | null;
  siret: string | null;
  tva_intra: string | null;
  adresse: string | null;
  adresse_facturation: string | null;
  type_client: string | null;
  statut: string | null;
  logo_url: string | null;
  avatar_url: string | null;
  created_at: string;
  pricing_display_mode: string | null;
  tva_exemption_note: string | null;
  facture_mention_legale: string | null;
  facture_mention_active: boolean | null;
  relances_disabled: boolean | null;
  exempte_acceptation_devis: boolean | null;
  vin_obligatoire?: boolean | null;
}

interface MissionItem {
  id: string;
  numero: string | null;
  ville_depart: string | null;
  ville_arrivee: string | null;
  date_prise_en_charge: string | null;
  statut: string;
  prix_total: number | null;
}

interface DevisItem {
  id: string;
  numero: string | null;
  depart: string | null;
  arrivee: string | null;
  prix_estime: number | null;
  statut: string;
  created_at: string;
}

interface FactureItem {
  id: string;
  numero: string | null;
  montant_ttc: number | null;
  statut: string;
  created_at: string;
}

interface AccountStatus {
  email_confirmed_at: string | null;
  invited_at: string | null;
  last_sign_in_at: string | null;
}

type Editable = {
  prenom: string;
  nom: string;
  telephone: string;
  societe: string;
  siret: string;
  tva_intra: string;
  adresse: string;
  adresse_facturation: string;
  type_client: string;
  pricing_display_mode: string;
  tva_exemption_note: string;
  facture_mention_legale: string;
  facture_mention_active: boolean;
  relances_disabled: boolean;
  exempte_acceptation_devis: boolean;
  vin_obligatoire: boolean;
};

const EMPTY: Editable = {
  prenom: "",
  nom: "",
  telephone: "",
  societe: "",
  siret: "",
  tva_intra: "",
  adresse: "",
  adresse_facturation: "",
  type_client: "particulier",
  pricing_display_mode: "ttc",
  tva_exemption_note: "",
  facture_mention_legale: "",
  facture_mention_active: false,
  relances_disabled: false,
  exempte_acceptation_devis: false,
  vin_obligatoire: false,
};

function AdminClientDetail() {
  const { clientId } = Route.useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [actif, setActif] = useState(true);
  const [missions, setMissions] = useState<MissionItem[]>([]);
  const [devisList, setDevisList] = useState<DevisItem[]>([]);
  const [factures, setFactures] = useState<FactureItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Editable>(EMPTY);
  const [original, setOriginal] = useState<Editable>(EMPTY);
  const [status, setStatus] = useState<AccountStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: p }, { data: role }, { data: m }, { data: d }, { data: f }] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", clientId).maybeSingle(),
      supabase
        .from("user_roles")
        .select("actif")
        .eq("user_id", clientId)
        .eq("role", "client")
        .maybeSingle(),
      supabase
        .from("missions")
        .select("id, numero, ville_depart, ville_arrivee, date_prise_en_charge, statut, prix_total")
        .eq("user_id", clientId)
        .order("date_prise_en_charge", { ascending: false })
        .limit(100),
      supabase
        .from("devis")
        .select("id, numero, depart, arrivee, prix_estime, statut, created_at")
        .eq("user_id", clientId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("factures")
        .select("id, numero, montant_ttc, statut, created_at, client_email")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
    const prof = p as Profile | null;
    setProfile(prof);
    setActif((role as { actif?: boolean } | null)?.actif ?? true);
    setMissions((m as MissionItem[]) ?? []);
    setDevisList((d as DevisItem[] | null) ?? []);
    const factRows = (f as (FactureItem & { client_email?: string | null })[] | null) ?? [];
    const clientEmailLc = (prof?.email ?? "").toLowerCase();
    setFactures(
      clientEmailLc
        ? factRows.filter((row) => (row.client_email ?? "").toLowerCase() === clientEmailLc)
        : [],
    );
    if (prof) {
      const init: Editable = {
        prenom: prof.prenom ?? "",
        nom: prof.nom ?? "",
        telephone: prof.telephone ?? "",
        societe: prof.societe ?? "",
        siret: prof.siret ?? "",
        tva_intra: prof.tva_intra ?? "",
        adresse: prof.adresse ?? "",
        adresse_facturation: prof.adresse_facturation ?? "",
        type_client: prof.type_client ?? "particulier",
        pricing_display_mode: prof.pricing_display_mode ?? (prof.type_client === "b2b" || prof.type_client === "flotte" ? "ht" : "ttc"),
        tva_exemption_note: prof.tva_exemption_note ?? "",
        facture_mention_legale: prof.facture_mention_legale ?? "",
        facture_mention_active: !!prof.facture_mention_active,
        relances_disabled: !!prof.relances_disabled,
        exempte_acceptation_devis: !!prof.exempte_acceptation_devis,
        vin_obligatoire: !!prof.vin_obligatoire,
      };
      setForm(init);
      setOriginal(init);
    }

    // Status auth
    try {
      const { data: s } = await supabase.functions.invoke("admin-user-actions", {
        body: { action: "get_account_status", user_id: clientId },
      });
      if (s && !s.error) {
        setStatus({
          email_confirmed_at: s.email_confirmed_at ?? null,
          invited_at: s.invited_at ?? null,
          last_sign_in_at: s.last_sign_in_at ?? null,
        });
      }
    } catch { /* ignore */ }

    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash !== "#tarifs") return;

    const scrollToPricing = () => {
      const target = document.getElementById("tarifs");
      if (!target) return false;
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      return true;
    };

    if (scrollToPricing()) return;

    const timeout = window.setTimeout(() => {
      scrollToPricing();
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [profile?.email]);

  const toggleActif = async () => {
    const next = !actif;
    if (!next && !(await confirmToast("Suspendre ce client ? Il ne pourra plus se connecter."))) return;
    await supabase
      .from("user_roles")
      .update({ actif: next })
      .eq("user_id", clientId)
      .eq("role", "client");
    setActif(next);
  };

  const dirty = JSON.stringify(form) !== JSON.stringify(original);

  const saveProfile = async () => {
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("admin-user-actions", {
      body: { action: "update_profile", user_id: clientId, profile: form },
    });
    setSaving(false);
    if (error || data?.error) {
      toast.error(data?.error ?? "Erreur lors de la sauvegarde");
      return;
    }
    toast.success("Profil mis à jour");
    setOriginal(form);
    load();
  };

  const changeEmail = async () => {
    const newEmail = window.prompt(
      "Nouvel email du client (sera confirmé automatiquement) :",
      profile?.email ?? "",
    );
    if (!newEmail || newEmail === profile?.email) return;
    if (!(await confirmToast(`Changer l'email pour ${newEmail} ?\nLe client devra utiliser cet email pour se connecter.`))) return;
    setBusy("email");
    const { data, error } = await supabase.functions.invoke("admin-user-actions", {
      body: { action: "change_email", user_id: clientId, email: newEmail },
    });
    setBusy(null);
    if (error || data?.error) {
      toast.error(data?.error ?? "Erreur");
      return;
    }
    toast.success("Email modifié");
    load();
  };

  const sendInvite = async () => {
    if (!profile?.email) return;
    setBusy("invite");
    const { data, error } = await supabase.functions.invoke("admin-user-actions", {
      body: {
        action: "invite_account",
        user_id: clientId,
        email: profile.email,
        redirect_to: `${window.location.origin}/dashboard-client`,
      },
    });
    setBusy(null);
    if (error || data?.error) {
      toast.error(data?.error ?? "Erreur");
      return;
    }
    toast.success("Invitation envoyée");
    load();
  };

  const sendReset = async () => {
    setBusy("reset");
    const { data, error } = await supabase.functions.invoke("admin-user-actions", {
      body: {
        action: "reset_password",
        user_id: clientId,
        redirect_to: `${window.location.origin}/reset-password`,
      },
    });
    setBusy(null);
    if (error || data?.error) {
      toast.error(data?.error ?? "Erreur");
      return;
    }
    toast.success("Email de réinitialisation envoyé");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-[color:var(--admin-accent)]" size={28} />
      </div>
    );
  }

  if (!profile) {
    return (
      <div>
        <button
          onClick={() => navigate({ to: "/admin/clients" })}
          className="admin-btn-ghost inline-flex items-center gap-2 mb-4"
        >
          <ArrowLeft size={14} /> Retour
        </button>
        <AdminEmpty title="Client introuvable" description="Ce profil n'existe pas ou a été supprimé." />
      </div>
    );
  }

  const fullName = `${profile.prenom ?? ""} ${profile.nom ?? ""}`.trim() || "Client";
  const totalCA = missions.reduce((s, m) => s + (m.prix_total ?? 0), 0);
  const termineCount = missions.filter((m) => ["terminee", "livree"].includes(m.statut)).length;
  const enCoursCount = missions.filter((m) => ["en_cours", "confirmee", "en_attente"].includes(m.statut)).length;
  const isB2B = (form.type_client === "b2b" || form.type_client === "flotte") || !!form.societe;

  const accountState = (() => {
    if (!status) return { label: "—", tone: "neutral" as const };
    if (status.email_confirmed_at) return { label: "Email vérifié", tone: "success" as const };
    if (status.invited_at) return { label: "Invité (en attente)", tone: "warning" as const };
    return { label: "Compte non vérifié", tone: "warning" as const };
  })();

  const inp = "w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--admin-accent)]/30";

  return (
    <div className="space-y-6">
      <AdminPageHeader
        breadcrumb={[
          { label: "Admin", to: "/admin" },
          { label: "Clients", to: "/admin/clients" },
          { label: fullName },
        ]}
        eyebrow={isB2B ? "Client professionnel" : "Client particulier"}
        title={fullName}
        subtitle={profile.email ?? undefined}
        logo={
          <ClientLogo
            src={profile.logo_url}
            name={isB2B && form.societe ? form.societe : fullName}
            isCompany={isB2B}
            kind={profile.type_client === "flotte" ? "flotte" : isB2B ? "b2b" : "particulier"}
            size="lg"
          />
        }
        status={
          <div className="flex flex-wrap items-center gap-2">
            <AdminBadge label={actif ? "Actif" : "Suspendu"} tone={actif ? "success" : "danger"} />
            <AdminBadge label={accountState.label} tone={accountState.tone} />
            {isB2B && form.societe && <AdminBadge label={form.societe} tone="accent" />}
          </div>
        }
        actions={
          <>
            <Link to="/admin/clients" className="admin-btn-ghost inline-flex items-center gap-2">
              <ArrowLeft size={14} /> Retour
            </Link>
            <button
              onClick={toggleActif}
              className={`admin-btn-ghost inline-flex items-center gap-2 ${
                actif ? "!text-red-600 hover:!bg-red-50 hover:!border-red-200" : "!text-emerald-700 hover:!bg-emerald-50"
              }`}
            >
              {actif ? <Ban size={14} /> : <CheckCircle size={14} />}
              {actif ? "Suspendre" : "Réactiver"}
            </button>
          </>
        }
      />

      <AdminOrgContextBanner
        clientId={profile.user_id}
        name={fullName}
        kind={
          (form.type_client === "flotte"
            ? "flotte"
            : form.type_client === "b2b" || !!form.societe
              ? "b2b"
              : "particulier") as OrgContextKind
        }
        email={profile.email}
        phone={profile.telephone}
        logoUrl={profile.logo_url}
        societe={form.societe || null}
      />


      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminStatCard label="Missions totales" value={missions.length} icon={Truck} />
        <AdminStatCard label="Terminées" value={termineCount} icon={CheckCircle} accent="success" />
        <AdminStatCard label="En cours" value={enCoursCount} icon={AlertTriangle} accent="info" />
        <AdminStatCard
          label="CA cumulé TTC"
          value={`${totalCA.toLocaleString("fr-FR")} €`}
          icon={Receipt}
          accent="warning"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Coordonnées éditables */}
        <AdminSection
          title="Coordonnées"
          description="Modifiez les champs puis enregistrez."
        >
          <div className="space-y-4">
            <AdminField label="Photo de profil">
              <AdminAvatarUploader
                ownerUserId={profile.user_id}
                value={profile.avatar_url}
                onChange={(url) => setProfile({ ...profile, avatar_url: url })}
              />
            </AdminField>
            <div className="grid grid-cols-2 gap-3">
              <AdminField label="Prénom">
                <input className={inp} value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} />
              </AdminField>
              <AdminField label="Nom">
                <input className={inp} value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
              </AdminField>
            </div>
            <AdminField label="Email (connexion)">
              <div className="flex items-center gap-2">
                <input className={`${inp} bg-slate-50`} value={profile.email ?? ""} readOnly />
                <button
                  onClick={changeEmail}
                  disabled={busy === "email"}
                  className="admin-btn-ghost inline-flex items-center gap-1.5 whitespace-nowrap"
                  title="Modifier l'email"
                >
                  {busy === "email" ? <Loader2 className="animate-spin" size={14} /> : <AtSign size={14} />}
                  Modifier
                </button>
              </div>
            </AdminField>
            <AdminField label="Téléphone">
              <input className={inp} value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} />
            </AdminField>
            <AdminField label="Type de client">
              <select className={inp} value={form.type_client} onChange={(e) => setForm({ ...form, type_client: e.target.value })}>
                <option value="particulier">Particulier</option>
                <option value="b2b">B2B</option>
                <option value="flotte">Flotte</option>
              </select>
            </AdminField>
            <AdminField label="Société">
              <input className={inp} value={form.societe} onChange={(e) => setForm({ ...form, societe: e.target.value })} />
            </AdminField>
            <AdminField label="Logo entreprise">
              <LogoUploader
                ownerUserId={clientId}
                value={profile.logo_url}
                onChange={async (url) => {
                  await supabase.functions.invoke("admin-user-actions", {
                    body: { action: "update_profile", user_id: clientId, profile: { logo_url: url } },
                  });
                  setProfile({ ...profile, logo_url: url });
                }}
                variant="light"
                label="Logo de l'entreprise"
              />
            </AdminField>
            <div className="grid grid-cols-2 gap-3">
              <AdminField label="SIRET">
                <input className={inp} value={form.siret} onChange={(e) => setForm({ ...form, siret: e.target.value })} />
              </AdminField>
              <AdminField label="TVA intra.">
                <input className={inp} value={form.tva_intra} onChange={(e) => setForm({ ...form, tva_intra: e.target.value })} />
              </AdminField>
            </div>
            <AdminField label="Adresse">
              <input className={inp} value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })} />
            </AdminField>
            <AdminField label="Adresse de facturation">
              <input className={inp} value={form.adresse_facturation} onChange={(e) => setForm({ ...form, adresse_facturation: e.target.value })} />
            </AdminField>
            <AdminField label="Inscrit le">
              <span className="inline-flex items-center gap-1.5 text-sm">
                <Calendar size={14} className="text-slate-400" />
                {new Date(profile.created_at).toLocaleDateString("fr-FR")}
              </span>
            </AdminField>

            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={saveProfile}
                disabled={!dirty || saving}
                className="admin-btn-primary inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                Enregistrer
              </button>
              {dirty && (
                <button onClick={() => setForm(original)} className="admin-btn-ghost">
                  Annuler
                </button>
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-2">
              <div className="text-xs uppercase tracking-wider text-[color:var(--admin-muted)] font-medium">
                Accès compte
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={sendInvite} disabled={busy === "invite"} className="admin-btn-ghost inline-flex items-center gap-1.5">
                  {busy === "invite" ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}
                  {status?.invited_at && !status?.email_confirmed_at ? "Renvoyer l'invitation" : "Envoyer une invitation"}
                </button>
                <button onClick={sendReset} disabled={busy === "reset"} className="admin-btn-ghost inline-flex items-center gap-1.5">
                  {busy === "reset" ? <Loader2 className="animate-spin" size={14} /> : <KeyRound size={14} />}
                  Réinit. mot de passe
                </button>
              </div>
              {profile.email && (
                <div className="text-xs text-[color:var(--admin-muted)] inline-flex items-center gap-3 flex-wrap">
                  <a className="inline-flex items-center gap-1 hover:underline" href={`mailto:${profile.email}`}>
                    <Mail size={12} /> {profile.email}
                  </a>
                  {profile.telephone && (
                    <a className="inline-flex items-center gap-1 hover:underline" href={`tel:${profile.telephone}`}>
                      <Phone size={12} /> {profile.telephone}
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </AdminSection>

        {/* Configuration tarifaire & fiscale */}
        <AdminSection
          title="Configuration tarifaire & fiscale"
          description="Mode d'affichage des prix, exonération TVA et mention légale propre à ce client."
        >
          <div className="space-y-4">
            <AdminField label="Mode d'affichage des prix">
              <select
                className={inp}
                value={form.pricing_display_mode}
                onChange={(e) => setForm({ ...form, pricing_display_mode: e.target.value })}
              >
                <option value="ttc">TTC (particulier — défaut)</option>
                <option value="ht">HT (pro — TVA ajoutée)</option>
                <option value="exempt">Exonéré de TVA</option>
              </select>
            </AdminField>

            {form.pricing_display_mode === "exempt" && (
              <AdminField label="Mention d'exonération TVA">
                <textarea
                  className={`${inp} min-h-[60px]`}
                  placeholder="TVA non applicable, art. 293 B du CGI"
                  value={form.tva_exemption_note}
                  onChange={(e) => setForm({ ...form, tva_exemption_note: e.target.value })}
                />
              </AdminField>
            )}

            <AdminField label="Mention légale facture (override client)">
              <textarea
                className={`${inp} min-h-[80px]`}
                placeholder="Laisser vide pour utiliser la mention globale définie dans Paramètres."
                value={form.facture_mention_legale}
                onChange={(e) => setForm({ ...form, facture_mention_legale: e.target.value })}
              />
            </AdminField>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.facture_mention_active}
                onChange={(e) => setForm({ ...form, facture_mention_active: e.target.checked })}
              />
              Activer cette mention spécifique au client
            </label>
            <p className="text-xs text-[color:var(--admin-muted)]">
              Si désactivé ou vide, la mention globale (Paramètres → Facturation) sera utilisée.
              N'oubliez pas d'enregistrer le profil après modification.
            </p>

            <div className="mt-4 pt-4 border-t border-slate-200 space-y-3">
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={form.relances_disabled}
                  onChange={(e) => setForm({ ...form, relances_disabled: e.target.checked })}
                />
                <span>
                  <span className="font-medium">Désactiver les relances automatiques</span>
                  <span className="block text-xs text-[color:var(--admin-muted)]">
                    Aucun email de relance ni passage automatique en « En retard » pour ce client.
                    Utile pour les comptes B2B qui paient à échéance fixe (ex&nbsp;: 30 jours).
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={form.exempte_acceptation_devis}
                  onChange={(e) => setForm({ ...form, exempte_acceptation_devis: e.target.checked })}
                />
                <span>
                  <span className="font-medium">Client exempté d'acceptation de devis</span>
                  <span className="block text-xs text-[color:var(--admin-muted)]">
                    Permet à ce client de valider directement ses demandes sans étape
                    d'acceptation devis + CGV. Recommandé pour les clients professionnels,
                    partenaires ou récurrents.
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={form.vin_obligatoire}
                  onChange={(e) => setForm({ ...form, vin_obligatoire: e.target.checked })}
                />
                <span>
                  <span className="font-medium">VIN obligatoire pour ce client</span>
                  <span className="block text-xs text-[color:var(--admin-muted)]">
                    Exige le numéro de série (17 caractères) sur les devis de ce client.
                    Décoché, le VIN reste facultatif.
                  </span>
                </span>
              </label>
            </div>
          </div>
        </AdminSection>



        {/* Historique missions */}
        <div className="lg:col-span-2">
          <AdminSection
            title="Historique missions"
            description={`${missions.length} mission${missions.length > 1 ? "s" : ""}`}
          >
            {missions.length === 0 ? (
              <AdminEmpty icon={Truck} title="Aucune mission" description="Ce client n'a pas encore réservé." />
            ) : (
              <div className="overflow-x-auto -mx-1">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Numéro</th>
                      <th>Trajet</th>
                      <th className="hidden sm:table-cell">Date</th>
                      <th className="hidden md:table-cell">Prix</th>
                      <th>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {missions.map((m) => (
                      <tr key={m.id} className="admin-row-link" onClick={() => navigate({ to: "/admin/missions/$missionId", params: { missionId: m.id } })}>
                        <td className="font-mono text-xs">{m.numero ?? "—"}</td>
                        <td>
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin size={12} className="text-slate-400" />
                            {m.ville_depart ?? "?"} → {m.ville_arrivee ?? "?"}
                          </span>
                        </td>
                        <td className="hidden sm:table-cell text-[color:var(--admin-muted)] text-xs">
                          {m.date_prise_en_charge ? new Date(m.date_prise_en_charge).toLocaleDateString("fr-FR") : "—"}
                        </td>
                        <td className="hidden md:table-cell admin-value">
                          {m.prix_total ? `${m.prix_total.toLocaleString("fr-FR")} €` : "—"}
                        </td>
                        <td>
                          <AdminBadge label={m.statut.replace(/_/g, " ")} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </AdminSection>

          <div className="grid md:grid-cols-2 gap-6 mt-6">
            <AdminSection title="Devis" description={`${devisList.length} devis`}>
              {devisList.length === 0 ? (
                <AdminEmpty icon={Receipt} title="Aucun devis" description="Aucun devis pour ce client." />
              ) : (
                <div className="overflow-x-auto -mx-1">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>N°</th>
                        <th className="hidden sm:table-cell">Trajet</th>
                        <th>Prix</th>
                        <th>Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {devisList.slice(0, 15).map((dv) => (
                        <tr key={dv.id} className="admin-row-link" onClick={() => navigate({ to: "/admin/devis/$devisId", params: { devisId: dv.id } })}>
                          <td className="font-mono text-xs">{dv.numero ?? dv.id.slice(0, 8)}</td>
                          <td className="hidden sm:table-cell text-xs">
                            {dv.depart ?? "?"} → {dv.arrivee ?? "?"}
                          </td>
                          <td className="admin-value">{dv.prix_estime ? `${dv.prix_estime.toLocaleString("fr-FR")} €` : "—"}</td>
                          <td><AdminBadge label={dv.statut.replace(/_/g, " ")} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </AdminSection>

            <AdminSection title="Factures" description={`${factures.length} facture${factures.length > 1 ? "s" : ""}`}>
              {factures.length === 0 ? (
                <AdminEmpty icon={Receipt} title="Aucune facture" description="Aucune facture émise." />
              ) : (
                <div className="overflow-x-auto -mx-1">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>N°</th>
                        <th className="hidden sm:table-cell">Date</th>
                        <th>Montant TTC</th>
                        <th>Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {factures.slice(0, 15).map((fc) => (
                        <tr key={fc.id}>
                          <td className="font-mono text-xs">{fc.numero ?? fc.id.slice(0, 8)}</td>
                          <td className="hidden sm:table-cell text-xs">
                            {new Date(fc.created_at).toLocaleDateString("fr-FR")}
                          </td>
                          <td className="admin-value">{fc.montant_ttc ? `${fc.montant_ttc.toLocaleString("fr-FR")} €` : "—"}</td>
                          <td><AdminBadge label={fc.statut.replace(/_/g, " ")} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </AdminSection>
          </div>

          {profile.email && (
            <div className="mt-6 space-y-6">
              <div id="adresses" className="scroll-mt-24">
                <ClientDefaultAddressesBlock clientUserId={clientId} clientEmail={profile.email} />
              </div>
              <div id="tarifs" className="scroll-mt-24">
                <ClientPricingRulesBlock clientUserId={clientId} clientEmail={profile.email} />
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

