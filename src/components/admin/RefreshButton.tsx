import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

/** Bouton « Actualiser » : tourne pendant le rechargement puis confirme (avant, rien ne se voyait). */
export function RefreshButton({
  onRefresh, className, label = "Actualiser", size = 14,
}: { onRefresh: () => unknown; className?: string; label?: string | null; size?: number }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (busy) return;
    setBusy(true);
    const t0 = Date.now();
    try {
      await Promise.resolve(onRefresh());
      const wait = 500 - (Date.now() - t0);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      toast.success("Données actualisées");
    } catch {
      toast.error("Actualisation impossible, réessayez.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <button type="button" onClick={() => void run()} disabled={busy} title="Actualiser" className={className}>
      <RefreshCw size={size} className={busy ? "animate-spin" : ""} />
      {label ? ` ${label}` : null}
    </button>
  );
}
