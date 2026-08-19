import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { DriverAvatar } from "@/components/admin/DriverAvatar";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Calendar,
  FileBadge,
  Truck,
  Loader2,
  Save,
  AtSign,
  KeyRound,
  Send,
  Ban,
  Euro,
  Activity,
  CalendarDays,
  User,
  Megaphone,
  Wallet,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ConvoyeurFinancesPanel } from "@/components/admin/finances/ConvoyeurFinancesPanel";
import { humanizeAction } from "@/lib/activity-humanizer";
import {
  AdminPageHeader,
  AdminSection,
  AdminField,
  AdminBadge,
  AdminStatCard,
  AdminEmpty,
} from "@/components/admin/ui";
import { sendTransactionalEmail } from "@/lib/email/send";
import { toast } from "sonner";
import { confirmToast } from "@/lib/confirm-toast";
import { DocumentsValidationCenter } from "@/components/admin/convoyeur/DocumentsValidationCenter";
import ContratYousignCard from "@/components/admin/ContratYousignCard";
import { StatutConvoyeurBadge, resolveStatutConvoyeur } from "@/components/admin/StatutConvoyeurBadge";
import { AdminManualCommunication } from "@/components/admin/AdminManualCommunication";
import {
  getConvoyeurDocLabel,
  getRequiredConvoyeurDocTypes,
  isConvoyeurDocApproved,
  normalizeConvoyeurDocType,
} from "@/lib/convoyeur-documents";

export const Route = createFileRoute("/_authenticated/admin/convoyeurs/$convoyeurId")({
  component: AdminConvoyeurDetail,
});

interface Convoyeur {
  id: string;
  user_id: string;
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  ville: string | null;
  disponibilite: string | null;
  permis: string | null;
  message: string | null;
  statut: string;
  type_convoyeur: string;
  created_at: string;
  account_status?: string | null;
  has_completed_training?: boolean | null;
  training_status?: string | null;
}

interface DocItem {
  id: string;
  type_document: string;
  statut_validation: string | null;
  created_at: string;
}

interface AttribItem {
  id: string;
  statut: string;
  created_at: string;
  trajet: { depart: string; arrivee: string; date_trajet: string | null; tarif_convoyeur: number | null } | null;
}

interface AccountStatus {
  email_confirmed_at: string | null;
  invited_at: string | null;
  last_sign_in_at: string | null;
}

interface DispoRow { id: string; date_dispo: string; statut: string; notes: string | null; }
interface LogRow { id: string; action: string; entity_type: string; created_at: string; metadata: Record<string, unknown> | null; actor_label: string | null; }

type Editable = {
  prenom: string;
  nom: string;
  telephone: string;
  ville: string;
  disponibilite: string;
  permis: string;
  message: string;
};

const EMPTY: Editable = {
  prenom: "", nom: "", telephone: "", ville: "", disponibilite: "", permis: "", message: "",
};

const statutLabels: Record<string, string> = {
  en_attente: "En attente",
  valide: "Validé",
  refuse: "Refusé",
  suspendu: "Suspendu",
};
function AdminConvoyeurDetail() {
  const { convoyeurId } = Route.useParams();
  const navigate = useNavigate();
  const [conv, setConv] = useState<Convoyeur | null>(null);
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [attribs, setAttribs] = useState<AttribItem[]>([]);
  const [dispos, setDispos] = useState<DispoRow[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Editable>(EMPTY);
  const [original, setOriginal] = useState<Editable>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [bypassValidation, setBypassValidation] = useState(false);
  const [status, setStatus] = useState<AccountStatus | null>(null);
  const [neighborNav, setNeighborNav] = useState<{
    previous?: { id: string; label: string };
    next?: { id: string; label: string };
  }>({});

  const load = useCallback(async () => {
    setLoading(true);
    const { data: c } = await supabase.from("convoyeurs").select("*").eq("id", convoyeurId).maybeSingle();
    const cv = c as Convoyeur | null;
    setConv(cv);
    if (cv) {
      const init: Editable = {
        prenom: cv.prenom ?? "",
        nom: cv.nom ?? "",
        telephone: cv.telephone ?? "",
        ville: cv.ville ?? "",
        disponibilite: cv.disponibilite ?? "",
        permis: cv.permis ?? "",
        message: cv.message ?? "",
      };
      setForm(init);
      setOriginal(init);

      const today = new Date().toISOString().slice(0, 10);
      const [{ data: d }, { data: a }, { data: dispo }, { data: lg }, { data: navRows }] = await Promise.all([
        supabase
          .from("documents_convoyeurs")
          .select("id, type_document, statut_validation, created_at")
          .eq("convoyeur_id", convoyeurId),
        supabase
          .from("attributions")
          .select("id, statut, created_at, trajet:trajets(depart, arrivee, date_trajet, tarif_convoyeur)")
          .eq("convoyeur_id", convoyeurId)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("disponibilites_convoyeurs")
          .select("id, date_dispo, statut, notes")
          .eq("convoyeur_id", convoyeurId)
          .gte("date_dispo", today)
          .order("date_dispo", { ascending: true })
          .limit(60),
        cv.user_id
          ? supabase
              .from("activity_logs")
              .select("id, action, entity_type, created_at, metadata, actor_label")
              .or(`actor_user_id.eq.${cv.user_id},entity_id.eq.${convoyeurId}`)
              .order("created_at", { ascending: false })
              .limit(30)
          : Promise.resolve({ data: [] as LogRow[] }),
        supabase
          .from("convoyeurs")
          .select("id, prenom, nom")
          .order("created_at", { ascending: false })
          .limit(500),
      ]);
      setDocs((d as DocItem[]) ?? []);
      setAttribs((a as unknown as AttribItem[]) ?? []);
      setDispos((dispo as DispoRow[]) ?? []);
      setLogs((lg as LogRow[]) ?? []);
      const ordered = ((navRows as Array<{ id: string; prenom: string | null; nom: string | null }> | null) ?? [])
        .map((row) => ({ id: row.id, label: `${row.prenom ?? ""} ${row.nom ?? ""}`.trim() || "Convoyeur" }));
      const currentIndex = ordered.findIndex((row) => row.id === convoyeurId);
      setNeighborNav({
        previous: currentIndex > 0 ? ordered[currentIndex - 1] : undefined,
        next: currentIndex >= 0 && currentIndex < ordered.length - 1 ? ordered[currentIndex + 1] : undefined,
      });

      if (cv.user_id) {
        try {
          const { data: s } = await supabase.functions.invoke("admin-user-actions", {
            body: { action: "get_account_status", user_id: cv.user_id },
          });
          if (s && !s.error) {
            setStatus({
              email_confirmed_at: s.email_confirmed_at ?? null,
              invited_at: s.invited_at ?? null,
              last_sign_in_at: s.last_sign_in_at ?? null,
            });
          }
        } catch { /* ignore */ }
      }
    }
    setLoading(false);
  }, [convoyeurId]);

  useEffect(() => {
    load();
  }, [load]);

  const updateStatut = async (statut: string) => {
    if (!conv) return;
    if (statut === "valide") {
      const required = getRequiredConvoyeurDocTypes(conv.type_convoyeur).map((doc) => doc.key);
      const issues = required
        .map((r) => {
          const doc = docs.find((d) => normalizeConvoyeurDocType(d.type_document) === r);
          if (!doc) return `${getConvoyeurDocLabel(r)} manquant`;
          if (!isConvoyeurDocApproved(doc.statut_validation)) return `${getConvoyeurDocLabel(r)} non approuvé`;
          return null;
        })
        .filter(Boolean);
      if (!conv.has_completed_training && conv.training_status !== "completed") {
        issues.push("Formation Académie Ligneo non validée");
      }
      if (issues.length && !bypassValidation) {
        toast.error(`Validation impossible :\n\n• ${issues.join("\n• ")}\n\nActivez le bypass administrateur pour valider malgré ces éléments.`);
        return;
      }
    }
    const wasNotValid = conv.statut !== "valide";
    const updates = statut === "valide" && bypassValidation
      ? { statut, has_completed_training: true, training_status: "completed" }
      : { statut };
    const { error } = await supabase.from("convoyeurs").update(updates).eq("id", conv.id);
    if (error) {
      toast.error(`Mise à jour impossible : ${error.message}`);
      return;
    }
    setConv({ ...conv, ...updates });
    setBypassValidation(false);
    if (statut === "valide" && wasNotValid) {
      try {
        await sendTransactionalEmail({
          templateName: "convoyeur-validation",
          recipientEmail: conv.email,
          idempotencyKey: `convoyeur-validation-${conv.id}`,
          templateData: { prenom: conv.prenom, nom: conv.nom },
        });
      } catch (e) {
        console.error("[admin.convoyeurs.detail] email error", e);
      }
    }
  };

  const dirty = JSON.stringify(form) !== JSON.stringify(original);

  const saveProfile = async () => {
    if (!conv) return;
    setSaving(true);
    const payload = {
      prenom: form.prenom.trim(),
      nom: form.nom.trim(),
      telephone: form.telephone.trim(),
      ville: form.ville.trim() || null,
      disponibilite: form.disponibilite.trim() || null,
      permis: form.permis.trim() || null,
      message: form.message.trim() || null,
    };
    const { error } = await supabase.from("convoyeurs").update(payload).eq("id", conv.id);
    // also sync profile name/phone for unified account view
    if (!error && conv.user_id) {
      await supabase.functions.invoke("admin-user-actions", {
        body: {
          action: "update_profile",
          user_id: conv.user_id,
          profile: { prenom: payload.prenom, nom: payload.nom, telephone: payload.telephone },
        },
      });
    }
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Convoyeur mis à jour");
    setOriginal(form);
    setConv({ ...conv, ...payload });
  };

  const changeEmail = async () => {
    if (!conv?.user_id) {
      toast.error("Aucun compte associé à ce convoyeur");
      return;
    }
    const newEmail = window.prompt("Nouvel email du convoyeur :", conv.email);
    if (!newEmail || newEmail === conv.email) return;
    if (!(await confirmToast(`Changer l'email pour ${newEmail} ?\nLe convoyeur devra utiliser cet email pour se connecter.`))) return;
    setBusy("email");
    const { data, error } = await supabase.functions.invoke("admin-user-actions", {
      body: { action: "change_email", user_id: conv.user_id, email: newEmail },
    });
    if (!error && !data?.error) {
      await supabase.from("convoyeurs").update({ email: newEmail.toLowerCase().trim() }).eq("id", conv.id);
    }
    setBusy(null);
    if (error || data?.error) {
      toast.error(data?.error ?? "Erreur");
      return;
    }
    toast.success("Email modifié");
    load();
  };

  const sendReset = async () => {
    if (!conv?.user_id) return;
    setBusy("reset");
    const { data, error } = await supabase.functions.invoke("admin-user-actions", {
      body: {
        action: "reset_password",
        user_id: conv.user_id,
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

  const sendInvite = async () => {
    if (!conv?.user_id || !conv.email) return;
    setBusy("invite");
    const { data, error } = await supabase.functions.invoke("admin-user-actions", {
      body: {
        action: "invite_account",
        user_id: conv.user_id,
        email: conv.email,
          redirect_to: `${window.location.origin}/reset-password`,
      },
    });
    setBusy(null);
    if (error || data?.error) {
      toast.error(data?.error ?? "Erreur");
      return;
    }
    toast.success(data?.fallback === "reset_password" ? "Lien d'accès envoyé" : "Invitation envoyée");
    load();
  };

  const suspendAccount = async () => {
    if (!conv?.user_id) return;
    if (!(await confirmToast("Suspendre ce convoyeur ? Il ne pourra plus se connecter."))) return;
    setBusy("suspend");
    const { data, error } = await supabase.functions.invoke("admin-user-actions", {
      body: { action: "suspend", user_id: conv.user_id },
    });
    setBusy(null);
    if (error || data?.error) {
      toast.error(data?.error ?? "Erreur");
      return;
    }
    await supabase.from("convoyeurs").update({ statut: "suspendu" }).eq("id", conv.id);
    toast.success("Compte suspendu");
    load();
  };

  const reactivateAccount = async () => {
    if (!conv?.user_id) return;
    setBusy("reactivate");
    const { data, error } = await supabase.functions.invoke("admin-user-actions", {
      body: { action: "reactivate", user_id: conv.user_id },
    });
    setBusy(null);
    if (error || data?.error) {
      toast.error(data?.error ?? "Erreur");
      return;
    }
    toast.success("Compte réactivé");
    load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-[color:var(--admin-accent)]" size={28} />
      </div>
    );
  }

  if (!conv) {
    return (
      <div>
        <button onClick={() => navigate({ to: "/admin/convoyeurs" })} className="admin-btn-ghost inline-flex items-center gap-2 mb-4">
          <ArrowLeft size={14} /> Retour
        </button>
        <AdminEmpty title="Convoyeur introuvable" />
      </div>
    );
  }

  const fullName = `${conv.prenom} ${conv.nom}`.trim();
  const terminees = attribs.filter((a) => ["terminee", "livree"].includes(a.statut)).length;
  const requiredDocs = getRequiredConvoyeurDocTypes(conv.type_convoyeur);
  const docsApprouves = requiredDocs.filter((spec) =>
    docs.some((doc) => normalizeConvoyeurDocType(doc.type_document) === spec.key && isConvoyeurDocApproved(doc.statut_validation)),
  ).length;
  const revenus = attribs
    .filter((a) => ["terminee", "livree"].includes(a.statut))
    .reduce((sum, a) => sum + (a.trajet?.tarif_convoyeur ?? 0), 0);
  const prochainesDispos = dispos.filter((d) => d.statut === "disponible").length;

  const statutUnifie = resolveStatutConvoyeur(conv.statut, docs);

  const accountState = (() => {
    if (!status) return { label: "—", tone: "neutral" as const };
    if (status.email_confirmed_at) return { label: "Email vérifié", tone: "success" as const };
    if (status.invited_at) return { label: "Invité (en attente)", tone: "warning" as const };
    return { label: "Compte non vérifié", tone: "warning" as const };
  })();

  const inp = "w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--admin-accent)]/30";
  const isSuspended = conv.statut === "suspendu";

  return (
    <div className="space-y-6">
      <AdminPageHeader
        breadcrumb={[
          { label: "Admin", to: "/admin" },
          { label: "Convoyeurs", to: "/admin/convoyeurs" },
          { label: fullName },
        ]}
        eyebrow="Convoyeur indépendant"
        title={fullName}
        subtitle={conv.email}
        status={
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <DriverAvatar convoyeurId={conv.id} name={fullName} size="md" />
              <StatutConvoyeurBadge statut={statutUnifie} size="md" />
              <AdminBadge label={accountState.label} tone={accountState.tone} />
              {conv.ville && <AdminBadge label={conv.ville} tone="info" />}
            </div>
            {conv.statut !== "valide" && conv.statut !== "suspendu" && (
              <label className="flex cursor-pointer items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <input
                  type="checkbox"
                  checked={bypassValidation}
                  onChange={(event) => setBypassValidation(event.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[color:var(--admin-accent)]"
                />
                <span>
                  <strong>Bypass administrateur</strong>
                  <span className="block text-amber-700">Valider malgré les documents ou la formation incomplets.</span>
                </span>
              </label>
            )}
          </div>
        }
        actions={
          <>
            <Link to="/admin/convoyeurs" className="admin-btn-ghost inline-flex items-center gap-2">
              <ArrowLeft size={14} /> Retour
            </Link>
            {neighborNav.previous && (
              <Link
                to="/admin/convoyeurs/$convoyeurId"
                params={{ convoyeurId: neighborNav.previous.id }}
                className="admin-btn-ghost inline-flex items-center gap-1.5"
                title={neighborNav.previous.label}
              >
                <ChevronLeft size={14} /> Précédent
              </Link>
            )}
            {neighborNav.next && (
              <Link
                to="/admin/convoyeurs/$convoyeurId"
                params={{ convoyeurId: neighborNav.next.id }}
                className="admin-btn-ghost inline-flex items-center gap-1.5"
                title={neighborNav.next.label}
              >
                Suivant <ChevronRight size={14} />
              </Link>
            )}
            {conv.statut !== "valide" && conv.statut !== "suspendu" && (
              <button onClick={() => updateStatut("valide")} className="admin-btn-primary inline-flex items-center gap-2">
                <CheckCircle size={14} /> Valider
              </button>
            )}
            {conv.statut !== "refuse" && conv.statut !== "valide" && conv.statut !== "suspendu" && (
              <button onClick={() => updateStatut("refuse")} className="admin-btn-ghost inline-flex items-center gap-2 !text-red-600 hover:!bg-red-50 hover:!border-red-200">
                <XCircle size={14} /> Refuser
              </button>
            )}
            {isSuspended ? (
              <button onClick={reactivateAccount} disabled={busy === "reactivate"} className="admin-btn-ghost inline-flex items-center gap-2 !text-emerald-700 hover:!bg-emerald-50">
                {busy === "reactivate" ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />} Réactiver
              </button>
            ) : (
              <button onClick={suspendAccount} disabled={busy === "suspend"} className="admin-btn-ghost inline-flex items-center gap-2 !text-red-600 hover:!bg-red-50 hover:!border-red-200">
                {busy === "suspend" ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />} Suspendre
              </button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <AdminStatCard label="Missions totales" value={attribs.length} icon={Truck} />
        <AdminStatCard label="Terminées" value={terminees} icon={CheckCircle} accent="success" />
        <AdminStatCard
          label="Documents approuvés"
          value={`${docsApprouves} / ${requiredDocs.length}`}
          icon={FileBadge}
          accent={docsApprouves === requiredDocs.length ? "success" : "warning"}
        />
        {conv.type_convoyeur === "independant" && (
          <AdminStatCard label="Revenus générés" value={`${revenus.toFixed(0)} €`} icon={Euro} accent="success" />
        )}
        <AdminStatCard label="Jours dispo (à venir)" value={prochainesDispos} icon={CalendarDays} />
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full justify-start flex-wrap h-auto gap-1 bg-slate-100/70 p-1 rounded-xl">
          <TabsTrigger value="overview" className="gap-1.5"><User size={14} /> Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="missions" className="gap-1.5"><Truck size={14} /> Missions ({attribs.length})</TabsTrigger>
          <TabsTrigger value="documents" className="gap-1.5"><FileBadge size={14} /> Documents ({docsApprouves}/{requiredDocs.length})</TabsTrigger>
          <TabsTrigger value="communication" className="gap-1.5"><Megaphone size={14} /> Emails & push</TabsTrigger>
          <TabsTrigger value="finances" className="gap-1.5"><Wallet size={14} /> Finances</TabsTrigger>
          <TabsTrigger value="dispos" className="gap-1.5"><CalendarDays size={14} /> Disponibilités</TabsTrigger>
          <TabsTrigger value="activity" className="gap-1.5"><Activity size={14} /> Activité</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <AdminSection title="Coordonnées" description="Modifiez les champs puis enregistrez.">
            <div className="space-y-4">
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
                <input className={`${inp} bg-slate-50`} value={conv.email ?? ""} readOnly />
                <button
                  onClick={changeEmail}
                  disabled={busy === "email" || !conv.user_id}
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

            <AdminField label="Ville">
              <input className={inp} value={form.ville} onChange={(e) => setForm({ ...form, ville: e.target.value })} />
            </AdminField>

            <div className="grid grid-cols-2 gap-3">
              <AdminField label="Disponibilité">
                <input className={inp} value={form.disponibilite} onChange={(e) => setForm({ ...form, disponibilite: e.target.value })} />
              </AdminField>
              <AdminField label="Permis">
                <input className={inp} value={form.permis} onChange={(e) => setForm({ ...form, permis: e.target.value })} placeholder="B, C, EC..." />
              </AdminField>
            </div>

            <AdminField label="Notes internes">
              <textarea
                className={`${inp} min-h-[80px]`}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
              />
            </AdminField>

            <AdminField label="Inscrit le">
              <span className="inline-flex items-center gap-1.5"><Calendar size={14} className="text-slate-400" /> {new Date(conv.created_at).toLocaleDateString("fr-FR")}</span>
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

            {conv.user_id && (
              <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-100">
                <button onClick={sendReset} disabled={busy === "reset"} className="admin-btn-ghost inline-flex items-center gap-1.5">
                  {busy === "reset" ? <Loader2 className="animate-spin" size={14} /> : <KeyRound size={14} />}
                  Reset mot de passe
                </button>
                <button onClick={sendInvite} disabled={busy === "invite"} className="admin-btn-ghost inline-flex items-center gap-1.5">
                  {busy === "invite" ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}
                  Renvoyer l'invitation
                </button>
              </div>
            )}
            </div>
          </AdminSection>
        </TabsContent>

        <TabsContent value="missions" className="mt-6">
          <AdminSection title="Historique missions" description={`${attribs.length} attribution${attribs.length > 1 ? "s" : ""}`}>
            {attribs.length === 0 ? (
              <AdminEmpty icon={Truck} title="Aucune mission attribuée" />
            ) : (
              <div className="overflow-x-auto">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Trajet</th>
                      <th className="hidden sm:table-cell">Date</th>
                      {conv.type_convoyeur === "independant" && <th className="hidden md:table-cell">Tarif</th>}
                      <th>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attribs.map((a) => (
                      <tr key={a.id}>
                        <td>{a.trajet ? `${a.trajet.depart} → ${a.trajet.arrivee}` : <span className="text-slate-400">Trajet supprimé</span>}</td>
                        <td className="hidden sm:table-cell text-[color:var(--admin-muted)] text-xs">
                          {a.trajet?.date_trajet
                            ? new Date(a.trajet.date_trajet).toLocaleDateString("fr-FR")
                            : new Date(a.created_at).toLocaleDateString("fr-FR")}
                        </td>
                        {conv.type_convoyeur === "independant" && (
                          <td className="hidden md:table-cell admin-value">
                            {a.trajet?.tarif_convoyeur != null ? `${a.trajet.tarif_convoyeur} €` : "—"}
                          </td>
                        )}
                        <td><AdminBadge label={a.statut.replace(/_/g, " ")} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </AdminSection>
        </TabsContent>

        <TabsContent value="documents" className="mt-6">
          <AdminSection
            title="Centre de validation des documents"
            description="Ouvrir, zoomer, télécharger, approuver, refuser, demander un nouveau document."
          >
            <DocumentsValidationCenter
              convoyeurId={conv.id}
              convoyeurEmail={conv.email}
              convoyeurPrenom={conv.prenom}
              convoyeurNom={conv.nom}
              typeConvoyeur={conv.type_convoyeur}
              onChanged={load}
            />
          </AdminSection>

          <div className="mt-6">
            <ContratYousignCard
              convoyeurId={conv.id}
              nomComplet={fullName}
              email={conv.email}
              telephone={conv.telephone}
              permisNumero={conv.permis}
            />
          </div>
        </TabsContent>

        <TabsContent value="communication" className="mt-6">
          <AdminSection title="Communication convoyeur" description="Envoyer un email templatisé rempli manuellement ou une notification visible dans l'espace convoyeur.">
            <AdminManualCommunication
              recipient={{
                userId: conv.user_id,
                email: conv.email,
                label: fullName,
                prenom: conv.prenom,
                nom: conv.nom,
                role: "convoyeur",
              }}
            />
          </AdminSection>
        </TabsContent>

        <TabsContent value="finances" className="mt-6">
          <ConvoyeurFinancesPanel convoyeurId={conv.id} nom={fullName} />
        </TabsContent>

        <TabsContent value="dispos" className="mt-6">
          <AdminSection title="Disponibilités à venir" description={`${dispos.length} entrée${dispos.length > 1 ? "s" : ""}`}>
            {dispos.length === 0 ? (
              <AdminEmpty icon={CalendarDays} title="Aucune disponibilité déclarée" />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {dispos.map((d) => {
                  const tone = d.statut === "disponible" ? "success" : d.statut === "indisponible" ? "danger" : "warning";
                  return (
                    <div key={d.id} className="admin-card-flat p-3 flex flex-col gap-1">
                      <p className="text-sm font-medium text-slate-800">
                        {new Date(d.date_dispo).toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "short" })}
                      </p>
                      <AdminBadge label={d.statut} tone={tone} />
                      {d.notes && <p className="text-[11px] text-slate-500 line-clamp-2">{d.notes}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </AdminSection>
        </TabsContent>

        <TabsContent value="activity" className="mt-6">
          <AdminSection title="Journal d'activité" description={`${logs.length} événement${logs.length > 1 ? "s" : ""} récent${logs.length > 1 ? "s" : ""}`}>
            {logs.length === 0 ? (
              <AdminEmpty icon={Activity} title="Aucune activité enregistrée" />
            ) : (
              <ol className="relative border-l border-slate-200 ml-2 space-y-4">
                {logs.map((l) => (
                  <li key={l.id} className="ml-4">
                    <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-[color:var(--admin-accent)] ring-4 ring-white" />
                    <p className="text-sm text-slate-800">
                      <span className="font-medium">{l.actor_label ?? "Système"}</span>{" "}
                      {humanizeAction(l.action, l.entity_type, l.metadata)}
                    </p>
                    <time className="text-[11px] text-slate-400">
                      {new Date(l.created_at).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}
                    </time>
                  </li>
                ))}
              </ol>
            )}
          </AdminSection>
        </TabsContent>
      </Tabs>
    </div>
  );
}
