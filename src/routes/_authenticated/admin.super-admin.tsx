import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Crown, Shield, ShieldOff, Search, History, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Card, Button, FormField, TextInput, Badge } from "@/components/admin/AdminUI";
import {
  verifySuperAdminAccess,
  listPrivilegedUsers,
  listSecurityAudit,
  superAdminSetRole,
  findUserByEmail,
} from "@/lib/super-admin.functions";

export const Route = createFileRoute("/_authenticated/admin/super-admin")({
  beforeLoad: async () => {
    try {
      await verifySuperAdminAccess();
    } catch {
      throw redirect({ to: "/admin" });
    }
  },
  component: SuperAdminPage,
});

type SensitiveRole = "super_admin" | "admin" | "manager";
const ROLE_LABEL: Record<SensitiveRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  manager: "Manager",
};
const ROLE_BADGE_CLASS: Record<SensitiveRole, string> = {
  super_admin: "bg-purple-100 text-purple-800 border-purple-300",
  admin: "bg-blue-100 text-blue-800 border-blue-300",
  manager: "bg-slate-100 text-slate-700 border-slate-300",
};

function SuperAdminPage() {
  const qc = useQueryClient();
  const list = useServerFn(listPrivilegedUsers);
  const audit = useServerFn(listSecurityAudit);
  const setRole = useServerFn(superAdminSetRole);
  const findUser = useServerFn(findUserByEmail);

  const users = useQuery({ queryKey: ["super-admin", "privileged-users"], queryFn: () => list() });
  const auditQ = useQuery({ queryKey: ["super-admin", "audit"], queryFn: () => audit() });

  const [email, setEmail] = useState("");
  const [foundUser, setFoundUser] = useState<{ user_id: string; email: string | null; nom: string | null; prenom: string | null } | null>(null);
  const [searching, setSearching] = useState(false);

  const roleMutation = useMutation({
    mutationFn: async (v: { target_user_id: string; role: SensitiveRole; actif: boolean }) => setRole({ data: v }),
    onSuccess: () => {
      toast.success("Rôle mis à jour.");
      qc.invalidateQueries({ queryKey: ["super-admin"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Échec de la mise à jour"),
  });

  const handleSearch = async () => {
    if (!email) return;
    setSearching(true);
    try {
      const res = await findUser({ data: { email } });
      if (!res) toast.error("Aucun utilisateur trouvé pour cet email");
      setFoundUser(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur de recherche");
    } finally {
      setSearching(false);
    }
  };

  const counts = useMemo(() => {
    const list = users.data ?? [];
    let sa = 0, ad = 0, mg = 0;
    for (const u of list) {
      for (const r of u.roles) {
        if (!r.actif) continue;
        if (r.role === "super_admin") sa++;
        else if (r.role === "admin") ad++;
        else if (r.role === "manager") mg++;
      }
    }
    return { sa, ad, mg, events: (auditQ.data ?? []).length };
  }, [users.data, auditQ.data]);

  return (
    <div className="space-y-6" data-org-theme="super_admin">
      {/* === HERO Super Admin (v3 aurora violet) === */}
      <section className="v3-aurora relative overflow-hidden rounded-2xl border border-purple-500/20 bg-gradient-to-br from-[#1a0b2e] via-[#2a1150] to-[#0b1026] px-6 py-8 md:px-8 md:py-10 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(168,85,247,0.35),transparent_55%)] pointer-events-none" />
        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0 space-y-3">
            <div className="v3-eyebrow inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-purple-200/90">
              <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-purple-300 opacity-75" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-purple-300" /></span>
              Zone de contrôle privilégiée
            </div>
            <h1 className="font-[Playfair_Display,serif] text-3xl md:text-4xl font-semibold tracking-tight">
              Super Admin
            </h1>
            <p className="text-sm text-purple-100/75 max-w-2xl">
              Gestion des rôles sensibles et journal d'audit sécurité. Chaque action est tracée et immuable.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-purple-300/40 bg-purple-500/15 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.22em] text-purple-100">
            <Crown size={13} className="text-purple-200" /> Niveau maximum
          </div>
        </div>

        <div className="relative mt-8 grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Super Admins", value: counts.sa, tone: "from-purple-500/20 to-purple-500/5 border-purple-400/30" },
            { label: "Admins", value: counts.ad, tone: "from-blue-500/20 to-blue-500/5 border-blue-400/30" },
            { label: "Managers", value: counts.mg, tone: "from-slate-400/20 to-slate-400/5 border-slate-300/30" },
            { label: "Événements audit", value: counts.events, tone: "from-amber-400/20 to-amber-400/5 border-amber-300/30" },
          ].map((k) => (
            <div key={k.label} className={`rounded-xl border bg-gradient-to-br ${k.tone} px-4 py-3 backdrop-blur-sm`}>
              <div className="text-[10px] uppercase tracking-[0.22em] text-purple-100/70">{k.label}</div>
              <div className="mt-1 font-[Space_Grotesk,sans-serif] text-2xl font-semibold text-white tabular-nums">{k.value}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Ajouter un rôle via email */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <UserPlus size={16} className="text-purple-700" />
          <h3 className="font-semibold text-pro-text">Attribuer un rôle à un utilisateur</h3>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <FormField label="Email de l'utilisateur">
            <TextInput
              type="email"
              value={email}
              onChange={(e) => setEmail((e.target as HTMLInputElement).value)}
              placeholder="user@exemple.fr"
            />
          </FormField>
          <div className="flex items-end">
            <Button onClick={handleSearch} disabled={!email || searching}>
              {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              Rechercher
            </Button>
          </div>
        </div>
        {foundUser && (
          <div className="mt-4 border border-purple-200 bg-purple-50 rounded-lg p-4">
            <div className="text-sm">
              <div className="font-semibold text-purple-900">
                {foundUser.prenom} {foundUser.nom}
              </div>
              <div className="text-purple-800/80">{foundUser.email}</div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {(["super_admin", "admin", "manager"] as SensitiveRole[]).map((r) => (
                <Button
                  key={r}
                  variant="secondary"
                  onClick={() => roleMutation.mutate({ target_user_id: foundUser.user_id, role: r, actif: true })}
                  disabled={roleMutation.isPending}
                >
                  <Shield size={14} /> Accorder {ROLE_LABEL[r]}
                </Button>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Liste des utilisateurs privilégiés */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Crown size={16} className="text-purple-700" />
          <h3 className="font-semibold text-pro-text">Utilisateurs privilégiés</h3>
        </div>
        {users.isLoading ? (
          <div className="text-sm text-pro-muted flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Chargement…</div>
        ) : grouped.length === 0 ? (
          <div className="text-sm text-pro-muted">Aucun utilisateur avec rôle privilégié.</div>
        ) : (
          <div className="divide-y divide-pro-border">
            {grouped.map((u) => (
              <div key={u.user_id} className="py-3 flex items-center justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="font-medium text-pro-text truncate">{u.prenom} {u.nom}</div>
                  <div className="text-xs text-pro-muted truncate">{u.email ?? u.user_id}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {u.roles.map((r) => {
                      const key = r.role as SensitiveRole;
                      return (
                        <span
                          key={r.role}
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${ROLE_BADGE_CLASS[key] ?? "bg-slate-100 text-slate-700 border-slate-300"} ${r.actif ? "" : "opacity-50 line-through"}`}
                        >
                          {ROLE_LABEL[key] ?? r.role}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(["super_admin", "admin", "manager"] as SensitiveRole[]).map((r) => {
                    const existing = u.roles.find((x) => x.role === r);
                    const active = existing?.actif === true;
                    return (
                      <Button
                        key={r}
                        variant={active ? "danger" : "secondary"}
                        onClick={() => roleMutation.mutate({ target_user_id: u.user_id, role: r, actif: !active })}
                        disabled={roleMutation.isPending}
                      >
                        {active ? <ShieldOff size={14} /> : <Shield size={14} />}
                        {active ? `Retirer ${ROLE_LABEL[r]}` : `Accorder ${ROLE_LABEL[r]}`}
                      </Button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Journal d'audit */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <History size={16} className="text-purple-700" />
          <h3 className="font-semibold text-pro-text">Journal d'audit sécurité (100 derniers)</h3>
        </div>
        {auditQ.isLoading ? (
          <div className="text-sm text-pro-muted flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Chargement…</div>
        ) : (auditQ.data ?? []).length === 0 ? (
          <div className="text-sm text-pro-muted">Aucun événement enregistré.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-pro-muted border-b border-pro-border">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Action</th>
                  <th className="py-2 pr-3">Cible</th>
                  <th className="py-2 pr-3">Détails</th>
                </tr>
              </thead>
              <tbody>
                {(auditQ.data ?? []).map((ev) => (
                  <tr key={ev.id} className="border-b border-pro-border/50">
                    <td className="py-2 pr-3 text-pro-muted whitespace-nowrap">
                      {new Date(ev.created_at as string).toLocaleString("fr-FR")}
                    </td>
                    <td className="py-2 pr-3"><Badge tone="info">{ev.action as string}</Badge></td>
                    <td className="py-2 pr-3 font-mono text-[11px] text-pro-text-soft">{(ev.target_user_id as string) ?? "—"}</td>
                    <td className="py-2 pr-3 font-mono text-[11px] text-pro-text-soft">
                      {JSON.stringify(ev.details ?? {})}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
