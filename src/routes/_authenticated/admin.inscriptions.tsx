import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Fragment, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  RefreshCw, Check, X, AlertTriangle, Mail, FileCheck2, Bell, Loader2, Search,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/inscriptions")({
  component: AdminInscriptions,
  head: () => ({
    meta: [
      { title: "Suivi des inscriptions — Admin Ligneo" },
      { name: "description", content: "Journal des inscriptions : documents reçus, e-mails envoyés, notifications et horodatage." },
    ],
  }),
});

interface EmailLog { template: string; recipient: string; status: string; code?: string; at: string }
interface RejectedDoc { type: string; reason: string; detail?: string }

interface SignupEvent {
  id: string;
  user_id: string | null;
  email: string | null;
  full_name: string | null;
  kind: string;
  documents_expected: number;
  documents_uploaded: number;
  documents_rejected: RejectedDoc[] | null;
  emails: EmailLog[] | null;
  notification_created: boolean;
  status: string;
  error_message: string | null;
  created_at: string;
}

const KIND_LABEL: Record<string, string> = {
  convoyeur: "Convoyeur",
  client: "Client particulier",
  pro: "Pro (B2B)",
  flotte: "Flotte",
};

const REASON_LABEL: Record<string, string> = {
  file_too_large: "Fichier trop lourd (> 5 Mo)",
  unsupported_type: "Format non supporté",
  too_many_files: "Trop de fichiers",
  storage_error: "Erreur de stockage",
};

function fmt(d: string) {
  return new Date(d).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    ok: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
    partial: "bg-amber-500/15 text-amber-600 border-amber-500/30",
    failed: "bg-red-500/15 text-red-600 border-red-500/30",
    pending: "bg-slate-500/15 text-slate-600 border-slate-500/30",
  };
  const label: Record<string, string> = { ok: "Complet", partial: "Partiel", failed: "Échec", pending: "En cours" };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold uppercase tracking-wider ${map[status] ?? map['pending']}`}>
      {status === "ok" ? <Check size={10} /> : status === "failed" ? <X size={10} /> : <AlertTriangle size={10} />}
      {label[status] ?? status}
    </span>
  );
}

function AdminInscriptions() {
  const [kind, setKind] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["signup-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("signup_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as SignupEvent[];
    },
  });

  const rows = (data ?? []).filter((r) => {
    if (kind !== "all" && r.kind !== kind) return false;
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!`${r.email ?? ""} ${r.full_name ?? ""}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const stats = {
    total: rows.length,
    ok: rows.filter((r) => r.status === "ok").length,
    issues: rows.filter((r) => r.status !== "ok").length,
    emailsFailed: rows.reduce((n, r) => n + (r.emails ?? []).filter((e) => e.status === "failed").length, 0),
  };

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        breadcrumb="Inscriptions"
        eyebrow="Onboarding"
        title="Suivi des"
        highlight="inscriptions"
        subtitle="Documents reçus, e-mails envoyés, notification admin et horodatage."
        actions={
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 rounded-[9px] border border-[#eaeaee] bg-white px-4 py-2.5 text-[12.5px] font-semibold text-[#70727d] transition-colors hover:border-[#dedee4] hover:text-[#14161c]"
          >
            {isFetching ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Actualiser
          </button>
        }
      />


      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Inscriptions", value: stats.total },
          { label: "Complètes", value: stats.ok },
          { label: "À vérifier", value: stats.issues },
          { label: "E-mails en échec", value: stats.emailsFailed },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-pro-border bg-white p-4">
            <p className="text-[10px] uppercase tracking-wider text-pro-muted">{s.label}</p>
            <p className="text-2xl font-bold text-pro-text mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-pro-muted" />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher e-mail ou nom"
            className="pl-9 pr-3 py-2 rounded-xl border border-pro-border text-sm bg-white min-w-[220px]"
          />
        </div>
        <select value={kind} onChange={(e) => setKind(e.target.value)} className="px-3 py-2 rounded-xl border border-pro-border text-sm bg-white">
          <option value="all">Tous les types</option>
          {Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 rounded-xl border border-pro-border text-sm bg-white">
          <option value="all">Tous les statuts</option>
          <option value="ok">Complet</option>
          <option value="partial">Partiel</option>
          <option value="failed">Échec</option>
        </select>
      </div>

      <div className="rounded-2xl border border-pro-border bg-white overflow-hidden">
        {isLoading ? (
          <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-pro-muted" /></div>
        ) : rows.length === 0 ? (
          <p className="p-10 text-center text-sm text-pro-muted">Aucune inscription enregistrée pour ces filtres.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-pro-bg-soft/60 text-[10px] uppercase tracking-wider text-pro-muted">
              <tr>
                <th className="text-left px-4 py-3">Inscription</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-left px-4 py-3">Documents</th>
                <th className="text-left px-4 py-3">E-mails</th>
                <th className="text-left px-4 py-3">Notification</th>
                <th className="text-left px-4 py-3">Statut</th>
                <th className="text-left px-4 py-3">Horodatage</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const failed = (r.emails ?? []).filter((e) => e.status === "failed").length;
                const isOpen = open === r.id;
                return (
                  <Fragment key={r.id}>
                    <tr
                      onClick={() => setOpen(isOpen ? null : r.id)}
                      className="border-t border-pro-border cursor-pointer hover:bg-pro-bg-soft/40"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-pro-text">{r.full_name || "—"}</p>
                        <p className="text-xs text-pro-muted">{r.email}</p>
                      </td>
                      <td className="px-4 py-3 text-pro-text">{KIND_LABEL[r.kind] ?? r.kind}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-xs">
                          <FileCheck2 size={12} className={r.documents_uploaded === r.documents_expected ? "text-emerald-600" : "text-amber-600"} />
                          {r.documents_uploaded}/{r.documents_expected}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs ${failed ? "text-red-600" : "text-emerald-600"}`}>
                          <Mail size={12} /> {(r.emails ?? []).length - failed}/{(r.emails ?? []).length}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs ${r.notification_created ? "text-emerald-600" : "text-red-600"}`}>
                          <Bell size={12} /> {r.notification_created ? "Créée" : "Absente"}
                        </span>
                      </td>
                      <td className="px-4 py-3"><StatusPill status={r.status} /></td>
                      <td className="px-4 py-3 text-xs text-pro-muted whitespace-nowrap">{fmt(r.created_at)}</td>
                    </tr>
                    {isOpen && (
                      <tr className="border-t border-pro-border bg-pro-bg-soft/30">
                        <td colSpan={7} className="px-4 py-4 space-y-3">
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-pro-muted mb-1">Détail des e-mails</p>
                            {(r.emails ?? []).length === 0 ? (
                              <p className="text-xs text-pro-muted">Aucun e-mail envoyé.</p>
                            ) : (
                              <ul className="space-y-1">
                                {(r.emails ?? []).map((e, i) => (
                                  <li key={i} className="text-xs flex flex-wrap items-center gap-2">
                                    <span className={e.status === "sent" ? "text-emerald-600" : "text-red-600"}>
                                      {e.status === "sent" ? "✓" : "✕"}
                                    </span>
                                    <span className="font-mono">{e.template}</span>
                                    <span className="text-pro-muted">→ {e.recipient}</span>
                                    {e.code && <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-600 font-mono">code: {e.code}</span>}
                                    <span className="text-pro-muted">{fmt(e.at)}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                          {(r.documents_rejected ?? []).length > 0 && (
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-pro-muted mb-1">Documents refusés</p>
                              <ul className="space-y-1">
                                {(r.documents_rejected ?? []).map((d, i) => (
                                  <li key={i} className="text-xs text-amber-700">
                                    {d.type} — {REASON_LABEL[d.reason] ?? d.reason}{d.detail ? ` (${d.detail})` : ""}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {r.error_message && (
                            <p className="text-xs text-red-600">Erreur serveur : {r.error_message}</p>
                          )}
                          <div className="flex flex-wrap gap-3 text-xs">
                            <a href="/admin/convoyeurs" className="underline text-pro-text">Voir les convoyeurs</a>
                            <a href="/admin/clients" className="underline text-pro-text">Voir les clients</a>
                            <a href="/admin/notifications" className="underline text-pro-text">Notifications admin</a>
                            {r.user_id && <span className="text-pro-muted font-mono">user_id : {r.user_id}</span>}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
