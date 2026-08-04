import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { pushSupported, getSubscription, subscribeToPush, unsubscribeFromPush } from "@/lib/push/client";

export function PushNotificationToggle({ className }: { className?: string }) {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSupported(pushSupported());
    if (pushSupported()) getSubscription().then((s) => setEnabled(!!s)).catch(() => {});
  }, []);

  if (!supported) return null;

  const toggle = async () => {
    setLoading(true);
    try {
      if (enabled) {
        await unsubscribeFromPush();
        setEnabled(false);
        toast.success("Notifications désactivées");
      } else {
        await subscribeToPush();
        setEnabled(true);
        toast.success("Notifications activées");
      }
    } catch (e: any) {
      toast.error(e?.message || "Erreur notifications");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      aria-pressed={enabled}
      className={[
        "inline-flex items-center gap-2 rounded-full pl-3 pr-4 py-2 text-xs font-semibold tracking-wide",
        "border shadow-sm transition-all disabled:opacity-60",
        enabled
          ? "bg-[#2F5FFF] border-[#2F5FFF] text-white hover:bg-[#2551e0]"
          : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400",
        className || "",
      ].join(" ")}
    >
      <span
        className={[
          "flex h-5 w-5 items-center justify-center rounded-full",
          enabled ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500",
        ].join(" ")}
      >
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : enabled ? (
          <Bell className="h-3 w-3" />
        ) : (
          <BellOff className="h-3 w-3" />
        )}
      </span>
      {enabled ? "Notifications activées" : "Activer les notifications"}
      <span
        className={[
          "ml-1 h-1.5 w-1.5 rounded-full",
          enabled ? "bg-emerald-300 animate-pulse" : "bg-slate-300",
        ].join(" ")}
      />
    </button>
  );
}
