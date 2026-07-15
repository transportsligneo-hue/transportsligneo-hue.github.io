/**
 * Centre de notifications premium — historique complet, filtres, recherche,
 * regroupement par date, actions groupées, timestamps relatifs.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatRelativeTime } from "@/lib/notify";
import {
  Bell, Check, CheckCheck, Trash2, Search, Filter,
  Truck, CreditCard, FileText, MessageSquare, Settings, UserCircle,
  type LucideIcon,
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
  { key: "all",      label: "Toutes",    Icon: Bell },
  { key: "mission",  label: "Missions",  Icon: Truck },
  { key: "paiement", label: "Paiements", Icon: CreditCard },
  { key: "document", label: "Documents", Icon: FileText },
  { key: "message",  label: "Messages",  Icon: MessageSquare },
  { key: "compte",   label: "Compte",    Icon: UserCircle },
  { key: "systeme",  label: "Système",   Icon: Settings },
] as const;

const CATEGORY_META: Record<string, { Icon: LucideIcon; bg: string; text: string; border: string }> = {
  mission:  { Icon: Truck,         bg: "bg-[#38bdf8]/12", text: "text-[#38bdf8]", border: "border-[#38bdf8]/30" },
  paiement: { Icon: CreditCard,    bg: "bg-[#3dd68c]/12", text: "text-[#3dd68c]", border: "border-[#3dd68c]/30" },
  document: { Icon: FileText,      bg: "bg-[#f5b544]/12", text: "text-[#f5b544]", border: "border-[#f5b544]/30" },
  message:  { Icon: MessageSquare, bg: "bg-[#c084fc]/12", text: "text-[#c084fc]", border: "border-[#c084fc]/30" },
  compte:   { Icon: UserCircle,    bg: "bg-[#4d9aff]/12", text: "text-[#4d9aff]", border: "border-[#4d9aff]/30" },
  systeme:  { Icon: Settings,      bg: "bg-slate-500/12", text: "text-slate-400", border: "border-slate-400/30" },
};

function groupByBucket(items: Notif[]): Array<[string, Notif[]]> {
  const buckets: Record<string, Notif[]> = {
    "Aujourd'hui": [],
    "Hier": [],
    "Cette semaine": [],
    "Plus ancien": [],
  };
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startYesterday = startToday - 86_400_000;
  const startWeek = startToday - 6 * 86_400_000;
  for (const n of items) {
    const t = new Date(n.created_at).getTime();
    if (t >= startToday) buckets["Aujourd'hui"].push(n);
    else if (t >= startYesterday) buckets["Hier"].push(n);
    else if (t >= startWeek) buckets["Cette semaine"].push(n);
    else buckets["Plus ancien"].push(n);
  }
  return Object.entries(buckets).filter(([, v]) => v.length > 0);
}

function NotificationsCenter() {
  const { user } = useAuth();
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showRead, setShowRead] = useState(true);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(id);
  }, [query]);

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
        fetchData,
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, fetchData]);

  const filtered = useMemo(() => {
    if (!debouncedQuery.trim()) return items;
    const q = debouncedQuery.toLowerCase();
    return items.filter(n =>
      n.titre.toLowerCase().includes(q) ||
      (n.message ?? "").toLowerCase().includes(q),
    );
  }, [items, debouncedQuery]);

  const grouped = useMemo(() => groupByBucket(filtered), [filtered]);
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
    <div className="min-h-screen bg-gradient-to-b from-[#061238] via-[#061238] to-[#0b1a4a] pb-24">
      <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-serif text-[#faf7ef] flex items-center gap-3">
              <span className="w-11 h-11 rounded-xl bg-[#e7c76a]/15 border border-[#e7c76a]/30 flex items-center justify-center">
                <Bell size={20} className="text-[#e7c76a]" />
              </span>
              Notifications
              {unreadCount > 0 && (
                <span className="text-[11px] bg-[#ef4a4a] text-white rounded-full px-2 py-0.5 font-bold">
                  {unreadCount} non lue{unreadCount > 1 ? "s" : ""}
                </span>
              )}
            </h1>
            <p className="text-sm text-[#c7cde0] mt-2 ml-14">Historique complet de vos notifications.</p>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#e7c76a] hover:bg-[#f0d78c] text-[#061238] transition shadow-[0_10px_25px_-10px_rgba(231,199,106,0.5)]"
            >
              <CheckCheck size={14} /> Tout marquer lu
            </button>
          )}
        </div>

        {/* Filtres */}
        <div className="rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/10 p-3 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter size={14} className="text-[#c7cde0] ml-1" />
            {CATEGORIES.map(c => (
              <button
                key={c.key}
                onClick={() => setCategory(c.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  category === c.key
                    ? "bg-[#e7c76a] text-[#061238] shadow-[0_6px_16px_-6px_rgba(231,199,106,0.6)]"
                    : "text-[#c7cde0] hover:bg-white/10 hover:text-[#faf7ef]"
                }`}
              >
                <c.Icon size={12} /> {c.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#c7cde0]/60" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher…"
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-white/10 bg-white/[0.04] text-[#faf7ef] placeholder:text-[#c7cde0]/50 focus:outline-none focus:ring-2 focus:ring-[#4d9aff]/60"
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-[#c7cde0] px-2 whitespace-nowrap cursor-pointer">
              <input type="checkbox" checked={showRead} onChange={(e) => setShowRead(e.target.checked)} className="accent-[#e7c76a]" />
              Inclure les lues
            </label>
          </div>
        </div>

        {/* Liste */}
        {loading ? (
          <div className="text-center py-16 text-[#c7cde0]/60 text-sm">Chargement…</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-14 text-center">
            <Bell size={40} className="mx-auto text-[#c7cde0]/30 mb-4" />
            <p className="text-[#c7cde0] text-sm font-medium">Aucune notification.</p>
            <p className="text-[#c7cde0]/60 text-xs mt-1">Vous serez alerté ici dès qu'il y aura du nouveau.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map(([bucket, list]) => (
              <div key={bucket} className="space-y-2">
                <h2 className="text-[11px] uppercase tracking-[0.2em] font-semibold text-[#e7c76a]/80 px-1">
                  {bucket}
                </h2>
                <ul className="space-y-2">
                  {list.map(n => {
                    const meta = CATEGORY_META[n.category] ?? CATEGORY_META.systeme;
                    const target = n.link && n.link.startsWith("/") ? n.link : null;
                    const isChecked = selected.has(n.id);
                    return (
                      <li
                        key={n.id}
                        className={`relative rounded-2xl border p-3 pl-4 flex items-start gap-3 transition ${
                          isChecked
                            ? "border-[#e7c76a]/60 bg-[#e7c76a]/[0.06] shadow-[0_10px_25px_-15px_rgba(231,199,106,0.4)]"
                            : n.lu
                              ? "border-white/8 bg-white/[0.03] hover:bg-white/[0.05]"
                              : "border-white/10 bg-white/[0.06] hover:bg-white/[0.09]"
                        }`}
                      >
                        {!n.lu && !isChecked && (
                          <span className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full bg-[#e7c76a]" />
                        )}
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelect(n.id)}
                          className="mt-1.5 cursor-pointer accent-[#e7c76a]"
                          aria-label="Sélectionner"
                        />
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${meta.bg} ${meta.text} ${meta.border}`}>
                          <meta.Icon size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] uppercase tracking-wider font-bold text-[#c7cde0]/70">
                              {CATEGORIES.find(c => c.key === n.category)?.label ?? n.category}
                            </span>
                            {n.priority === "urgent" && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#ef4a4a] text-white font-bold">URGENT</span>
                            )}
                            {!n.lu && <span className="w-2 h-2 rounded-full bg-[#4d9aff] shadow-[0_0_8px_rgba(77,154,255,0.9)]" />}
                            <span className="text-[10px] text-[#c7cde0]/60 ml-auto">
                              {formatRelativeTime(n.created_at)}
                            </span>
                          </div>
                          <p className={`text-sm mt-1 leading-snug ${n.lu ? "text-[#c7cde0]" : "font-semibold text-[#faf7ef]"}`}>
                            {n.titre}
                          </p>
                          {n.message && <p className="text-sm text-[#c7cde0]/80 mt-1 leading-snug">{n.message}</p>}
                          <div className="flex items-center gap-3 mt-2">
                            {target && (
                              <a
                                href={target}
                                onClick={() => markRead([n.id])}
                                className="text-xs font-semibold text-[#e7c76a] hover:text-[#f0d78c]"
                              >
                                Voir le détail →
                              </a>
                            )}
                            {!n.lu && (
                              <button
                                onClick={() => markRead([n.id])}
                                className="text-xs text-[#c7cde0] hover:text-[#faf7ef]"
                              >
                                Marquer comme lu
                              </button>
                            )}
                            <button
                              onClick={() => deleteItems([n.id])}
                              className="text-xs text-[#ff8a8a] hover:text-[#ffb0b0] ml-auto"
                            >
                              Supprimer
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Barre flottante d'actions groupées */}
      {selected.size > 0 && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-4 py-3 rounded-2xl bg-[#0b1230]/95 backdrop-blur-xl border border-white/15 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.7)] motion-safe:animate-[fade-in_0.2s_ease-out]">
          <span className="text-xs text-[#c7cde0] pl-1">{selected.size} sélectionnée{selected.size > 1 ? "s" : ""}</span>
          <button
            onClick={() => markRead(Array.from(selected))}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 text-[#faf7ef] transition"
          >
            <Check size={13} /> Marquer lu
          </button>
          <button
            onClick={() => deleteItems(Array.from(selected))}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#ef4a4a]/20 hover:bg-[#ef4a4a]/30 text-[#ff8a8a] transition"
          >
            <Trash2 size={13} /> Supprimer
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="flex items-center px-3 py-1.5 rounded-lg text-xs font-medium text-[#c7cde0] hover:text-[#faf7ef] transition"
          >
            Annuler
          </button>
        </div>
      )}
    </div>
  );
}
