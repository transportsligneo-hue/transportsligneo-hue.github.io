import { useEffect, useState } from "react";
import { CloudOff, RefreshCw, CloudUpload } from "lucide-react";
import { subscribeOutbox, kickOutbox } from "@/lib/offline-outbox";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { kickQueue } from "@/lib/edl-offline-queue";

/**
 * Bandeau discret indiquant au convoyeur qu'il travaille hors ligne
 * et que ses actions partiront automatiquement au retour du réseau.
 */
export default function OfflineOutboxBadge() {
  const online = useOnlineStatus();
  const [pending, setPending] = useState(0);

  useEffect(() => {
    const unsub = subscribeOutbox(setPending);
    return () => {
      unsub();
    };
  }, []);

  useEffect(() => {
    if (online) {
      kickOutbox();
      kickQueue();
    }
  }, [online]);

  if (online && pending === 0) return null;

  return (
    <div className="fixed bottom-20 left-1/2 z-[70] -translate-x-1/2 md:bottom-6">
      <button
        type="button"
        onClick={() => {
          kickOutbox();
          kickQueue();
        }}
        className="flex items-center gap-2 rounded-full border border-amber-400/40 bg-slate-900/95 px-4 py-2 text-xs font-medium text-amber-200 shadow-lg backdrop-blur"
      >
        {!online ? <CloudOff size={14} /> : <CloudUpload size={14} />}
        <span>
          {!online
            ? pending > 0
              ? `Hors ligne · ${pending} action${pending > 1 ? "s" : ""} en attente`
              : "Hors ligne · vos actions seront envoyées automatiquement"
            : `Synchronisation · ${pending} action${pending > 1 ? "s" : ""}`}
        </span>
        {online && pending > 0 && <RefreshCw size={13} className="animate-spin" />}
      </button>
    </div>
  );
}
