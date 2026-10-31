import { SiretBadge } from "@/components/SiretBadge";
import { adresseDe, composeAdresse } from "@/lib/adresse";
import { invokeAdminUserAction } from "@/lib/admin-user-actions";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { DriverAvatar } from "@/components/admin/DriverAvatar";
import { AdminAvatarUploader } from "@/components/admin/AdminAvatarUploader";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { convoyeurAutoRemplir } from "@/lib/esign.functions";
import { notifierDossierValide } from "@/lib/contrat-acces.functions";
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
  MapPin,
  Building2,
  IdCard,
} from "lucide-react";

function BlocTitre({ icon: Icon, titre, manque = 0 }: { icon: React.ComponentType<{ size?: number; className?: string }>; titre: string; manque?: number }) {
  return (
    <div className="mb-4 flex items-center gap-3 text-[15px] font-bold text-[#0a1638]">
      <span className="grid h-9 w-9 place-items-center rounded-xl text-white shadow-[0_8px_18px_-8px_rgba(47,95,255,.8)]" style={{ background: "linear-gradient(135deg,#2F5FFF,#5de0ff)" }}><Icon size={17} /></span>
      <span className="flex-1">{titre}</span>
      {manque > 0
        ? <span className="rounded-full bg-[#fff1d6] px-2.5 py-0.5 text-[11px] font-bold text-[#b36b00]">{manque} à compléter</span>
        : <span className="rounded-full bg-[#e1f7ec] px-2.5 py-0.5 text-[11px] font-bold text-[#0b7a45]">Complet</span>}
    </div>
  );
}
import { PermisCategories } from "@/components/PermisCategories";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MessageSquare } from "lucide-react";
import { UserMessagesPanel, useUserMessagesCount } from "@/components/admin/UserMessagesPanel";
import { ConvoyeurFinancesPanel } from "@/components/admin/finances/ConvoyeurFinancesPanel";
import { humanizeAction } from "@/lib/activity-humanizer";
import {
  AdminPageHeader,
  AdminSection,
  AdminField,
  AdminBadge,
  AdminEmpty,
} from "@/components/admin/ui";
import { sendTransactionalEmail } from "@/lib/email/send";
import { toast } from "sonner";
import { confirmToast } from "@/lib/confirm-toast";
import { DocumentsValidationCenter } from "@/components/admin/convoyeur/DocumentsValidationCenter";
import ContratYousignCard from "@/components/admin/ContratYousignCard";
import { IdVerifBadge, useIdVerifications } from "@/components/admin/IdVerifBadge";
import { StatutConvoyeurBadge, resolveStatutConvoyeur } from "@/components/admin/StatutConvoyeurBadge";
import { AdminManualCommunication } from "@/components/admin/AdminManualCommunication";
import { notifyDriver } from "@/lib/push/driver-notify";
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
  date_naissance: string;
  lieu_naissance: string;
  adresse_rue: string;
  code_postal: string;
  siret: string;
  permis_numero: string;
  permis_date_obtention: string;
};

const EMPTY: Editable = {
  prenom: "", nom: "", telephone: "", ville: "", disponibilite: "", permis: "", message: "",
  date_naissance: "", lieu_naissance: "", adresse_rue: "", code_postal: "", siret: "", permis_numero: "", permis_date_obtention: "",
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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [attribs, setAttribs] = useState<AttribItem[]>([]);
  const [dispos, setDispos] = useState<DispoRow[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { count: msgCount, refresh: refreshMsgCount } = useUserMessagesCount(conv?.user_id ?? null);
  const idVerif = useIdVerifications([conv?.user_id]);

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
        date_naissance: (cv as any).date_naissance ?? "",
        lieu_naissance: (cv as any).lieu_naissance ?? "",
        adresse_rue: adresseDe(cv as any).rue,
        code_postal: adresseDe(cv as any).cp,
        siret: (cv as any).siret ?? "",
        permis_numero: (cv as any).permis_numero ?? "",
        permis_date_obtention: (cv as any).permis_date_obtention ?? "",
      };
      if (!init.ville) init.ville = adresseDe(cv as any).ville;
      setForm(init);
      setOriginal(init);

      // Photo de profil : compte utilisateur si lié, sinon fiche convoyeur
      const convAvatar = (cv as unknown as { avatar_url?: string | null }).avatar_url ?? null;
      if (cv.user_id) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("avatar_url")
          .eq("user_id", cv.user_id)
          .maybeSingle();
        setAvatarUrl((prof as { avatar_url: string | null } | null)?.avatar_url ?? convAvatar);
      } else {
        setAvatarUrl(convAvatar);
      }


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
        const { data: prof } = await supabase
          .from("profiles")
          .select("avatar_url")
          .eq("user_id", cv.user_id)
          .maybeSingle();
        setAvatarUrl((prof as { avatar_url: string | null } | null)?.avatar_url ?? null);
        try {
          const { data: s } = await invokeAdminUserAction({ action: "get_account_status", user_id: cv.user_id } as any);
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

  // Fiche incomplète : on reprend automatiquement naissance, adresse et SIRET
  // (formulaire d'inscription, puis Kbis / base officielle) et on enregistre.
  const autoRemplir = useServerFn(convoyeurAutoRemplir);
  const notifDossier = useServerFn(notifierDossierValide);
  const [autoFait, setAutoFait] = useState<string | null>(null);
  useEffect(() => {
    if (!conv || autoFait === conv.id) return;
    const c = conv as any;
    const manque = ["date_naissance", "lieu_naissance", "siret", "adresse_rue", "code_postal"].some((k) => !String(c[k] ?? "").trim()) || !String(c.ville ?? "").trim();
    setAutoFait(conv.id);
    if (!manque) return;
    void autoRemplir({ data: { convoyeurId: conv.id } })
      .then((r) => {
        const n = Object.keys(r.rempli ?? {}).length;
        if (!r.ok || n === 0) return;
        toast.success(`Fiche complétée automatiquement (${n} champ${n > 1 ? "s" : ""})`, {
          description: r.source.includes("kbis") ? "Infos reprises de l'inscription et du Kbis." : "Infos reprises du formulaire d'inscription.",
        });
        void load();
      })
      .catch(() => undefined);
  }, [conv, autoFait, autoRemplir, load]);

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
      notifyDriver({ convoyeurId: conv.id, event: "compte_valide" });
      // notification dans son espace + rappel admin ; l'envoi du contrat reste manuel
      void notifDossier({ data: { convoyeurId: conv.id } }).catch(() => undefined);
      toast.success("Dossier validé. Dernière étape : envoyez-lui son contrat (onglet Contrat).", { duration: 8000 });
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
      date_naissance: form.date_naissance || null,
      lieu_naissance: form.lieu_naissance.trim() || null,
      adresse_rue: form.adresse_rue.trim() || null,
      code_postal: form.code_postal.trim() || null,
      adresse: composeAdresse({ rue: form.adresse_rue, cp: form.code_postal, ville: form.ville }) || null,
      siret: form.siret.replace(/\D/g, "") || null,
      permis_numero: form.permis_numero.trim().toUpperCase() || null,
      permis_date_obtention: form.permis_date_obtention || null,
    };
    const { error } = await supabase.from("convoyeurs").update(payload as any).eq("id", conv.id);
    // also sync profile name/phone for unified account view
    if (!error && conv.user_id) {
      await invokeAdminUserAction({
          action: "update_profile",
          user_id: conv.user_id,
          profile: { prenom: payload.prenom, nom: payload.nom, telephone: payload.telephone },
        } as any);
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
    const { data, error } = await invokeAdminUserAction({ action: "change_email", user_id: conv.user_id, email: newEmail } as any);
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
    const { data, error } = await invokeAdminUserAction({
        action: "reset_password",
        user_id: conv.user_id,
        redirect_to: `${window.location.origin}/reset-password`,
      } as any);
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
    const { data, error } = await invokeAdminUserAction({
        action: "invite_account",
        user_id: conv.user_id,
        email: conv.email,
          redirect_to: `${window.location.origin}/reset-password`,
      } as any);
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
    const { data, error } = await invokeAdminUserAction({ action: "suspend", user_id: conv.user_id } as any);
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
    const { data, error } = await invokeAdminUserAction({ action: "reactivate", user_id: conv.user_id } as any);
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
  const clesRequises = new Set(requiredDocs.map((d) => d.key));
  const docsEnPlus = docs.filter((d) => !clesRequises.has(normalizeConvoyeurDocType(d.type_document))).length;
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

  const inp = "w-full rounded-xl border border-[#d9e2f5] bg-[#f8faff] px-3.5 py-2.5 text-sm text-[#0a1638] placeholder:text-[#a3b0cf] focus:border-[#2F5FFF] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#2F5FFF]/10";
  const champsCles = [form.prenom, form.nom, form.date_naissance, form.lieu_naissance, form.telephone, form.adresse_rue, form.code_postal, form.ville, form.siret, form.permis, form.permis_numero, form.permis_date_obtention];
  const rempli = champsCles.filter((v) => !!String(v ?? "").trim()).length;
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
              <DriverAvatar convoyeurId={conv.id} src={avatarUrl} name={fullName} size="md" />
              <StatutConvoyeurBadge statut={statutUnifie} size="md" />
              <AdminBadge label={accountState.label} tone={accountState.tone} />
              {conv.user_id && <IdVerifBadge status={idVerif[conv.user_id]?.status} />}
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

      {/* Chiffres clés : mêmes compteurs que le centre de validation (documents obligatoires) */}
      {(() => {
        const docsOk = docsApprouves === requiredDocs.length;
        const pctDocs = requiredDocs.length ? Math.round((docsApprouves / requiredDocs.length) * 100) : 0;
        const pctTerm = attribs.length ? Math.round((terminees / attribs.length) * 100) : 0;
        const Kpi = ({ tone, label, icon: I, children, sub, pct }: { tone: string; label: string; icon: typeof Truck; children: React.ReactNode; sub?: string; pct?: number }) => (
          <div className={`cvx-kpi ${tone}`}>
            <div className="cvx-kpi-top"><span className="cvx-kpi-lbl">{label}</span><span className="cvx-kpi-ic"><I size={18} /></span></div>
            <div className="cvx-kpi-val">{children}</div>
            {sub && <div className="cvx-kpi-sub">{sub}</div>}
            {pct !== undefined && <div className="cvx-kpi-bar"><i style={{ width: `${pct}%` }} /></div>}
          </div>
        );
        return (
          <div className="cvx-kpis">
            <Kpi tone="cvx-blue" label="Missions" icon={Truck} sub={attribs.length ? `${attribs.length - terminees} en cours ou à venir` : "Aucune mission pour l'instant"}>{attribs.length}</Kpi>
            <Kpi tone="cvx-green" label="Terminées" icon={CheckCircle} pct={pctTerm} sub={attribs.length ? `${pctTerm} % des missions` : undefined}>{terminees}</Kpi>
            <Kpi tone={docsOk ? "cvx-green" : "cvx-amber"} label="Documents validés" icon={FileBadge} pct={pctDocs}
              sub={(docsOk ? "Dossier complet" : `${requiredDocs.length - docsApprouves} à valider ou à déposer`) + (docsEnPlus ? ` · +${docsEnPlus} en plus` : "")}>
              {docsApprouves}<small>/ {requiredDocs.length}</small>
            </Kpi>
            {conv.type_convoyeur === "independant" && (
              <Kpi tone="cvx-violet" label="Revenus générés" icon={Euro} sub="Missions terminées">{revenus.toFixed(0)}<small>€</small></Kpi>
            )}
            <Kpi tone="cvx-blue" label="Jours disponibles" icon={CalendarDays} sub="À venir">{prochainesDispos}</Kpi>
          </div>
        );
      })()}

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full justify-start flex-wrap h-auto gap-1 bg-slate-100/70 p-1 rounded-xl">
          <TabsTrigger value="overview" className="gap-1.5"><User size={14} /> Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="missions" className="gap-1.5"><Truck size={14} /> Missions ({attribs.length})</TabsTrigger>
          <TabsTrigger value="documents" className="gap-1.5"><FileBadge size={14} /> Documents ({docsApprouves}/{requiredDocs.length}{docsEnPlus ? ` +${docsEnPlus}` : ""})</TabsTrigger>
          <TabsTrigger value="communication" className="gap-1.5"><Megaphone size={14} /> Emails & push</TabsTrigger>
          <TabsTrigger value="messages" className="gap-1.5">
            <MessageSquare size={14} className={msgCount > 0 ? "text-[#6effcd] drop-shadow-[0_0_6px_rgba(110,255,205,0.9)]" : ""} />
            Messages
            {msgCount > 0 && (
              <span className="ml-0.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-[#6effcd] px-1.5 text-[10px] font-bold text-[#04231a] shadow-[0_0_10px_rgba(110,255,205,0.8)]">{msgCount}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="finances" className="gap-1.5"><Wallet size={14} /> Finances</TabsTrigger>
          <TabsTrigger value="dispos" className="gap-1.5"><CalendarDays size={14} /> Disponibilités</TabsTrigger>
          <TabsTrigger value="activity" className="gap-1.5"><Activity size={14} /> Activité</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <AdminSection title="Coordonnées" description="Modifiez les champs puis enregistrez.">
            <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
            <div className="xl:col-span-2 rounded-2xl border border-[#dbe5ff] bg-gradient-to-r from-[#f3f6ff] to-[#effcff] p-4">
              <div className="flex items-center justify-between gap-3 text-sm font-bold text-[#0a1638]">
                <span>Dossier renseigné</span>
                <span className="text-[#2F5FFF]">{rempli} / {champsCles.length}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
                <div className="h-full rounded-full" style={{ width: `${Math.round((rempli / champsCles.length) * 100)}%`, background: "linear-gradient(90deg,#2F5FFF,#5de0ff)" }} />
              </div>
              {rempli < champsCles.length && (
                <p className="mt-2 text-xs text-[#5a6788]">Un convoyeur invité par email ne renseigne que son nom, son téléphone et son mot de passe : il complète le reste depuis son profil dans l'appli. Vous pouvez aussi remplir ici.</p>
              )}
            </div>
            <div className="xl:col-span-2 rounded-2xl border border-[#e3e9f7] bg-white p-5 shadow-[0_14px_34px_-24px_rgba(20,40,110,.45)]">
              <BlocTitre icon={User} titre="Identité" manque={[form.prenom, form.nom, form.date_naissance, form.lieu_naissance].filter((v) => !v).length} />
              <AdminField label="Photo de profil">
                <AdminAvatarUploader
                  ownerUserId={conv.user_id ?? null}
                  convoyeurId={conv.id}
                  value={avatarUrl}
                  onChange={setAvatarUrl}
                />
              </AdminField>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                <AdminField label="Prénom">
                  <input className={inp} value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} />
                </AdminField>
                <AdminField label="Nom">
                  <input className={inp} value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
                </AdminField>
                <AdminField label="Date de naissance">
                  <input type="date" className={inp} value={form.date_naissance} onChange={(e) => setForm({ ...form, date_naissance: e.target.value })} />
                  {!form.date_naissance && <p className="mt-1 text-[11px] text-amber-700">Non renseignée</p>}
                </AdminField>
                <AdminField label="Lieu de naissance">
                  <input className={inp} value={form.lieu_naissance} onChange={(e) => setForm({ ...form, lieu_naissance: e.target.value })} placeholder="Ville" />
                  {!form.lieu_naissance && <p className="mt-1 text-[11px] text-amber-700">Non renseigné</p>}
                </AdminField>
              </div>
            </div>

            <div className="rounded-2xl border border-[#e3e9f7] bg-white p-5 shadow-[0_14px_34px_-24px_rgba(20,40,110,.45)]">
              <BlocTitre icon={AtSign} titre="Contact" manque={[form.telephone].filter((v) => !v).length} />
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
              <div className="mt-3">
                <AdminField label="Téléphone">
                  <input className={inp} value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} />
                </AdminField>
              </div>
            </div>

            <div className="rounded-2xl border border-[#e3e9f7] bg-white p-5 shadow-[0_14px_34px_-24px_rgba(20,40,110,.45)]">
              <BlocTitre icon={MapPin} titre="Adresse actuelle" manque={[form.adresse_rue, form.code_postal, form.ville].filter((v) => !v).length} />
              <AdminField label="Rue et numéro">
                <input className={inp} value={form.adresse_rue} onChange={(e) => setForm({ ...form, adresse_rue: e.target.value })} placeholder="12 rue des Lilas" />
              </AdminField>
              <div className="grid grid-cols-3 gap-3 mt-3">
                <AdminField label="Code postal">
                  <input className={inp} inputMode="numeric" maxLength={5} value={form.code_postal} onChange={(e) => setForm({ ...form, code_postal: e.target.value.replace(/\D/g, "") })} placeholder="37000" />
                </AdminField>
                <div className="col-span-2">
                  <AdminField label="Ville">
                    <input className={inp} value={form.ville} onChange={(e) => setForm({ ...form, ville: e.target.value })} />
                  </AdminField>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[#e3e9f7] bg-white p-5 shadow-[0_14px_34px_-24px_rgba(20,40,110,.45)]">
              <BlocTitre icon={Building2} titre="Entreprise" manque={[form.siret].filter((v) => !v).length} />
              <AdminField label="N° SIRET">
                <input className={inp} inputMode="numeric" maxLength={17} value={form.siret} onChange={(e) => setForm({ ...form, siret: e.target.value })} placeholder="000 000 000 00000" />
                <SiretBadge admin siret={form.siret} />
              </AdminField>
            </div>

            <div className="rounded-2xl border border-[#e3e9f7] bg-white p-5 shadow-[0_14px_34px_-24px_rgba(20,40,110,.45)]">
              <BlocTitre icon={IdCard} titre="Permis de conduire" manque={[form.permis, form.permis_numero, form.permis_date_obtention].filter((v) => !v).length} />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-3">
                <AdminField label="Catégories">
                  <PermisCategories value={form.permis} onChange={(v) => setForm({ ...form, permis: v })} />
                </AdminField>
                </div>
                <AdminField label="N° du permis">
                  <input className={inp} value={form.permis_numero} onChange={(e) => setForm({ ...form, permis_numero: e.target.value })} placeholder="12AB34567890" />
                </AdminField>
                <AdminField label="Date d'obtention">
                  <input type="date" className={inp} value={form.permis_date_obtention} onChange={(e) => setForm({ ...form, permis_date_obtention: e.target.value })} />
                </AdminField>
              </div>
            </div>

            <div className="rounded-2xl border border-[#e3e9f7] bg-white p-5 shadow-[0_14px_34px_-24px_rgba(20,40,110,.45)]">
              <BlocTitre icon={CalendarDays} titre="Disponibilité" />
              <AdminField label="Disponibilité">
                <input className={inp} value={form.disponibilite} onChange={(e) => setForm({ ...form, disponibilite: e.target.value })} />
              </AdminField>
            </div>

            <div className="xl:col-span-2 grid gap-4 sm:grid-cols-[2fr_1fr]">
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
            </div>

            <div className="xl:col-span-2 flex flex-wrap gap-2 pt-2 border-t border-slate-100">
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
            title="Photo de profil"
            description="Importer et recadrer la photo du convoyeur (visible partout dans l'admin et l'app Driver)."
          >
            <AdminAvatarUploader
              ownerUserId={conv.user_id ?? null}
              convoyeurId={conv.id}
              value={avatarUrl}
              onChange={setAvatarUrl}
            />
          </AdminSection>


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
              permisNumero={(conv as any).permis_numero ?? null}
              permisDate={(conv as any).permis_date_obtention ?? null}
              dateNaissance={(conv as any).date_naissance} lieuNaissance={(conv as any).lieu_naissance}
              siret={(conv as any).siret}
              adresse={composeAdresse(adresseDe(conv as any)) || (conv as any).adresse}
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

        <TabsContent value="messages" className="mt-6">
          <AdminSection title="Messagerie directe" description="Envoyer un message par email et/ou dans l'app Driver du convoyeur.">
            <UserMessagesPanel
              target={{ userId: conv.user_id, email: conv.email, prenom: conv.prenom, label: fullName, role: "convoyeur" }}
              onSent={refreshMsgCount}
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
