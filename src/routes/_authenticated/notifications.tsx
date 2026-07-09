/**
 * Centre de notifications — historique complet pour tous les rôles.
 * Filtres, recherche, marquer lu, tout marquer, suppression, deep-link.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Bell, Check, CheckCheck, Trash2, Search, Filter,
  Truck, CreditCard, FileText, MessageSquare, Settings, UserCircle,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/notifications")({
  component: NotificationsCenter,
});

interface Notif {
  id: string;
  type: string;
  titre: string;
  message: string | null;
  link: string | null;
  category: string;
  priority: string;
  lu: boolean;
  created_at: string;
}

const CATEGORIES = [
  { key: "all", label: "Toutes", Icon: Bell },
  { key: "mission", label: "Missions", Icon: Truck },
  { key: "paiement", label: "Paiements", Icon: CreditCard },
  { key: "document", label: "Documents", Icon: FileText },
  { key: "message", label: "Messages", Icon: MessageSquare },
  { key: "compte", label: "Compte", Icon: UserCircle },
  { key: "systeme", label: "Système", Icon: Settings },
] as const;

const CATEGORY_META: Record<string, { color: string; Icon: typeof Bell }> = {
  mission: { color: "bg-blue-100 text-blue-700", Icon: Truck },
  paiement: { color: "bg-emerald-100 text-emerald-700", Icon: CreditCard },
  document: { color: "bg-amber-100 text-amber-700", Icon: FileText },
  message: { color: "bg-purple-100 text-purple-700", Icon: MessageSquare },
  compte: { color: "bg-sky-100 text-sky-700", Icon: UserCircle },
  systeme: { color: "bg-slate-100 text-slate-700", Icon: Settings },
};

function NotificationsCenter() {
  const { user } = useAuth();
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showRead, setShowRead] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    let q = supabase
      .from("user_notifications" as never)
      .select("id, type, titre, message, link, category, priority, lu, created_at")
      .eq("user_id" as never, user.id as never)
      .order("created_at", { ascending: false })
      .limit(300);
    if (!showRead) q = q.eq("lu" as never, false as never);
    if (category !== "all") q = q.eq("category" as never, category as never);
    const { data } = await q;
    setItems((data as unknown as Notif[]) ?? []);
    setLoading(false);
  }, [user?.id, category, showRead]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`notif-center-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_notifications", filter: `user_id=eq.${user.id}` },
        fetchData
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, fetchData]);

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(n =>
      n.titre.toLowerCase().includes(q) ||
      (n.message ?? "").toLowerCase().includes(q)
    );
  }, [items, query]);

  const unreadCount = items.filter(n => !n.lu).length;

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const markRead = async (ids: string[]) => {
    if (!ids.length) return;
    await supabase.from("user_notifications" as never)
      .update({ lu: true } as never)
      .in("id" as never, ids as never);
    fetchData();
  };

  const markAllRead = async () => {
    if (!user?.id) return;
    await supabase.from("user_notifications" as never)
      .update({ lu: true } as never)
      .eq("user_id" as never, user.id as never)
      .eq("lu" as never, false as never);
    fetchData();
  };

  const deleteItems = async (ids: string[]) => {
    if (!ids.length) return;
    await supabase.from("user_notifications" as never)
      .delete()
      .in("id" as never, ids as never);
    setSelected(new Set());
    fetchData();
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
            <Bell size={22} /> Notifications
            {unreadCount > 0 && (
              <span className="text-xs bg-red-500 text-white rounded-full px-2 py-0.5 font-bold">
                {unreadCount} non lues
              </span>
            )}
          </h1>
          <p className="text-sm text-slate-500 mt-1">Historique complet de vos notifications.</p>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <>
              <button
                onClick={() => markRead(Array.from(selected))}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 transition"
              >
                <Check size={14} /> Marquer lu ({selected.size})
              </button>
              <button
                onClick={() => deleteItems(Array.from(selected))}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-red-50 hover:bg-red-100 text-red-700 transition"
              >
                <Trash2 size={14} /> Supprimer ({selected.size})
              </button>
            </>
          )}
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-900 text-white transition"
            >
              <CheckCheck size={14} /> Tout marquer comme lu
            </button>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={14} className="text-slate-500 ml-1" />
          {CATEGORIES.map(c => (
            <button
              key={c.key}
              onClick={() => setCategory(c.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                category === c.key
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <c.Icon size={12} /> {c.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher…"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-600 px-2 whitespace-nowrap cursor-pointer">
            <input type="checkbox" checked={showRead} onChange={(e) => setShowRead(e.target.checked)} />
            Inclure les lues
          </label>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-400 text-sm">Chargement…</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <Bell size={32} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 text-sm">Aucune notification.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map(n => {
            const meta = CATEGORY_META[n.category] ?? CATEGORY_META.systeme;
            const target = n.link && n.link.startsWith("/") ? n.link : null;
            const isChecked = selected.has(n.id);
            return (
              <li
                key={n.id}
                className={`bg-white border rounded-xl p-3 flex items-start gap-3 transition ${
                  isChecked ? "border-slate-800 ring-1 ring-slate-800" :
                  n.lu ? "border-slate-200 opacity-80" : "border-blue-200 bg-blue-50/30"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleSelect(n.id)}
                  className="mt-1.5 cursor-pointer"
                />
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${meta.color}`}>
                  <meta.Icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                      {CATEGORIES.find(c => c.key === n.category)?.label ?? n.category}
                    </span>
                    {n.priority === "urgent" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500 text-white font-bold">URGENT</span>
                    )}
                    {!n.lu && <span className="w-2 h-2 rounded-full bg-blue-500" />}
                    <span className="text-[10px] text-slate-400 ml-auto">
                      {new Date(n.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                    </span>
                  </div>
                  <p className={`text-sm mt-0.5 ${n.lu ? "text-slate-700" : "font-semibold text-slate-900"}`}>
                    {n.titre}
                  </p>
                  {n.message && <p className="text-sm text-slate-600 mt-1">{n.message}</p>}
                  <div className="flex items-center gap-3 mt-2">
                    {target && (
                      <a
                        href={target}
                        onClick={() => markRead([n.id])}
                        className="text-xs font-semibold text-blue-600 hover:underline"
                      >
                        Voir le détail →
                      </a>
                    )}
                    {!n.lu && (
                      <button
                        onClick={() => markRead([n.id])}
                        className="text-xs text-slate-500 hover:text-slate-800"
                      >
                        Marquer comme lu
                      </button>
                    )}
                    <button
                      onClick={() => deleteItems([n.id])}
                      className="text-xs text-red-500 hover:text-red-700 ml-auto"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
