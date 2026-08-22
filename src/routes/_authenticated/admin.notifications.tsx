/**
 * Admin notifications — centre de notifications réorganisé.
 * Vue "boîte de réception" : compteurs, familles (Demandes, Opérations,
 * Comptes, Finance), recherche, regroupement par jour, actions rapides.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Bell, Loader2, CheckCheck, Search, Inbox, AlertTriangle, Clock, Check, X,
} from "lucide-react";
import { toast } from "sonner";
import { ClientLogo } from "@/components/admin/ClientLogo";
import { NotificationSettingsPanel } from "@/components/admin/NotificationSettingsPanel";
import {
  AdminPageHeader, AdminSection, AdminStatCard, AdminEmpty,
} from "@/components/admin/ui";
import {
  NOTIF_CATEGORIES, TONE_CLASSES, dayLabel, notifMeta, relativeTime,
  type NotifCategoryKey,
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

type CatFilter = "all" | NotifCategoryKey;

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
      const c = notifMeta(n.type).category;
      map[c] = (map[c] ?? 0) + 1;
    }
    return map;
  }, [items, onlyUnread]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((n) => {
      if (onlyUnread && n.lu) return false;
      if (category !== "all" && notifMeta(n.type).category !== category) return false;
      if (!q) return true;
      return (
        n.titre.toLowerCase().includes(q) ||
        (n.message ?? "").toLowerCase().includes(q) ||
        notifMeta(n.type).label.toLowerCase().includes(q)
      );
    });
  }, [items, category, onlyUnread, search]);

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

            {/* Familles */}
            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[color:var(--admin-border)] pt-3">
              {([{ key: "all" as const, label: "Tout", icon: Inbox }, ...NOTIF_CATEGORIES]).map((c) => {
                const count = countsByCategory[c.key] ?? 0;
                const active = category === c.key;
                if (c.key !== "all" && count === 0 && !active) return null;
                return (
                  <button
                    key={c.key}
                    onClick={() => setCategory(c.key as CatFilter)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                      active
                        ? "bg-[#2F5FFF] text-white border-[#2F5FFF]"
                        : "border-[color:var(--admin-border)] text-[color:var(--admin-text-soft)] hover:border-[#2F5FFF]"
                    }`}
                  >
                    <c.icon size={13} />
                    {c.label}
                    <span className={`rounded-full px-1.5 text-[10px] tabular-nums ${active ? "bg-white/20" : "bg-[color:var(--admin-bg-soft)]"}`}>
                      {count}
                    </span>
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
                      <ul className="rounded-xl border border-[color:var(--admin-border)] overflow-hidden divide-y divide-[color:var(--admin-border)]">
                        {g.rows.map((n) => (
                          <NotifRow key={n.id} n={n} onToggleRead={(lu) => void markRead([n.id], lu)} />
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

function NotifRow({ n, onToggleRead }: { n: Notification; onToggleRead: (lu: boolean) => void }) {
  const meta = notifMeta(n.type);
  const tone = TONE_CLASSES[meta.tone];
  const Icon = meta.icon;
  const m = (n.metadata ?? {}) as Record<string, any>;
  const logo = (m.clientLogoUrl || m.logo_url || m.orgLogoUrl) as string | undefined;
  const brand = (m.clientName || m.societe || m.nom_complet || m.orgName || m.client) as string | undefined;

  return (
    <li
      className={`group flex items-start gap-3 px-4 py-3 transition-colors ${
        n.lu ? "bg-[color:var(--admin-surface)]" : "bg-[#2F5FFF]/[0.035]"
      } hover:bg-[color:var(--admin-bg-soft)]`}
    >
      <span className="relative shrink-0 mt-0.5">
        {logo || brand ? (
          <ClientLogo src={logo} name={brand} size="md" />
        ) : (
          <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border ${tone.chip}`}>
            <Icon size={16} />
          </span>
        )}
        {!n.lu && <span className={`absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${tone.dot}`} />}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${tone.chip}`}>
            {meta.label}
          </span>
          <span className="text-[11px] text-[color:var(--admin-muted)]" title={new Date(n.created_at).toLocaleString("fr-FR")}>
            {relativeTime(n.created_at)}
          </span>
        </div>
        <p className={`text-sm mt-1 ${n.lu ? "font-medium text-[color:var(--admin-text-soft)]" : "font-semibold text-[color:var(--admin-text)]"}`}>
          {n.titre}
        </p>
        {n.message && <p className="text-[13px] text-[color:var(--admin-muted)] mt-0.5 line-clamp-2">{n.message}</p>}
      </div>

      <div className="flex shrink-0 items-center gap-1 self-center">
        {n.link && n.link.startsWith("/") && (
          <a
            href={n.link}
            className="rounded-md px-2.5 py-1.5 text-xs font-semibold text-[#2F5FFF] hover:bg-[#2F5FFF]/10 whitespace-nowrap"
          >
            Ouvrir
          </a>
        )}
        <button
          onClick={() => onToggleRead(!n.lu)}
          title={n.lu ? "Marquer comme non lue" : "Marquer comme lue"}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[color:var(--admin-muted)] hover:bg-[color:var(--admin-bg-soft)] hover:text-[color:var(--admin-text)]"
        >
          {n.lu ? <Bell size={14} /> : <Check size={15} />}
        </button>
      </div>
    </li>
  );
}
