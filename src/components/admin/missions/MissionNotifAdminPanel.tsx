/**
 * Panneau "Notification de fin de mission" — permet de (re)déclencher
 * manuellement la notification admin + l'email récapitulatif d'une mission
 * terminée (utile en rétroactif si l'envoi automatique a échoué).
 */
import { useState } from "react";
import { BellRing, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, Button } from "@/components/admin/AdminUI";

export function MissionNotifAdminPanel({ attributionId }: { attributionId: string }) {
  const [busy, setBusy] = useState(false);

  async function resend() {
    setBusy(true);
    try {
      const { notifyAdminMissionTerminee } = await import("@/lib/mission-completion-notify");
      await notifyAdminMissionTerminee(attributionId, { manual: true });
      toast.success("Notification admin renvoyée", {
        description: "Email récapitulatif + notification in-app envoyés.",
      });
    } catch {
      toast.error("Échec de l'envoi de la notification");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="flex items-center gap-2 mb-3">
        <BellRing size={15} className="text-pro-accent" />
        <h3 className="text-sm font-semibold text-pro-text uppercase tracking-wider">
          Notification de fin de mission
        </h3>
      </div>
      <p className="text-xs text-pro-text-muted mb-3">
        Renvoyer manuellement la notification admin et l'email récapitulatif de fin de mission.
      </p>
      <Button onClick={resend} disabled={busy}>
        {busy ? <Loader2 size={14} className="animate-spin" /> : <BellRing size={14} />}
        Renvoyer la notification
      </Button>
    </Card>
  );
}
