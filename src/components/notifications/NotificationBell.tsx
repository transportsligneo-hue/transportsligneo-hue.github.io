/**
 * NotificationBell — cloche de notifications temps réel (in-app).
 * Affiche compteur non-lues, dropdown avec 10 dernières, lien vers /notifications.
 * À placer dans les headers admin / client / convoyeur.
 */
import { useEffect, useState, useCallback } from "react";
import { Bell, Check, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface UserNotif {
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

const CATEGORY_DOT: Record<string, string> = {
  mission: "bg-blue-500",
  paiement: "bg-emerald-500",
  document: "bg-amber-500",
  message: "bg-purple-500",
  compte: "bg-sky-500",
  systeme: "bg-slate-500",
};

export function NotificationBell({ className = "" }: { className?: string }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<UserNotif[]>([]);
  const [unread, setUnread] = useState(0);

  const fetchLatest = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from("user_notifications" as never)
      .select("id, type, titre, message, link, category, priority, lu, created_at")
      .eq("user_id" as never, user.id as never)
      .order("created_at", { ascending: false })
      .limit(10);
    const rows = (data as unknown as UserNotif[]) ?? [];
    setItems(rows);
    const { count } = await supabase
      .from("user_notifications" as never)
      .select("id", { count: "exact", head: true })
      .eq("user_id" as never, user.id as never)
      .eq("lu" as never, false as never);
    setUnread(count ?? 0);
  }, [user?.id]);

  useEffect(() => {
    fetchLatest();
  }, [fetchLatest]);

  // Realtime
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`notif-bell-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_notifications", filter: `user_id=eq.${user.id}` },
        fetchLatest
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchLatest]);

  const markRead = async (id: string) => {
    await supabase
      .from("user_notifications" as never)
      .update({ lu: true } as never)
      .eq("id" as never, id as never);
    fetchLatest();
  };

  const markAllRead = async () => {
    if (!user?.id) return;
    await supabase
      .from("user_notifications" as never)
      .update({ lu: true } as never)
      .eq("user_id" as never, user.id as never)
      .eq("lu" as never, false as never);
    fetchLatest();
  };

  if (!user) return null;

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 transition"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-12 z-50 w-[360px] max-w-[92vw] rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Bell size={14} className="text-slate-600" />
                <span className="text-sm font-semibold text-slate-800">Notifications</span>
                {unread > 0 && (
                  <span className="text-[10px] bg-red-500 text-white rounded-full px-1.5 py-0.5 font-bold">
                    {unread}
                  </span>
                )}
              </div>
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1"
                >
                  <Check size={12} /> Tout lire
                </button>
              )}
            </div>

            <div className="max-h-[420px] overflow-y-auto">
              {items.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-400">Aucune notification.</div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {items.map((n) => {
                    const dot = CATEGORY_DOT[n.category] ?? "bg-slate-400";
                    const target = n.link && n.link.startsWith("/") ? n.link : null;
                    const body = (
                      <div className={`w-full flex gap-3 px-4 py-3 text-left ${n.lu ? "" : "bg-blue-50/40"} hover:bg-slate-50 transition`}>
                        <span className={`w-2 h-2 rounded-full mt-2 shrink-0 ${dot}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={`text-sm ${n.lu ? "font-medium text-slate-700" : "font-semibold text-slate-900"} truncate`}>
                              {n.titre}
                            </p>
                            {!n.lu && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />}
                          </div>
                          {n.message && (
                            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                          )}
                          <p className="text-[10px] text-slate-400 mt-1">
                            {new Date(n.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                          </p>
                        </div>
                      </div>
                    );
                    return (
                      <li key={n.id}>
                        {target ? (
                          <a
                            href={target}
                            onClick={() => {
                              markRead(n.id);
                              setOpen(false);
                            }}
                            className="block"
                          >
                            {body}
                          </a>
                        ) : (
                          <button onClick={() => markRead(n.id)} className="block w-full">
                            {body}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <a
              href="/notifications"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-1 px-4 py-3 text-xs font-semibold text-slate-700 border-t border-slate-100 hover:bg-slate-50 transition"
            >
              Voir toutes les notifications <ExternalLink size={12} />
            </a>
          </div>
        </>
      )}
    </div>
  );
}
