/**
 * Admin notifications — centre de notifications réorganisé.
 * Vue "boîte de réception" : compteurs, familles (Demandes, Opérations,
 * Comptes, Finance), recherche, regroupement par jour, actions rapides.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Bell, Loader2, CheckCheck, Search, Inbox, AlertTriangle, Clock, Check, X, Phone, Mail, ArrowRight,
} from "lucide-react";
import { PlateBadge } from "@/components/plate/PlateBadge";
import { useNotifContexte, type NotifContexte } from "@/lib/admin-notification-contexte";
import { toast } from "sonner";
import { NotificationSettingsPanel } from "@/components/admin/NotificationSettingsPanel";
import {
  AdminPageHeader, AdminSection, AdminStatCard, AdminEmpty,
} from "@/components/admin/ui";
import {
  FAMILLES, dayLabel, familleOf, notifMeta, relativeTime,
  type NotifFamille,
} from "@/lib/admin-notification-taxonomy";

export const Route = createFileRoute("/_authenticated/admin/notifications")({
  component: AdminNotifications,
});

interface Notification {
  id: string;
  type: string;
  titre: string;
  message: string | null;
  link: string | null;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  lu: boolean;
  created_at: string;
}

type CatFilter = "all" | NotifFamille;

function AdminNotifications() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<CatFilter>("all");
  const [onlyUnread, setOnlyUnread] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"feed" | "settings">("feed");

  const fetchData = useCallback(async () => {
    const { data } = await supabase
      .from("admin_notifications" as never)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    setItems((data as unknown as Notification[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  useEffect(() => {
    const channel = supabase
      .channel("admin-notifications-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_notifications" }, () => { void fetchData(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [fetchData]);

  // noms, téléphones, missions, trajets, plaques, montants des notifications
  const ctx = useNotifContexte(items);

  /* ---------- compteurs ---------- */
  const stats = useMemo(() => {
    const unread = items.filter((n) => !n.lu);
    const today = items.filter((n) => dayLabel(n.created_at) === "Aujourd'hui");
    const critical = unread.filter((n) => notifMeta(n.type).tone === "danger");
    const demandes = unread.filter((n) => notifMeta(n.type).category === "demandes");
    return { unread: unread.length, today: today.length, critical: critical.length, demandes: demandes.length };
  }, [items]);

  const countsByCategory = useMemo(() => {
    const map: Record<string, number> = { all: 0 };
    for (const n of items) {
      if (onlyUnread && n.lu) continue;
      map.all += 1;
      const c = familleOf(n).key;
      map[c] = (map[c] ?? 0) + 1;
    }
    return map;
  }, [items, onlyUnread]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((n) => {
      if (onlyUnread && n.lu) return false;
      if (category !== "all" && familleOf(n).key !== category) return false;
      if (!q) return true;
      const c = ctx[n.id];
      return [n.titre, n.message, notifMeta(n.type).label, c?.qui, c?.email, c?.telephone, c?.plaque, ...(c?.details ?? []).map((d) => d.value)]
        .some((v) => String(v ?? "").toLowerCase().includes(q));
    });
  }, [items, category, onlyUnread, search, ctx]);

  const grouped = useMemo(() => {
    const groups: { label: string; rows: Notification[] }[] = [];
    for (const n of filtered) {
      const label = dayLabel(n.created_at);
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.rows.push(n);
      else groups.push({ label, rows: [n] });
    }
    return groups;
  }, [filtered]);

  /* ---------- actions ---------- */
  const markRead = async (ids: string[], lu = true) => {
    if (ids.length === 0) return;
    setItems((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, lu } : n)));
    const { error } = await supabase
      .from("admin_notifications" as never)
      .update({ lu, lu_at: lu ? new Date().toISOString() : null } as never)
      .in("id" as never, ids as never);
    if (error) {
      toast.error("Mise à jour impossible", { description: error.message });
      void fetchData();
    }
  };

  const markAllVisible = () => {
    const ids = filtered.filter((n) => !n.lu).map((n) => n.id);
    if (ids.length === 0) { toast.info("Rien à marquer ici."); return; }
    void markRead(ids);
    toast.success(`${ids.length} notification${ids.length > 1 ? "s" : ""} marquée${ids.length > 1 ? "s" : ""} comme lue${ids.length > 1 ? "s" : ""}`);
  };

  return (
    <div className="space-y-5">
      <AdminPageHeader
        eyebrow="Centre de notifications"
        title="Notifications"
        subtitle={
          stats.unread > 0
            ? `${stats.unread} non lue${stats.unread > 1 ? "s" : ""} · ${stats.today} aujourd'hui`
            : "Tout est à jour."
        }
        breadcrumb={[{ label: "Admin", to: "/admin" }, { label: "Notifications" }]}
        actions={
          <button onClick={markAllVisible} className="admin-btn-ghost inline-flex items-center gap-1.5">
            <CheckCheck size={14} /> Tout marquer comme lu
          </button>
        }
      />

      <div className="flex items-center gap-1 admin-card p-1.5 w-fit">
        {([["feed", "Flux"], ["settings", "Réglages"]] as const).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
              tab === k
                ? "bg-[#2F5FFF] text-white"
                : "text-[color:var(--admin-muted)] hover:bg-[color:var(--admin-bg-soft)]"
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {tab === "settings" ? (
        <NotificationSettingsPanel />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <AdminStatCard label="Non lues" value={stats.unread} icon={Bell} accent={stats.unread ? "info" : "default"} />
            <AdminStatCard label="Reçues aujourd'hui" value={stats.today} icon={Clock} />
            <AdminStatCard label="Demandes en attente" value={stats.demandes} icon={Inbox} accent="warning" hint={<Link to="/admin/demandes" className="text-[#2F5FFF] font-semibold">Ouvrir les demandes →</Link>} />
            <AdminStatCard label="Alertes critiques" value={stats.critical} icon={AlertTriangle} accent={stats.critical ? "danger" : "default"} />
          </div>

          <AdminSection>
            {/* Barre de filtres */}
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative flex-1 min-w-[220px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--admin-muted)]" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher une notification…"
                  className="w-full pl-9 pr-8 py-2 rounded-lg border border-[color:var(--admin-border)] bg-[color:var(--admin-surface)] text-sm focus:outline-none focus:border-[#2F5FFF]"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-[color:var(--admin-muted)] hover:text-[color:var(--admin-text)]">
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1 rounded-lg border border-[color:var(--admin-border)] p-1">
                {([[true, "Non lues"], [false, "Tout l'historique"]] as const).map(([v, l]) => (
                  <button
                    key={String(v)}
                    onClick={() => setOnlyUnread(v)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                      onlyUnread === v ? "bg-[#2F5FFF] text-white" : "text-[color:var(--admin-muted)] hover:bg-[color:var(--admin-bg-soft)]"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Familles : une couleur par sujet */}
            <div className="mt-3 flex flex-wrap gap-2 border-t border-[color:var(--admin-border)] pt-3">
              {([{ key: "all" as const, label: "Tout", c1: "#2f5fff", c2: "#5de0ff", soft: "#ebf0ff", ink: "#1f3fcc" }, ...FAMILLES]).map((f) => {
                const count = countsByCategory[f.key] ?? 0;
                const active = category === f.key;
                if (f.key !== "all" && count === 0 && !active) return null;
                return (
                  <button key={f.key} onClick={() => setCategory(f.key as CatFilter)}
                    className={`ntf-fam${active ? " on" : ""}`}
                    style={{ ["--c1" as string]: f.c1, ["--c2" as string]: f.c2, ["--soft" as string]: f.soft, ["--ink" as string]: f.ink }}>
                    <i aria-hidden />{f.label}<b>{count}</b>
                  </button>
                );
              })}
            </div>

            {/* Liste */}
            <div className="mt-4">
              {loading ? (
                <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#2F5FFF]" size={24} /></div>
              ) : grouped.length === 0 ? (
                <AdminEmpty
                  icon={Bell}
                  title={onlyUnread ? "Aucune notification non lue" : "Aucune notification"}
                  description={onlyUnread ? "Basculez sur « Tout l'historique » pour consulter les anciennes." : "Les évènements de la plateforme s'afficheront ici."}
                />
              ) : (
                <div className="space-y-5">
                  {grouped.map((g) => (
                    <div key={g.label}>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--admin-muted)]">{g.label}</span>
                        <span className="h-px flex-1 bg-[color:var(--admin-border)]" />
                        <span className="text-[11px] text-[color:var(--admin-muted)] tabular-nums">{g.rows.length}</span>
                      </div>
                      <ul className="space-y-2.5">
                        {g.rows.map((n) => (
                          <NotifRow key={n.id} n={n} c={ctx[n.id]} onToggleRead={(lu) => void markRead([n.id], lu)} onOpen={async () => { if (!n.lu) await markRead([n.id]); }} />
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </AdminSection>
        </>
      )}
    </div>
  );
}

function NotifRow({ n, c, onToggleRead, onOpen }: { n: Notification; c?: NotifContexte; onToggleRead: (lu: boolean) => void; onOpen: () => Promise<void> }) {
  const meta = notifMeta(n.type);
  const f = familleOf(n);
  const Icon = meta.icon;
  const initiales = (c?.qui ?? "").split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]?.toUpperCase()).join("");
  const role = c?.role === "convoyeur" ? "Convoyeur" : c?.role === "client" ? "Client" : c?.role === "visiteur" ? "Visiteur" : null;

  return (
    <li className={`ntf-card${n.lu ? " lu" : ""}`}
      style={{ ["--c1" as string]: f.c1, ["--c2" as string]: f.c2, ["--soft" as string]: f.soft, ["--ink" as string]: f.ink }}>
      <span className="ntf-av">
        {c?.avatar ? <img src={c.avatar} alt="" /> : initiales ? <em>{initiales}</em> : <Icon size={18} />}
        {!n.lu && <span className="ntf-dot" aria-label="Non lue" />}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="ntf-chip">{f.label}</span>
          <span className="ntf-type">{meta.label}</span>
          <span className="ntf-time" title={new Date(n.created_at).toLocaleString("fr-FR")}>
            {relativeTime(n.created_at)} · {new Date(n.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
        <p className="ntf-title">{n.titre}</p>
        {c?.qui && (
          <p className="ntf-who">
            {c.qui}{role && <span className="ntf-role">{role}</span>}
          </p>
        )}
        {n.message && <p className="ntf-msg">{n.message}</p>}
        {(c?.details.length || c?.plaque || c?.telephone || c?.email) ? (
          <div className="ntf-meta">
            {c?.plaque && <PlateBadge plate={c.plaque} size="sm" />}
            {c?.details.map((d) => <span key={d.label + d.value} className="ntf-pill"><small>{d.label}</small>{d.value}</span>)}
            {c?.telephone && <a href={`tel:${c.telephone.replace(/\s/g, "")}`} className="ntf-pill ntf-link"><Phone size={12} />{c.telephone}</a>}
            {c?.email && <a href={`mailto:${c.email}`} className="ntf-pill ntf-link"><Mail size={12} />{c.email}</a>}
          </div>
        ) : null}
      </div>

      <div className="ntf-actions">
        {n.link && n.link.startsWith("/") && (
          <a href={n.link} onClick={(e) => { e.preventDefault(); const to = n.link!; void onOpen().finally(() => window.location.assign(to)); }} className="ntf-open">Ouvrir <ArrowRight size={14} /></a>
        )}
        <button onClick={() => onToggleRead(!n.lu)} title={n.lu ? "Marquer comme non lue" : "Marquer comme lue"} className="ntf-read">
          {n.lu ? <Bell size={15} /> : <Check size={16} />}
        </button>
      </div>
    </li>
  );
}
