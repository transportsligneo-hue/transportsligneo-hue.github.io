import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bell, Mail, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentOrgAccountType } from "@/hooks/useCurrentOrgAccountType";
import { inviteTeamMember } from "@/lib/team.functions";
import { HelpTip } from "@/components/dashboard-pro/HelpTip";

export const Route = createFileRoute("/_authenticated/dashboard-pro/equipe")({
  head: () => ({
    meta: [
      { title: "Équipe & alertes — Espace pro Transports Ligneo" },
      { name: "description", content: "Gérez les rôles de votre équipe, les invitations et les alertes reçues." },
    ],
  }),
  component: EquipePage,
});

const ROLES: Record<string, string> = {
  owner: "Administrateur", admin: "Administrateur", manager: "Logistique", member: "Logistique",
  logistique: "Logistique", comptabilite: "Comptabilité", viewer: "Comptabilité",
};
const ROLE_HELP = "Administrateur : tout gérer, y compris l'équipe. Logistique : commander et suivre les missions. Comptabilité : factures, devis et rapports.";

const ALERTS = [
  { key: "mission_creee", label: "Mission confirmée" },
  { key: "convoyeur_en_route", label: "Convoyeur en route" },
  { key: "livraison", label: "Véhicule livré" },
  { key: "anomalie_edl", label: "Nouveau dégât détecté à l'arrivée" },
  { key: "facture", label: "Nouvelle facture disponible" },
  { key: "documents_parc", label: "Documents du parc à renouveler" },
];

type Member = { id: string; user_id: string; member_role: string; email: string | null; nom: string | null; prenom: string | null };
type Invite = { id: string; email: string; role: string; status: string; expires_at: string };

function EquipePage() {
  const { user } = useAuth();
  const { data: org } = useCurrentOrgAccountType();
  const orgId = org?.orgId ?? null;
  const invite = useServerFn(inviteTeamMember);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "logistique" | "comptabilite">("logistique");
  const [sending, setSending] = useState(false);
  const [prefs, setPrefs] = useState<Record<string, { email: boolean; sms: boolean }>>({});

  const me = members.find((m) => m.user_id === user?.id);
  const isAdmin = me ? ["owner", "admin"].includes(me.member_role) : false;

  const load = useCallback(async () => {
    if (!orgId) return;
    const { data } = await supabase.rpc("list_org_members", { _org_id: orgId });
    setMembers((data ?? []) as Member[]);
    const { data: inv } = await supabase.from("org_invitations").select("id, email, role, status, expires_at").eq("organization_id", orgId).eq("status", "pending").order("created_at", { ascending: false });
    setInvites((inv ?? []) as Invite[]);
  }, [orgId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!user?.id) return;
    supabase.from("user_alert_preferences").select("prefs").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setPrefs((data?.prefs ?? {}) as Record<string, { email: boolean; sms: boolean }>));
  }, [user?.id]);

  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId) return;
    setSending(true);
    try {
      await invite({ data: { orgId, email, role, origin: window.location.origin } });
      toast.success(`Invitation envoyée à ${email}`);
      setEmail("");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Envoi impossible");
    } finally { setSending(false); }
  };

  const changeRole = async (m: Member, r: string) => {
    const { error } = await supabase.from("organization_members").update({ member_role: r }).eq("id", m.id);
    if (error) toast.error("Modification impossible"); else { toast.success("Rôle mis à jour"); load(); }
  };
  const revoke = async (id: string) => {
    await supabase.from("org_invitations").update({ status: "revoked" }).eq("id", id);
    load();
  };

  const togglePref = async (key: string, ch: "email" | "sms") => {
    if (!user?.id) return;
    const cur = prefs[key] ?? { email: true, sms: false };
    const next = { ...prefs, [key]: { ...cur, [ch]: !cur[ch] } };
    setPrefs(next);
    const { error } = await supabase.from("user_alert_preferences").upsert({ user_id: user.id, prefs: next, updated_at: new Date().toISOString() });
    if (error) toast.error("Préférence non enregistrée");
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <header>
        <h1 className="text-2xl font-semibold">Équipe & alertes</h1>
        <p className="text-sm text-muted-foreground">Qui a accès à votre espace, et quelles alertes vous recevez.</p>
      </header>

      <section className="mission-surface p-5 space-y-4">
        <h2 className="flex items-center gap-2 font-semibold"><Users size={16} /> Membres <HelpTip text={ROLE_HELP} /></h2>
        <ul className="divide-y divide-border">
          {members.map((m) => (
            <li key={m.id} className="py-2 flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>{[m.prenom, m.nom].filter(Boolean).join(" ") || m.email} <span className="text-muted-foreground">{m.email}</span></span>
              {isAdmin && m.user_id !== user?.id && m.member_role !== "owner" ? (
                <select className="pp-select" value={["owner","admin"].includes(m.member_role) ? "admin" : ROLES[m.member_role] === "Comptabilité" ? "comptabilite" : "logistique"} onChange={(e) => changeRole(m, e.target.value)}>
                  <option value="admin">Administrateur</option>
                  <option value="logistique">Logistique</option>
                  <option value="comptabilite">Comptabilité</option>
                </select>
              ) : <span className="pp-chip">{ROLES[m.member_role] ?? m.member_role}</span>}
            </li>
          ))}
        </ul>

        {isAdmin ? (
          <form onSubmit={sendInvite} className="flex flex-wrap gap-2 items-end pt-2 border-t border-border">
            <label className="flex-1 min-w-[220px] text-sm">E-mail du collaborateur
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="pp-input w-full mt-1" placeholder="prenom@societe.fr" />
            </label>
            <label className="text-sm">Rôle
              <select value={role} onChange={(e) => setRole(e.target.value as typeof role)} className="pp-select mt-1 block">
                <option value="admin">Administrateur</option>
                <option value="logistique">Logistique</option>
                <option value="comptabilite">Comptabilité</option>
              </select>
            </label>
            <button disabled={sending} className="pp-btn-primary inline-flex items-center gap-1.5"><Mail size={14} /> {sending ? "Envoi…" : "Inviter"}</button>
          </form>
        ) : <p className="text-xs text-muted-foreground">Seul un administrateur peut inviter ou modifier les rôles.</p>}

        {invites.length > 0 && (
          <div className="text-sm">
            <p className="font-medium mb-1">Invitations en attente</p>
            {invites.map((i) => (
              <div key={i.id} className="flex justify-between py-1">
                <span>{i.email} · {ROLES[i.role]} · expire le {new Date(i.expires_at).toLocaleDateString("fr-FR")}</span>
                {isAdmin && <button onClick={() => revoke(i.id)} className="text-destructive text-xs">Annuler</button>}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mission-surface p-5">
        <h2 className="flex items-center gap-2 font-semibold mb-3"><Bell size={16} /> Mes alertes <HelpTip text="Choisissez, pour chaque événement, si vous voulez être prévenu par e-mail et/ou par SMS." /></h2>
        <table className="w-full text-sm">
          <thead><tr className="text-muted-foreground text-left"><th className="py-1">Événement</th><th>E-mail</th><th>SMS</th></tr></thead>
          <tbody>
            {ALERTS.map((a) => {
              const p = prefs[a.key] ?? { email: true, sms: false };
              return (
                <tr key={a.key} className="border-t border-border">
                  <td className="py-2">{a.label}</td>
                  <td><input type="checkbox" checked={p.email} onChange={() => togglePref(a.key, "email")} /></td>
                  <td><input type="checkbox" checked={p.sms} onChange={() => togglePref(a.key, "sms")} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
