import { createFileRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { DriverAvatar } from "@/components/admin/DriverAvatar";
import { supabase } from "@/integrations/supabase/client";
import {
  RefreshCw, Eye, CheckCircle, XCircle, UserPlus, IdCard, User, FileText, Mail, MapPin,
  Ban, RotateCcw, AlertTriangle, Clock, ShieldCheck, Search as SearchIcon, Send, Trash2, Copy,
} from "lucide-react";
import { AdminDetailDrawer, DrawerSection, DrawerField, DrawerGrid, DrawerBadge } from "@/components/admin/AdminDetailDrawer";
import { sendTransactionalEmail } from "@/lib/email/send";
import { notifyAdmin } from "@/lib/admin-notifications";
import {
  PageHeader,
  KpiCard,
  Badge,
  Table,
  THead,
  TH,
  TR,
  TD,
  EmptyState,
  Modal,
  Button,
  IconButton,
  Select,
  TextInput,
  FormField,
} from "@/components/admin/AdminUI";
import {
  StatutConvoyeurBadge,
  resolveStatutConvoyeur,
  type StatutConvoyeur,
} from "@/components/admin/StatutConvoyeurBadge";
import { toast } from "sonner";
import { confirmToast } from "@/lib/confirm-toast";
import {
  getConvoyeurDocLabel,
  getRequiredConvoyeurDocTypes,
  isConvoyeurDocApproved,
  normalizeConvoyeurDocType,
} from "@/lib/convoyeur-documents";

export const Route = createFileRoute("/_authenticated/admin/convoyeurs")({
  component: AdminConvoyeurs,
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

interface Invitation {
  id: string;
  email: string;
  nom: string | null;
  prenom: string | null;
  telephone: string | null;
  token: string;
  status: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
}

interface DocLite { convoyeur_id: string; type_document: string; statut_validation: string | null }

const STATUT_FILTERS: Array<{ value: string; label: string }> = [
  { value: "all",        label: "Tous les statuts" },
  { value: "en_attente", label: "En attente" },
  { value: "en_verif",   label: "En vérification" },
  { value: "a_corriger", label: "À corriger" },
  { value: "valide",     label: "Validés" },
  { value: "refuse",     label: "Refusés" },
  { value: "suspendu",   label: "Suspendus" },
];

function AdminConvoyeurs() {
  const navigate = useNavigate();
  const location = useLocation();
  const [convoyeurs, setConvoyeurs] = useState<Convoyeur[]>([]);
  const [allDocs, setAllDocs] = useState<DocLite[]>([]);
  const [filterStatut, setFilterStatut] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ nom: "", prenom: "", email: "", telephone: "", password: "" });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [selected, setSelected] = useState<Convoyeur | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ nom: "", prenom: "", email: "", telephone: "" });
  const [inviting, setInviting] = useState(false);
  const [docs, setDocs] = useState<Array<{ type_document: string; nom_fichier: string; url_fichier: string; statut_validation: string }>>([]);
  const [missionsCount, setMissionsCount] = useState<number>(0);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!selected) { setDocs([]); setMissionsCount(0); return; }
    supabase.from("documents_convoyeurs").select("type_document, nom_fichier, url_fichier, statut_validation").eq("convoyeur_id", selected.id).then(({ data }) => setDocs(data ?? []));
    supabase.from("attributions").select("id", { count: "exact", head: true }).eq("convoyeur_id", selected.id).then(({ count }) => setMissionsCount(count ?? 0));
  }, [selected]);

  const fetchAll = useCallback(async () => {
    const [{ data: convs }, { data: docsData }] = await Promise.all([
      supabase.from("convoyeurs").select("*").order("created_at", { ascending: false }),
      supabase.from("documents_convoyeurs").select("convoyeur_id, type_document, statut_validation"),
    ]);
    if (convs) setConvoyeurs(convs as Convoyeur[]);
    if (docsData) setAllDocs(docsData as DocLite[]);
    const { data: invs } = await supabase
      .from("convoyeur_invitations" as never)
      .select("*")
      .order("created_at", { ascending: false });
    if (invs) setInvitations(invs as unknown as Invitation[]);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Compute unified statut for each convoyeur (memo)
  const enriched = useMemo(() => {
    const byConv = new Map<string, DocLite[]>();
    for (const d of allDocs) {
      const arr = byConv.get(d.convoyeur_id) ?? [];
      arr.push(d);
      byConv.set(d.convoyeur_id, arr);
    }
    return convoyeurs.map((c) => ({
      ...c,
      statutUnifie: resolveStatutConvoyeur(c.statut, byConv.get(c.id) ?? []),
      docsCount: (byConv.get(c.id) ?? []).length,
      docsApprouves: (byConv.get(c.id) ?? []).filter((d) => d.statut_validation === "approuve").length,
    }));
  }, [convoyeurs, allDocs]);

  // KPIs
  const kpis = useMemo(() => {
    const counts: Record<StatutConvoyeur, number> = {
      valide: 0, en_attente: 0, a_corriger: 0, en_verif: 0, refuse: 0, suspendu: 0,
    };
    for (const c of enriched) counts[c.statutUnifie]++;
    const docsAValider = allDocs.filter((d) => (d.statut_validation ?? "en_attente") === "en_attente").length;
    const aVerifier = counts.en_attente + counts.en_verif + counts.a_corriger;
    return { total: enriched.length, aVerifier, docsAValider, validated: counts.valide, suspendus: counts.suspendu, refuses: counts.refuse };
  }, [enriched, allDocs]);

  // Filtrage
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched.filter((c) => {
      if (filterStatut !== "all" && c.statutUnifie !== filterStatut) return false;
      if (!q) return true;
      return (
        c.nom?.toLowerCase().includes(q) ||
        c.prenom?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        (c.ville ?? "").toLowerCase().includes(q)
      );
    });
  }, [enriched, filterStatut, search]);

  if (location.pathname !== "/admin/convoyeurs") {
    return <Outlet />;
  }

  const updateStatut = async (id: string, statut: string, motif?: string) => {
    const previous = convoyeurs.find((c) => c.id === id) ?? null;
    if (!previous) return;

    if (statut === "valide") {
      const convDocs = allDocs.filter((d) => d.convoyeur_id === id);
      const required = getRequiredConvoyeurDocTypes(previous.type_convoyeur).map((doc) => doc.key);
      const issues: string[] = [];
      for (const r of required) {
        const d = convDocs.find((x) => normalizeConvoyeurDocType(x.type_document) === r);
        if (!d) issues.push(`${getConvoyeurDocLabel(r)} manquant`);
        else if (!isConvoyeurDocApproved(d.statut_validation)) issues.push(`${getConvoyeurDocLabel(r)} non approuvé`);
      }
      if (!previous.has_completed_training && previous.training_status !== "completed") {
        issues.push("Formation Académie Ligneo non validée");
      }
      // Bypass admin : la validation reste possible malgré des documents incomplets
      // (invitation récente, dossier transmis hors plateforme…), après confirmation.
      if (issues.length > 0) {
        const ok = await confirmToast(
          `Documents incomplets :\n• ${issues.join("\n• ")}\n\nValider quand même ce convoyeur ?`,
        );
        if (!ok) return;
      }
    }

    const wasNotValid = previous.statut !== "valide";
    const shouldBypass = statut === "valide" && (
      !previous.has_completed_training || previous.training_status !== "completed"
    );
    const updates = shouldBypass
      ? { statut, has_completed_training: true, training_status: "completed" }
      : { statut };
    const { error: updateError } = await supabase.from("convoyeurs").update(updates).eq("id", id);
    if (updateError) {
      toast.error(`Mise à jour impossible : ${updateError.message}`);
      return;
    }

    if (statut === "valide" && previous.user_id) {
      await supabase.functions.invoke("admin-user-actions", {
        body: { action: "activate_role", user_id: previous.user_id, role: "convoyeur" },
      });
    }

    // Emails + notif in-app
    try {
      if (statut === "valide" && wasNotValid) {
        await sendTransactionalEmail({
          templateName: "convoyeur-validation",
          recipientEmail: previous.email,
          idempotencyKey: `convoyeur-validation-${previous.id}`,
          templateData: { prenom: previous.prenom, nom: previous.nom },
        });
        await notifyAdmin({
          type: "driver_action",
          titre: `Convoyeur validé : ${previous.prenom} ${previous.nom}`,
          message: previous.email,
          entityType: "convoyeur",
          entityId: previous.id,
          link: `/admin/convoyeurs/${previous.id}`,
        });
      } else if (statut === "refuse") {
        await sendTransactionalEmail({
          templateName: "convoyeur-refuse",
          recipientEmail: previous.email,
          idempotencyKey: `convoyeur-refuse-${previous.id}-${Date.now()}`,
          templateData: { prenom: previous.prenom, nom: previous.nom, motif },
        });
        await notifyAdmin({
          type: "driver_action",
          titre: `Candidature refusée : ${previous.prenom} ${previous.nom}`,
          message: motif || previous.email,
          entityType: "convoyeur",
          entityId: previous.id,
          link: `/admin/convoyeurs/${previous.id}`,
        });
      }
    } catch (err) {
      console.error("[admin.convoyeurs] notification échouée", err);
    }

    fetchAll();
  };

  const suspendConvoyeur = async (c: Convoyeur) => {
    if (!c.user_id) return toast.error("Aucun compte associé");
    if (!(await confirmToast(`Suspendre ${c.prenom} ${c.nom} ? Il ne pourra plus se connecter.`))) return;
    setBusy(c.id);
    const { data, error } = await supabase.functions.invoke("admin-user-actions", {
      body: { action: "suspend", user_id: c.user_id },
    });
    if (error || data?.error) {
      setBusy(null);
      return toast.error(data?.error ?? "Erreur");
    }
    await supabase.from("convoyeurs").update({ statut: "suspendu" }).eq("id", c.id);
    try {
      await sendTransactionalEmail({
        templateName: "convoyeur-suspendu",
        recipientEmail: c.email,
        idempotencyKey: `convoyeur-suspendu-${c.id}-${Date.now()}`,
        templateData: { prenom: c.prenom, nom: c.nom, reactive: false },
      });
      await notifyAdmin({
        type: "driver_action",
        titre: `Convoyeur suspendu : ${c.prenom} ${c.nom}`,
        message: c.email,
        entityType: "convoyeur",
        entityId: c.id,
        link: `/admin/convoyeurs/${c.id}`,
      });
    } catch (err) {
      console.error("[admin.convoyeurs] notif suspend échouée", err);
    }
    setBusy(null);
    toast.success("Compte suspendu");
    fetchAll();
  };

  const reactivateConvoyeur = async (c: Convoyeur) => {
    if (!c.user_id) return toast.error("Aucun compte associé");
    setBusy(c.id);
    const { data, error } = await supabase.functions.invoke("admin-user-actions", {
      body: { action: "reactivate", user_id: c.user_id },
    });
    if (error || data?.error) {
      setBusy(null);
      return toast.error(data?.error ?? "Erreur");
    }
    try {
      await sendTransactionalEmail({
        templateName: "convoyeur-suspendu",
        recipientEmail: c.email,
        idempotencyKey: `convoyeur-reactivate-${c.id}-${Date.now()}`,
        templateData: { prenom: c.prenom, nom: c.nom, reactive: true },
      });
      await notifyAdmin({
        type: "driver_action",
        titre: `Convoyeur réactivé : ${c.prenom} ${c.nom}`,
        message: c.email,
        entityType: "convoyeur",
        entityId: c.id,
        link: `/admin/convoyeurs/${c.id}`,
      });
    } catch (err) {
      console.error("[admin.convoyeurs] notif reactivate échouée", err);
    }
    setBusy(null);
    toast.success("Compte réactivé");
    fetchAll();
  };

  const sendInvitationEmail = async (inv: {
    email: string;
    prenom: string | null;
    nom: string | null;
    token: string;
    expires_at?: string;
  }) => {
    const inviteUrl = `${window.location.origin}/invitation-convoyeur/${inv.token}`;
    await sendTransactionalEmail({
      templateName: "invitation-convoyeur",
      recipientEmail: inv.email,
      idempotencyKey: `invitation-convoyeur-${inv.token}`,
      skipProfileLookup: true,
      templateData: {
        prenom: inv.prenom,
        nom: inv.nom,
        inviteUrl,
        expiresLabel: inv.expires_at
          ? new Date(inv.expires_at).toLocaleDateString("fr-FR")
          : null,
      },
    });
  };

  const createInvitation = async () => {
    const email = inviteForm.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Saisissez une adresse email valide");
      return;
    }
    setInviting(true);
    try {
      const { data, error } = await supabase.rpc("admin_create_convoyeur_invitation" as never, {
        _email: email,
        _nom: inviteForm.nom.trim() || null,
        _prenom: inviteForm.prenom.trim() || null,
        _telephone: inviteForm.telephone.trim() || null,
      } as never);
      if (error) throw error;
      const row = Array.isArray(data)
        ? (data[0] as { token: string; expires_at?: string } | undefined)
        : undefined;
      if (!row?.token) throw new Error("L'invitation a été créée sans lien valide. Réessayez.");
      await sendInvitationEmail({
        email,
        prenom: inviteForm.prenom.trim() || null,
        nom: inviteForm.nom.trim() || null,
        token: row.token,
        expires_at: row.expires_at,
      });
      toast.success(`Invitation envoyée à ${email}`);
      setInviteForm({ nom: "", prenom: "", email: "", telephone: "" });
      setShowInvite(false);
      fetchAll();
    } catch (err) {
      console.error("[admin.convoyeurs] invitation", err);
      const message = err instanceof Error ? err.message : "Erreur lors de l'envoi de l'invitation";
      toast.error(message.includes("Failed to send email")
        ? "L'invitation a été créée, mais l'email n'a pas pu être envoyé. Réessayez dans quelques instants."
        : message);
    } finally {
      setInviting(false);
    }
  };

  const resendInvitation = async (inv: Invitation) => {
    setBusy(inv.id);
    try {
      const { data, error } = await supabase.rpc("admin_create_convoyeur_invitation" as never, {
        _email: inv.email,
        _nom: inv.nom,
        _prenom: inv.prenom,
        _telephone: inv.telephone,
      } as never);
      if (error) throw error;
      const row = Array.isArray(data)
        ? (data[0] as { token: string; expires_at?: string } | undefined)
        : undefined;
      if (!row?.token) throw new Error("Le nouveau lien d'invitation est indisponible");
      await sendInvitationEmail({ email: inv.email, prenom: inv.prenom, nom: inv.nom, token: row.token, expires_at: row.expires_at });
      toast.success("Invitation renvoyée");
      fetchAll();
    } catch (err) {
      console.error("[admin.convoyeurs] renvoi invitation", err);
      toast.error(err instanceof Error ? err.message : "Impossible de renvoyer l'invitation");
    } finally {
      setBusy(null);
    }
  };

  const cancelInvitation = async (inv: Invitation) => {
    if (!(await confirmToast(`Annuler l'invitation de ${inv.email} ?`))) return;
    setBusy(inv.id);
    const { error } = await supabase
      .from("convoyeur_invitations" as never)
      .update({ status: "cancelled" } as never)
      .eq("id", inv.id);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Invitation annulée");
    fetchAll();
  };

  const createConvoyeur = async () => {
    if (!form.nom || !form.prenom || !form.email || !form.password) {
      setCreateError("Remplissez tous les champs obligatoires.");
      return;
    }
    setCreating(true);
    setCreateError("");
    try {
      const { data, error } = await supabase.functions.invoke("admin-create-account", {
        body: {
          email: form.email,
          password: form.password,
          prenom: form.prenom,
          nom: form.nom,
          telephone: form.telephone,
          role: "convoyeur",
        },
      });
      const userId = (data as { ok?: boolean; user_id?: string; error?: string } | null)?.user_id;
      const errMsg = (data as { error?: string } | null)?.error;
      if (error || !userId) {
        setCreateError(errMsg || error?.message || "Erreur création compte");
        return;
      }
      const { error: convError } = await supabase.from("convoyeurs").insert({
        user_id: userId,
        nom: form.nom,
        prenom: form.prenom,
        email: form.email,
        telephone: form.telephone,
        statut: "valide",
      });
      if (convError) {
        setCreateError(convError.message);
        return;
      }
      setForm({ nom: "", prenom: "", email: "", telephone: "", password: "" });
      setShowCreate(false);
      fetchAll();
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      {/* ===== En-tête ===== */}
      <div className="dvx-head">
        <div className="min-w-0">
          <h1 className="dvx-title">Convoyeurs</h1>
          <p className="dvx-sub">
            {enriched.length} convoyeur{enriched.length > 1 ? "s" : ""} · {kpis.aVerifier} à vérifier
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="dvx-btn outline" onClick={() => setShowCreate(true)}>
            <UserPlus size={14} /> Créer directement
          </button>
          <button type="button" className="dvx-btn outline" onClick={fetchAll} title="Actualiser">
            <RefreshCw size={14} />
          </button>
          <button type="button" className="dvx-cta" onClick={() => setShowInvite(true)}>
            <Send size={16} /> Inviter un convoyeur (email)
          </button>
        </div>
      </div>

      {/* ===== Statistiques ===== */}
      <div className="dvx-stats">
        <div className="dvx-stat">
          <span className="dvx-stat-ic orange"><Clock size={17} /></span>
          <p className="dvx-stat-k">À vérifier</p>
          <p className="dvx-stat-v">{kpis.aVerifier}</p>
          <p className={`dvx-stat-t ${kpis.aVerifier > 0 ? "warn" : "dim"}`}>En attente / en vérif. / à corriger</p>
        </div>
        <div className="dvx-stat">
          <span className="dvx-stat-ic blue"><FileText size={17} /></span>
          <p className="dvx-stat-k">Documents à valider</p>
          <p className="dvx-stat-v">{kpis.docsAValider}</p>
          <p className={`dvx-stat-t ${kpis.docsAValider > 0 ? "warn" : "dim"}`}>Documents en attente</p>
        </div>
        <div className="dvx-stat">
          <span className="dvx-stat-ic green"><ShieldCheck size={17} /></span>
          <p className="dvx-stat-k">Convoyeurs validés</p>
          <p className="dvx-stat-v">{kpis.validated}</p>
          <p className="dvx-stat-t up">Profils actifs</p>
        </div>
        <div className="dvx-stat">
          <span className="dvx-stat-ic violet"><AlertTriangle size={17} /></span>
          <p className="dvx-stat-k">Suspendus / refusés</p>
          <p className="dvx-stat-v">{kpis.suspendus + kpis.refuses}</p>
          <p className={`dvx-stat-t ${kpis.suspendus + kpis.refuses > 0 ? "warn" : "dim"}`}>
            {kpis.suspendus} suspendu(s) · {kpis.refuses} refusé(s)
          </p>
        </div>
      </div>

      {/* ===== Filtres ===== */}
      <div className="dvx-filters">
        <div className="dvx-search">
          <SearchIcon size={15} />
          <input
            className="dvx-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher nom, email, ville…"
          />
        </div>
        <select className="dvx-select" value={filterStatut} onChange={(e) => setFilterStatut(e.target.value)}>
          {STATUT_FILTERS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {invitations.filter((i) => i.status === "pending" || i.status === "accepted").length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-pro-text mb-2">Invitations</h2>
          <Table>
            <THead>
              <TH>Invité</TH>
              <TH className="hidden sm:table-cell">Envoyée le</TH>
              <TH>Statut</TH>
              <TH className="text-right">Actions</TH>
            </THead>
            <tbody>
              {invitations
                .filter((i) => i.status === "pending" || i.status === "accepted")
                .slice(0, 20)
                .map((inv) => {
                  const expired = inv.status === "pending" && new Date(inv.expires_at) < new Date();
                  return (
                    <TR key={inv.id}>
                      <TD>
                        <p className="font-medium text-pro-text">
                          {[inv.prenom, inv.nom].filter(Boolean).join(" ") || inv.email}
                        </p>
                        <p className="text-xs text-pro-muted">{inv.email}</p>
                      </TD>
                      <TD className="hidden sm:table-cell text-pro-text-soft text-sm">
                        {new Date(inv.created_at).toLocaleDateString("fr-FR")}
                      </TD>
                      <TD>
                        {inv.status === "accepted" ? (
                          <Badge tone="success">Acceptée</Badge>
                        ) : expired ? (
                          <Badge tone="danger">Expirée</Badge>
                        ) : (
                          <Badge tone="warning">En attente</Badge>
                        )}
                      </TD>
                      <TD>
                        <div className="flex items-center justify-end gap-1">
                          {inv.status === "pending" && (
                            <>
                              <IconButton
                                title="Copier le lien"
                                tone="neutral"
                                onClick={() => {
                                  navigator.clipboard.writeText(
                                    `${window.location.origin}/invitation-convoyeur/${inv.token}`,
                                  );
                                  toast.success("Lien copié");
                                }}
                              >
                                <Copy size={15} />
                              </IconButton>
                              <IconButton
                                title="Renvoyer l'invitation"
                                tone="neutral"
                                disabled={busy === inv.id}
                                onClick={() => resendInvitation(inv)}
                              >
                                <Send size={15} />
                              </IconButton>
                              <IconButton
                                title="Annuler l'invitation"
                                tone="danger"
                                disabled={busy === inv.id}
                                onClick={() => cancelInvitation(inv)}
                              >
                                <Trash2 size={15} />
                              </IconButton>
                            </>
                          )}
                        </div>
                      </TD>
                    </TR>
                  );
                })}
            </tbody>
          </Table>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState icon={IdCard} title="Aucun convoyeur" description="Aucun résultat pour ce filtre." />
      ) : (
        <div className="space-y-3.5">
          {filtered.map((c) => (
            <div
              key={c.id}
              className={`dvx-card cursor-pointer ${c.statutUnifie === "suspendu" ? "is-archived" : ""}`}
              onClick={() => navigate({ to: "/admin/convoyeurs/$convoyeurId", params: { convoyeurId: c.id } })}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <StatutConvoyeurBadge statut={c.statutUnifie} />
                  <span className="dvx-badge violet">Indépendant</span>
                  <span className="text-[11.5px] text-[#a3a4ac]">
                    Inscrit le {new Date(c.created_at).toLocaleDateString("fr-FR")}
                  </span>
                </div>
                <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-1.5 shrink-0">
                  <button type="button" className="dvx-ico" title="Aperçu rapide" onClick={() => setSelected(c)}>
                    <Eye size={15} />
                  </button>
                  {c.statutUnifie !== "valide" && c.statutUnifie !== "suspendu" && (
                    <>
                      <button type="button" className="dvx-ico" title="Valider" onClick={() => updateStatut(c.id, "valide")}>
                        <CheckCircle size={15} />
                      </button>
                      <button
                        type="button"
                        className="dvx-ico danger"
                        title="Refuser"
                        onClick={async () => {
                          const motif = window.prompt("Motif du refus (optionnel) :") ?? undefined;
                          if (motif === null) return;
                          await updateStatut(c.id, "refuse", motif || undefined);
                        }}
                      >
                        <XCircle size={15} />
                      </button>
                    </>
                  )}
                  {c.statutUnifie !== "suspendu" && c.user_id && (
                    <button
                      type="button"
                      className="dvx-ico danger"
                      title="Suspendre"
                      disabled={busy === c.id}
                      onClick={() => suspendConvoyeur(c)}
                    >
                      <Ban size={15} />
                    </button>
                  )}
                  {c.statutUnifie === "suspendu" && c.user_id && (
                    <button
                      type="button"
                      className="dvx-ico"
                      title="Réactiver"
                      disabled={busy === c.id}
                      onClick={() => reactivateConvoyeur(c)}
                    >
                      <RotateCcw size={15} />
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <div className="flex items-start gap-3 min-w-0">
                  <DriverAvatar convoyeurId={c.id} name={`${c.prenom ?? ""} ${c.nom ?? ""}`.trim()} size="sm" />
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-bold text-[#14161c] truncate">
                      {c.prenom} {c.nom}
                    </p>
                    <p className="mt-1 text-[11.5px] text-[#70727d] truncate">{c.email}</p>
                  </div>
                </div>

                <div className="min-w-0">
                  <p className="dvx-col-k">Contact</p>
                  <p className="text-[12.5px] text-[#14161c]">{c.email}</p>
                  {c.telephone && <p className="mt-0.5 text-[11.5px] text-[#70727d]">{c.telephone}</p>}
                  {c.ville && <p className="mt-0.5 text-[11.5px] text-[#a3a4ac]">{c.ville}</p>}
                </div>

                <div className="min-w-0">
                  <p className="dvx-col-k">Documents</p>
                  <span className="dvx-tag">
                    {c.docsApprouves}/{c.type_convoyeur === "independant" ? 6 : c.docsCount || 0} approuvés
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}


      {/* Drawer bleu — aperçu rapide */}
      {selected && (
        <AdminDetailDrawer
          open={!!selected}
          onClose={() => setSelected(null)}
          title={`${selected.prenom} ${selected.nom}`}
          subtitle={selected.email}
          badge={
            <div className="flex flex-wrap gap-2">
              <StatutConvoyeurBadge statut={resolveStatutConvoyeur(selected.statut, docs)} />
              <DrawerBadge tone="slate">Indépendant</DrawerBadge>
            </div>
          }
          footer={
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  const id = selected.id;
                  setSelected(null);
                  navigate({ to: "/admin/convoyeurs/$convoyeurId", params: { convoyeurId: id } });
                }}
                className="bg-pro-accent hover:bg-pro-accent/90 text-white"
              >
                Ouvrir la fiche complète
              </Button>
              {resolveStatutConvoyeur(selected.statut, docs) !== "valide" &&
                resolveStatutConvoyeur(selected.statut, docs) !== "suspendu" && (
                <>
                  <Button
                    onClick={() => { updateStatut(selected.id, "valide"); setSelected(null); }}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white"
                    icon={<CheckCircle size={14} />}
                  >
                    Valider
                  </Button>
                  <Button
                    onClick={async () => {
                      const motif = window.prompt("Motif du refus (optionnel) :") ?? undefined;
                      if (motif === null) return;
                      await updateStatut(selected.id, "refuse", motif || undefined);
                      setSelected(null);
                    }}
                    className="bg-red-500 hover:bg-red-600 text-white"
                    icon={<XCircle size={14} />}
                  >
                    Refuser
                  </Button>
                </>
              )}
            </div>
          }
        >
          <DrawerSection title="Contact" icon={<User size={12} />}>
            <DrawerGrid>
              <DrawerField label="Prénom" value={selected.prenom} />
              <DrawerField label="Nom" value={selected.nom} />
              <DrawerField label="Email" value={selected.email} />
              <DrawerField label="Téléphone" value={selected.telephone} />
              <DrawerField label="Ville" value={selected.ville} />
              <DrawerField label="Disponibilité" value={selected.disponibilite} />
            </DrawerGrid>
          </DrawerSection>

          <DrawerSection title="Activité" icon={<MapPin size={12} />}>
            <DrawerGrid>
              <DrawerField label="Missions totales" value={missionsCount.toString()} />
              <DrawerField label="Permis" value={selected.permis} />
              <DrawerField label="Inscrit le" value={new Date(selected.created_at).toLocaleDateString("fr-FR")} />
            </DrawerGrid>
          </DrawerSection>

          <DrawerSection title={`Documents (${docs.length})`} icon={<FileText size={12} />}>
            {docs.length === 0 ? (
              <p className="text-sm text-slate-500">Aucun document fourni.</p>
            ) : (
              <div className="space-y-2">
                {docs.map((d, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-900 font-medium capitalize">{d.type_document}</p>
                      <p className="text-[11px] text-slate-500 truncate">{d.nom_fichier}</p>
                    </div>
                    <DrawerBadge tone={d.statut_validation === "approuve" ? "green" : d.statut_validation === "refuse" ? "red" : "amber"}>
                      {d.statut_validation}
                    </DrawerBadge>
                  </div>
                ))}
              </div>
            )}
          </DrawerSection>

          {selected.message && (
            <DrawerSection title="Message d'inscription" icon={<Mail size={12} />}>
              <p className="text-sm text-slate-800 whitespace-pre-wrap">{selected.message}</p>
            </DrawerSection>
          )}
        </AdminDetailDrawer>
      )}


      {/* Modal création */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Nouveau convoyeur"
        size="md"
      >
        {createError && (
          <div className="mb-3 p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm">
            {createError}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Prénom" required>
            <TextInput
              value={form.prenom}
              onChange={(e) => setForm({ ...form, prenom: e.target.value })}
            />
          </FormField>
          <FormField label="Nom" required>
            <TextInput
              value={form.nom}
              onChange={(e) => setForm({ ...form, nom: e.target.value })}
            />
          </FormField>
          <FormField label="Email" required>
            <TextInput
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </FormField>
          <FormField label="Téléphone">
            <TextInput
              value={form.telephone}
              onChange={(e) => setForm({ ...form, telephone: e.target.value })}
            />
          </FormField>
          <div className="col-span-2">
            <FormField label="Mot de passe" required>
              <TextInput
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </FormField>
          </div>
        </div>
        <Button
          className="w-full mt-4"
          onClick={createConvoyeur}
          disabled={creating}
          icon={<UserPlus size={14} />}
        >
          {creating ? "Création..." : "Créer le compte"}
        </Button>
      </Modal>

      {/* Modal invitation convoyeur */}
      <Modal open={showInvite} onClose={() => setShowInvite(false)} title="Ajouter un convoyeur">
        <p className="text-sm text-pro-text-soft mb-4">
          Le convoyeur reçoit un email d'invitation avec un lien personnel pour créer son compte
          et finaliser son profil.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Prénom">
            <TextInput
              value={inviteForm.prenom}
              onChange={(e) => setInviteForm({ ...inviteForm, prenom: e.target.value })}
              placeholder="Jean"
            />
          </FormField>
          <FormField label="Nom">
            <TextInput
              value={inviteForm.nom}
              onChange={(e) => setInviteForm({ ...inviteForm, nom: e.target.value })}
              placeholder="Dupont"
            />
          </FormField>
        </div>
        <div className="mt-3">
          <FormField label="Email" required>
            <TextInput
              type="email"
              value={inviteForm.email}
              onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
              placeholder="jean.dupont@email.fr"
            />
          </FormField>
        </div>
        <div className="mt-3">
          <FormField label="Téléphone">
            <TextInput
              value={inviteForm.telephone}
              onChange={(e) => setInviteForm({ ...inviteForm, telephone: e.target.value })}
              placeholder="06 12 34 56 78"
            />
          </FormField>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="secondary" onClick={() => setShowInvite(false)}>
            Annuler
          </Button>
          <Button icon={<Send size={14} />} onClick={createInvitation} disabled={inviting}>
            {inviting ? "Envoi..." : "Envoyer l'invitation"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
