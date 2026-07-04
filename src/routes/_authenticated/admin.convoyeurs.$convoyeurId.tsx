import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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
} from "lucide-react";
import {
  AdminPageHeader,
  AdminSection,
  AdminField,
  AdminBadge,
  AdminStatCard,
  AdminEmpty,
} from "@/components/admin/ui";
import { sendTransactionalEmail } from "@/lib/email/send";

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
const docLabels: Record<string, string> = {
  permis: "Permis",
  identite: "CNI",
  domicile: "Domicile",
  rib: "RIB",
  kbis: "KBIS",
  assurance: "Assurance",
};

function AdminConvoyeurDetail() {
  const { convoyeurId } = Route.useParams();
  const navigate = useNavigate();
  const [conv, setConv] = useState<Convoyeur | null>(null);
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [attribs, setAttribs] = useState<AttribItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Editable>(EMPTY);
  const [original, setOriginal] = useState<Editable>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<AccountStatus | null>(null);

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

      const [{ data: d }, { data: a }] = await Promise.all([
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
      ]);
      setDocs((d as DocItem[]) ?? []);
      setAttribs((a as unknown as AttribItem[]) ?? []);

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
    if (statut === "valide" && conv.type_convoyeur === "independant") {
      const required = ["permis", "identite", "domicile", "rib", "kbis", "assurance"];
      const issues = required
        .map((r) => {
          const doc = docs.find((d) => d.type_document === r);
          if (!doc) return `${docLabels[r]} manquant`;
          if (doc.statut_validation !== "approuve") return `${docLabels[r]} non approuvé`;
          return null;
        })
        .filter(Boolean);
      if (issues.length) {
        toast.error(`Validation impossible :\n\n• ${issues.join("\n• ")}`);
        return;
      }
    }
    const wasNotValid = conv.statut !== "valide";
    await supabase.from("convoyeurs").update({ statut }).eq("id", conv.id);
    setConv({ ...conv, statut });
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
    if (!window.confirm(`Changer l'email pour ${newEmail} ?\nLe convoyeur devra utiliser cet email pour se connecter.`)) return;
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
        redirect_to: `${window.location.origin}/convoyeur`,
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

  const suspendAccount = async () => {
    if (!conv?.user_id) return;
    if (!window.confirm("Suspendre ce convoyeur ? Il ne pourra plus se connecter.")) return;
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
  const docsApprouves = docs.filter((d) => d.statut_validation === "approuve").length;

  const statutTone =
    conv.statut === "valide" ? "success" : conv.statut === "en_attente" ? "warning" : conv.statut === "refuse" || conv.statut === "suspendu" ? "danger" : "neutral";

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
        eyebrow={conv.type_convoyeur === "independant" ? "Convoyeur indépendant" : "Convoyeur salarié"}
        title={fullName}
        subtitle={conv.email}
        status={
          <div className="flex flex-wrap items-center gap-2">
            <AdminBadge label={statutLabels[conv.statut] ?? conv.statut} tone={statutTone} />
            <AdminBadge label={accountState.label} tone={accountState.tone} />
            {conv.ville && <AdminBadge label={conv.ville} tone="info" />}
          </div>
        }
        actions={
          <>
            <Link to="/admin/convoyeurs" className="admin-btn-ghost inline-flex items-center gap-2">
              <ArrowLeft size={14} /> Retour
            </Link>
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminStatCard label="Missions totales" value={attribs.length} icon={Truck} />
        <AdminStatCard label="Terminées" value={terminees} icon={CheckCircle} accent="success" />
        <AdminStatCard
          label="Documents approuvés"
          value={`${docsApprouves} / 6`}
          icon={FileBadge}
          accent={docsApprouves === 6 ? "success" : "warning"}
        />
        <AdminStatCard label="Statut" value={statutLabels[conv.statut] ?? conv.statut} accent={statutTone === "success" ? "success" : statutTone === "danger" ? "danger" : "warning"} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
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

        <div className="lg:col-span-2 space-y-6">
          <AdminSection title="Documents" description={`${docs.length} document${docs.length > 1 ? "s" : ""}`}>
            {docs.length === 0 ? (
              <AdminEmpty icon={FileBadge} title="Aucun document" />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {["permis", "identite", "domicile", "rib", "kbis", "assurance"].map((type) => {
                  const d = docs.find((x) => x.type_document === type);
                  const tone =
                    d?.statut_validation === "approuve"
                      ? "success"
                      : d?.statut_validation === "refuse"
                      ? "danger"
                      : d
                      ? "warning"
                      : "neutral";
                  return (
                    <div key={type} className="admin-card-flat p-3 flex flex-col gap-1.5">
                      <p className="admin-label">{docLabels[type]}</p>
                      <AdminBadge
                        label={d ? d.statut_validation ?? "en attente" : "manquant"}
                        tone={tone}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </AdminSection>

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
        </div>
      </div>
    </div>
  );
}
