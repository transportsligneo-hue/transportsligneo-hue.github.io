/**
 * NotificationBell · cloche premium temps réel.
 * Panneau opaque, typographie contrastée, icônes typées, timestamps relatifs.
 */
import { useEffect, useState, useCallback, useId, type ReactNode } from "react";
import {
  Bell, X, ArrowRight, Pencil,
  Truck, CreditCard, FileText, MessageSquare, UserCircle, Settings,
  type LucideIcon,
} from "lucide-react";
import { Link, useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatRelativeTime } from "@/lib/notify";
import { neonClass, resolveTone, variantFromRole, type NeonVariant } from "@/lib/neon-notifications";

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
  const { user, role } = useAuth();
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


  return <NotifPanelView user={!!user} open={open} setOpen={setOpen} unread={unread} items={items}
    variant={variantFromRole(role)} markRead={markRead} onNavigate={(to) => router.navigate({ to })} className={className} />;
}

const KEYWORDS = /(nouvelle destination|nouvelle adresse|date souhaitée|dates?|heures?|adresses?|destination|plaque)/gi;

function highlight(text: string): ReactNode[] {
  return text.split(KEYWORDS).map((part, i) =>
    i % 2 === 1 ? <b key={i} className="font-semibold text-white/75">{part}</b> : <span key={i}>{part}</span>,
  );
}

function kindOf(n: UserNotif): "new" | "edit" | "ops" | "other" {
  const t = `${n.titre} ${n.type}`.toLowerCase();
  if (t.includes("exploitation")) return "ops";
  if (t.includes("modifi")) return "edit";
  if (t.includes("nouvelle mission") || t.includes("disponible") || n.category === "mission") return "new";
  return "other";
}


function NotifPanelView({
  user, open, setOpen, unread, items, markRead, onNavigate, className, variant,
}: {
  variant: NeonVariant;
  user: boolean; open: boolean; setOpen: (v: boolean | ((p: boolean) => boolean)) => void;
  unread: number; items: UserNotif[]; markRead: (id: string) => void;
  onNavigate: (to: string) => void; className: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const r = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
      return () => cancelAnimationFrame(r);
    }
    setShown(false);
    const t = setTimeout(() => setMounted(false), 200);
    return () => clearTimeout(t);
  }, [open]);

  // Bloque le scroll de la page derrière
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!user) return null;

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="notif-bell-btn relative w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 transition"
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

      {mounted && (
        <>
          <div
            aria-hidden
            onClick={() => setOpen(false)}
            className={`fixed inset-0 z-40 backdrop-blur-[3px] transition-opacity duration-200 ${shown ? "opacity-100" : "opacity-0"}`}
            style={{ background: "rgba(3,6,20,.78)" }}
          />
          <div
            role="dialog"
            aria-label="Panneau des notifications"
            onClick={(e) => e.stopPropagation()}
            className={`fixed left-3.5 right-3.5 top-16 z-50 sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:w-[390px] sm:max-w-[94vw] flex flex-col overflow-hidden rounded-[22px] text-white transition-all duration-200 ease-out ${shown ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"}`}
            style={{
              fontFamily: "'Poppins', sans-serif",
              background: "linear-gradient(180deg, #0c1838 0%, #0f1e42 100%)",
              border: "1px solid rgba(93,224,255,.14)",
              boxShadow: "0 30px 70px -20px rgba(0,8,40,.7)",
              maxHeight: "min(640px, calc(100vh - 6rem))",
            }}
          >
            <div className="flex items-center gap-3.5 px-5 pt-5 pb-4 border-b border-white/[0.08]">
              <span
                className="shrink-0 w-[46px] h-[46px] rounded-[13px] flex items-center justify-center"
                style={{ background: "linear-gradient(135deg,#2f5fff,#5de0ff)", boxShadow: "0 10px 20px -8px rgba(47,95,255,.55)" }}
              >
                <Bell size={21} strokeWidth={1.8} className="text-white" />
              </span>
              <div className="flex-1 min-w-0">
                <h3 className="text-[17.5px] font-extrabold leading-tight">Notifications</h3>
                <div className="mt-0.5 flex items-center gap-1.5 text-[12.5px] font-semibold text-[#5de0ff]">
                  <span className="relative flex w-1.5 h-1.5">
                    <span className="absolute inset-0 rounded-full bg-[#5de0ff] animate-ping opacity-60" />
                    <span className="relative w-1.5 h-1.5 rounded-full bg-[#5de0ff]" />
                  </span>
                  {unread > 0 ? `${unread} non lue${unread > 1 ? "s" : ""}` : "Tout est à jour"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fermer"
                className="shrink-0 w-8 h-8 rounded-[9px] bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center transition"
              >
                <X size={14} strokeWidth={2} className="text-white/50" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain">
              {items.length === 0 ? (
                <div className="p-10 text-center">
                  <Bell size={26} className="mx-auto text-white/30 mb-2" />
                  <p className="text-[13px] text-white/50">Aucune notification.</p>
                </div>
              ) : (
                <ul>
                  {items.map((n) => {
                    const kind = kindOf(n);
                    const meta = CATEGORY_META[n.category] ?? CATEGORY_META.systeme;
                    const Icon = kind === "edit" ? Pencil : kind === "other" ? meta.Icon : Truck;
                    const tone = neonClass(resolveTone(variant, undefined, `${n.titre} ${n.type} ${n.message ?? ""}`));
                    const target = n.link && n.link.startsWith("/") ? n.link : null;
                    return (
                      <li key={n.id}>
                        <button
                          type="button"
                          onClick={() => {
                            markRead(n.id);
                            if (target) { setOpen(false); onNavigate(target); }
                          }}
                          className={`${tone} relative w-full flex gap-3.5 px-5 py-4 text-left border-b border-white/[0.08] hover:bg-white/[0.04] transition`}
                        >
                          {!n.lu && (
                            <span className="notif-neon-bar absolute left-0 top-0 bottom-0 w-[3px]" />
                          )}
                          <span
                            className="notif-neon-icon shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
                          >
                            <Icon size={18} strokeWidth={1.8} />
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2.5">
                              <p className="notif-neon-title text-[14px] font-bold leading-snug">{n.titre}</p>
                              <span className="shrink-0 mt-0.5 text-[10.5px] font-semibold text-white/50 whitespace-nowrap">
                                {formatRelativeTime(n.created_at)}
                              </span>
                            </div>
                            {n.message && (
                              <p className="mt-1 text-[12.5px] leading-normal text-white/50 line-clamp-2">{highlight(n.message)}</p>
                            )}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="px-[18px] pt-4 pb-[18px]">
              <Link
                to="/notifications"
                onClick={() => setOpen(false)}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-[13px] text-[13.5px] font-bold text-white transition hover:brightness-110"
                style={{ background: "linear-gradient(120deg,#2f5fff,#5b83ff)", boxShadow: "0 14px 28px -10px rgba(47,95,255,.5)" }}
              >
                Voir toutes les notifications <ArrowRight size={14} strokeWidth={2} />
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
