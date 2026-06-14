import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Bell, BellOff } from "lucide-react";
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
    <Button type="button" variant="outline" size="sm" onClick={toggle} disabled={loading} className={className}>
      {enabled ? <Bell className="h-4 w-4 mr-2" /> : <BellOff className="h-4 w-4 mr-2" />}
      {enabled ? "Notifications actives" : "Activer les notifications"}
    </Button>
  );
}
