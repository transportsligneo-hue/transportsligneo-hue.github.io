import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";

export interface NotificationPayload {
  title: string;
  body?: string;
  url?: string;
}

interface Props {
  /** Notification imposée manuellement (prioritaire sur celles du service worker). */
  notification?: NotificationPayload | null;
  /** Libellé du badge (par défaut "Notification"). */
  label?: string;
}

/**
 * Bandeau animé identique à l'ancien "Flash info" mais dédié aux
 * notifications push. Il écoute les messages `{ type: "push", ... }` postés
 * par `public/sw.js` et affiche la dernière notification reçue.
 * Se cache automatiquement quand aucune notification n'est active.
 */
export function NotificationBanner({ notification, label = "Notification" }: Props) {
  const [live, setLive] = useState<NotificationPayload | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const handler = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.type !== "push") return;
      if (!data.title && !data.body) return;
      setLive({
        title: String(data.title ?? "Notification"),
        body: data.body ? String(data.body) : undefined,
        url: data.url ? String(data.url) : undefined,
      });
      setDismissed(false);
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, []);

  const current = notification ?? live;
  if (!current || dismissed) return null;

  return (
    <div className="ligneo-flash-shell p-5 sm:p-6 relative">
      <style>{`
        @keyframes ligneo-sweep { 0% { transform: translateX(-120%); } 100% { transform: translateX(220%); } }
        @keyframes ligneo-shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes ligneo-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        .ligneo-flash-shell { position: relative; overflow: hidden; border-radius: 26px; background: linear-gradient(135deg, rgba(37,99,235,0.32) 0%, rgba(10,22,56,0.85) 55%, rgba(5,11,29,0.95) 100%); border: 1px solid rgba(96,165,250,0.3); box-shadow: 0 30px 80px -30px rgba(59,130,246,0.55), inset 0 0 0 1px rgba(147,197,253,0.08); }
        .ligneo-flash-shell::before { content: ""; position: absolute; inset: 0; background-image: linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.14) 50%, transparent 70%); background-size: 220% 100%; animation: ligneo-shimmer 5s linear infinite; pointer-events: none; }
        .ligneo-flash-line { position: absolute; height: 1px; background: linear-gradient(90deg, transparent, rgba(147,197,253,0.9), transparent); opacity: .8; animation: ligneo-sweep 4.5s ease-in-out infinite; }
        .ligneo-particle { position: absolute; width: 3px; height: 3px; border-radius: 999px; background: #93c5fd; box-shadow: 0 0 8px #60a5fa, 0 0 16px #3b82f6; animation: ligneo-float 4s ease-in-out infinite; }
        .ligneo-badge-notif { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px; font-size: 10px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; background: rgba(59,130,246,0.12); border: 1px solid rgba(96,165,250,0.4); color: #bfdbfe; text-shadow: 0 0 8px rgba(96,165,250,0.5); }
      `}</style>

      {/* particules et lignes animées */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="ligneo-flash-line" style={{ top: "22%", left: 0, right: 0, animationDelay: "0s" }} />
        <div className="ligneo-flash-line" style={{ top: "58%", left: 0, right: 0, animationDelay: "1.4s" }} />
        <div className="ligneo-flash-line" style={{ top: "82%", left: 0, right: 0, animationDelay: "2.6s" }} />
        <span className="ligneo-particle" style={{ top: "20%", left: "12%", animationDelay: "0s" }} />
        <span className="ligneo-particle" style={{ top: "48%", left: "78%", animationDelay: "1.2s" }} />
        <span className="ligneo-particle" style={{ top: "72%", left: "22%", animationDelay: "2.1s" }} />
        <span className="ligneo-particle" style={{ top: "35%", left: "62%", animationDelay: ".6s" }} />
        <div className="absolute -top-16 -right-10 w-48 h-48 rounded-full blur-3xl bg-[#3b82f6]/40" />
        <div className="absolute -bottom-20 -left-16 w-56 h-56 rounded-full blur-3xl bg-[#60a5fa]/25" />
      </div>

      <div className="relative flex items-start gap-4">
        <span
          className="shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center border border-white/20"
          style={{
            background: "linear-gradient(135deg, rgba(59,130,246,0.5), rgba(29,78,216,0.35))",
            boxShadow: "0 0 24px rgba(59,130,246,0.65), inset 0 1px 0 rgba(255,255,255,0.25)",
          }}
          aria-hidden
        >
          <Bell size={22} className="text-white" strokeWidth={2} />
        </span>
        <div className="flex-1 min-w-0">
          <span className="ligneo-badge-notif">{label}</span>
          <h3 className="mt-2 text-white text-[17px] font-bold tracking-tight">
            {current.title}
          </h3>
          {current.body && (
            <p className="text-white/70 text-[13px] mt-1 leading-relaxed">{current.body}</p>
          )}
          {current.url && (
            <a
              href={current.url}
              className="inline-block mt-2 text-[12px] font-semibold text-[#93c5fd] hover:text-white underline underline-offset-2"
            >
              Ouvrir →
            </a>
          )}
        </div>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Fermer la notification"
          className="relative z-10 shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
