/**
 * Admin notifications — feed centralisé des actions plateforme.
 * Filtre par type, marquage lu/non-lu, lien direct vers l'entité.
 */
import { createFileRoute } from "@tanstack/react-router";
import AdminSectionHeader from "@/components/admin/AdminSectionHeader";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Bell, Check, AlertTriangle, FileText, Truck, UserPlus,
  CreditCard, Loader2, Filter, CheckCheck,
} from "lucide-react";
import { ClientLogo } from "@/components/admin/ClientLogo";
import { NotificationSettingsPanel } from "@/components/admin/NotificationSettingsPanel";

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

const TYPE_ICONS: Record<string, typeof Bell> = {
  incident: AlertTriangle,
  estimation: FileText,
  devis: FileText,
  mission_acceptee: Truck,
  mission_offre: Truck,
  mission_terminee: Check,
  client_action: UserPlus,
  driver_action: UserPlus,
  b2b_lead: UserPlus,
  b2b_paiement: CreditCard,
};

const TYPE_LABELS: Record<string, string> = {
  incident: "Incident",
  estimation: "Estimation",
  devis: "Devis",
  mission_acceptee: "Mission acceptée",
  mission_offre: "Offre convoyeur",
  mission_terminee: "Mission terminée",
  client_action: "Action client",
  driver_action: "Action convoyeur",
  b2b_lead: "Lead B2B",
  b2b_paiement: "Paiement B2B",
};

function AdminNotifications() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");
  const [showRead, setShowRead] = useState(false);
  const [tab, setTab] = useState<"feed" | "settings">("feed");

  const fetchData = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("admin_notifications" as never)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (!showRead) q = q.eq("lu" as never, false as never);
    if (filterType !== "all") q = q.eq("type" as never, filterType as never);
    const { data } = await q;
    setItems((data as unknown as Notification[]) ?? []);
    setLoading(false);
  }, [filterType, showRead]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("admin-notifications-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_notifications" }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  const markRead = async (id: string) => {
    await supabase.from("admin_notifications" as never)
      .update({ lu: true, lu_at: new Date().toISOString() } as never)
      .eq("id" as never, id as never);
    fetchData();
  };

  const markAllRead = async () => {
    await supabase.from("admin_notifications" as never)
      .update({ lu: true, lu_at: new Date().toISOString() } as never)
      .eq("lu" as never, false as never);
    fetchData();
  };

  const types = ["all", ...Object.keys(TYPE_LABELS)];

  return (
    <div className="space-y-5">
      <AdminSectionHeader
        breadcrumb="Notifications"
        eyebrow="Alertes plateforme"
        title="Notifications"
        subtitle="Toutes les actions importantes de la plateforme."
        actions={
          <button
            onClick={markAllRead}
            className="flex items-center gap-1.5 rounded-[9px] border border-[#eaeaee] bg-white px-4 py-2.5 text-[12.5px] font-semibold text-[#70727d] transition-colors hover:border-[#dedee4] hover:text-[#14161c]"
          >
            <CheckCheck size={14} /> Tout marquer comme lu
          </button>
        }
      />

      <div className="flex items-center gap-1 bg-white border border-pro-border rounded-xl p-1.5 w-fit">
        {([["feed", "Flux"], ["settings", "Réglages"]] as const).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
              tab === k ? "bg-pro-text text-white" : "text-pro-muted hover:bg-pro-bg-soft"
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {tab === "feed" ? (
        <>
      <div className="flex items-center gap-2 flex-wrap bg-white border border-pro-border rounded-xl p-2">
        <Filter size={14} className="text-pro-muted ml-2" />
        {types.map(t => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              filterType === t ? "bg-pro-text text-white" : "text-pro-muted hover:bg-pro-bg-soft"
            }`}
          >
            {t === "all" ? "Tout" : TYPE_LABELS[t] ?? t}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-xs text-pro-text-soft px-2 cursor-pointer">
          <input type="checkbox" checked={showRead} onChange={(e) => setShowRead(e.target.checked)} />
          Inclure les lues
        </label>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-pro-gold" size={24} /></div>
      ) : items.length === 0 ? (
        <div className="bg-white border border-pro-border rounded-xl p-12 text-center">
          <Bell size={32} className="mx-auto text-pro-muted mb-3" />
          <p className="text-pro-text-soft">Aucune notification.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map(n => {
            const Icon = TYPE_ICONS[n.type] ?? Bell;
            const isCritical = n.type === "incident";
            const meta = (n.metadata ?? {}) as Record<string, any>;
            const clientLogo = (meta.clientLogoUrl || meta.logo_url || meta.orgLogoUrl) as string | undefined;
            const clientName = (meta.clientName || meta.societe || meta.nom_complet || meta.orgName) as string | undefined;
            const hasBrand = Boolean(clientLogo || clientName);
            return (
              <li
                key={n.id}
                className={`bg-white border rounded-xl p-4 flex items-start gap-3 transition hover:shadow-sm ${
                  n.lu ? "border-pro-border opacity-70" : isCritical ? "border-red-200 bg-red-50/30" : "border-pro-gold/30"
                }`}
              >
                {hasBrand ? (
                  <ClientLogo src={clientLogo} name={clientName} size="md" />
                ) : (
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                    isCritical ? "bg-red-100 text-red-700" : n.lu ? "bg-pro-bg-soft text-pro-muted" : "bg-pro-gold-soft text-pro-gold"
                  }`}>
                    <Icon size={18} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-pro-muted">
                      {TYPE_LABELS[n.type] ?? n.type}
                    </span>
                    <span className="text-[10px] text-pro-muted">
                      {new Date(n.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                    </span>
                    {!n.lu && <span className="w-2 h-2 rounded-full bg-pro-gold" />}
                  </div>
                  <p className="text-sm font-semibold text-pro-text mt-0.5">{n.titre}</p>
                  {n.message && <p className="text-sm text-pro-text-soft mt-1 line-clamp-2">{n.message}</p>}
                  <div className="flex items-center gap-2 mt-2">
                    {n.link && n.link.startsWith("/") && (
                      <a href={n.link} className="text-xs font-semibold text-pro-gold hover:underline">
                        Voir le détail →
                      </a>
                    )}
                    {!n.lu && (
                      <button onClick={() => markRead(n.id)} className="text-xs text-pro-muted hover:text-pro-text">
                        Marquer comme lu
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
        </>
      ) : (
        <NotificationSettingsPanel />
      )}
    </div>
  );
}
