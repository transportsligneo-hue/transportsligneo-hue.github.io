/**
 * NotificationBell · cloche premium temps réel.
 * Panneau opaque, typographie contrastée, icônes typées, timestamps relatifs.
 */
import { useEffect, useState, useCallback, useId } from "react";
import {
  Bell, Check, ExternalLink,
  Truck, CreditCard, FileText, MessageSquare, UserCircle, Settings,
  type LucideIcon,
} from "lucide-react";
import { Link, useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatRelativeTime } from "@/lib/notify";

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

const CATEGORY_META: Record<string, { Icon: LucideIcon; bg: string; text: string; ring: string }> = {
  mission:  { Icon: Truck,         bg: "bg-[#38bdf8]/15", text: "text-[#38bdf8]", ring: "ring-[#38bdf8]/30" },
  paiement: { Icon: CreditCard,    bg: "bg-[#3dd68c]/15", text: "text-[#3dd68c]", ring: "ring-[#3dd68c]/30" },
  document: { Icon: FileText,      bg: "bg-[#f5b544]/15", text: "text-[#f5b544]", ring: "ring-[#f5b544]/30" },
  message:  { Icon: MessageSquare, bg: "bg-[#c084fc]/15", text: "text-[#c084fc]", ring: "ring-[#c084fc]/30" },
  compte:   { Icon: UserCircle,    bg: "bg-[#4d9aff]/15", text: "text-[#4d9aff]", ring: "ring-[#4d9aff]/30" },
  systeme:  { Icon: Settings,      bg: "bg-slate-500/15", text: "text-slate-500", ring: "ring-slate-400/30" },
};

export function NotificationBell({ className = "" }: { className?: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const channelId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
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

  useEffect(() => { fetchLatest(); }, [fetchLatest]);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`notif-bell-${user.id}-${channelId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_notifications", filter: `user_id=eq.${user.id}` },
        fetchLatest,
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, fetchLatest, channelId]);

  // Ouverture du panneau → tout est considéré comme vu (le badge disparaît)
  useEffect(() => {
    if (!open || !user?.id) return;
    const t = setTimeout(() => { markAllRead(); }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user?.id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

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
        aria-expanded={open}
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#ef4a4a] text-white text-[10px] font-bold flex items-center justify-center shadow-[0_4px_10px_-2px_rgba(239,74,74,0.6)] animate-pulse">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            role="dialog"
            aria-label="Panneau des notifications"
            className="fixed left-2 right-2 top-16 z-50 w-auto max-w-none sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:w-[380px] sm:max-w-[94vw] rounded-2xl border border-white/10 bg-[#0b1230]/95 backdrop-blur-xl shadow-[0_30px_60px_-20px_rgba(0,0,0,0.6)] overflow-hidden motion-safe:animate-[scale-in_0.18s_ease-out]"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-[#e7c76a]/15 border border-[#e7c76a]/30 flex items-center justify-center">
                  <Bell size={14} className="text-[#e7c76a]" />
                </span>
                <div>
                  <div className="text-sm font-semibold text-[#faf7ef]">Notifications</div>
                  <div className="text-[10px] text-[#c7cde0]">
                    {unread > 0 ? `${unread} non lue${unread > 1 ? "s" : ""}` : "Tout est à jour"}
                  </div>
                </div>
              </div>
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-[11px] text-[#c7cde0] hover:text-[#faf7ef] flex items-center gap-1 px-2 py-1 rounded-md hover:bg-white/8 transition"
                >
                  <Check size={12} /> Tout lire
                </button>
              )}
            </div>

            <div className="max-h-[440px] overflow-y-auto">
              {items.length === 0 ? (
                <div className="p-10 text-center">
                  <Bell size={26} className="mx-auto text-[#c7cde0]/40 mb-2" />
                  <p className="text-[13px] text-[#c7cde0]/70">Aucune notification.</p>
                </div>
              ) : (
                <ul className="divide-y divide-white/6">
                  {items.map((n) => {
                    const meta = CATEGORY_META[n.category] ?? CATEGORY_META.systeme;
                    const target = n.link && n.link.startsWith("/") ? n.link : null;
                    const body = (
                      <div
                        className={`relative w-full flex gap-3 px-4 py-3 text-left transition ${n.lu ? "hover:bg-white/5" : "bg-white/[0.04] hover:bg-white/[0.08]"}`}
                      >
                        {!n.lu && (
                          <span className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full bg-[#e7c76a]" />
                        )}
                        <span
                          className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border border-white/10 ${meta.bg} ${meta.text}`}
                        >
                          <meta.Icon size={16} />
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={`text-[13px] leading-snug truncate ${n.lu ? "text-[#c7cde0] font-medium" : "text-[#faf7ef] font-semibold"}`}>
                              {n.titre}
                            </p>
                            {!n.lu && <span className="w-1.5 h-1.5 rounded-full bg-[#4d9aff] shrink-0 shadow-[0_0_8px_rgba(77,154,255,0.9)]" />}
                          </div>
                          {n.message && (
                            <p className="text-[12px] text-[#c7cde0]/80 mt-0.5 line-clamp-2">{n.message}</p>
                          )}
                          <p className="text-[10px] text-[#c7cde0]/50 mt-1">{formatRelativeTime(n.created_at)}</p>
                        </div>
                      </div>
                    );
                    return (
                      <li key={n.id}>
                        {target ? (
                          <button
                            type="button"
                            onClick={() => {
                              markRead(n.id);
                              setOpen(false);
                              router.navigate({ to: target as string });
                            }}
                            className="block w-full text-left"
                          >
                            {body}
                          </button>
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

            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-1.5 px-4 py-3 text-[12px] font-semibold text-[#e7c76a] hover:text-[#f0d78c] border-t border-white/10 hover:bg-white/5 transition"
            >
              Voir toutes les notifications <ExternalLink size={12} />
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
