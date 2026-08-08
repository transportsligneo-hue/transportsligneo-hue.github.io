import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Banknote } from "lucide-react";

type PriceLog = {
  id: string;
  actor_label: string | null;
  created_at: string;
  metadata: { leg_label?: string; leg?: string } | null;
  old_value: { prix?: number | null } | null;
  new_value: { prix?: number | null } | null;
};

const fmt = (v: number | null | undefined) =>
  v == null ? "—" : `${Number(v).toFixed(2)} €`;

/** Historique des modifications de prix admin d'une mission (leg L / R inclus). */
export function MissionPriceHistory({ trajetIds }: { trajetIds: string[] }) {
  const [logs, setLogs] = useState<PriceLog[]>([]);

  useEffect(() => {
    const ids = trajetIds.filter(Boolean);
    if (ids.length === 0) { setLogs([]); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("activity_logs")
        .select("id, actor_label, created_at, metadata, old_value, new_value")
        .eq("action", "mission_prix_modifie")
        .in("entity_id", ids)
        .order("created_at", { ascending: false })
        .limit(10);
      if (!cancelled) setLogs((data ?? []) as unknown as PriceLog[]);
    })();
    return () => { cancelled = true; };
  }, [trajetIds.join(",")]);

  if (logs.length === 0) return null;

  return (
    <ul className="mt-3 space-y-2 border-t border-pro-border pt-3">
      {logs.map((l) => (
        <li key={l.id} className="flex items-start gap-2 text-sm">
          <Banknote size={14} className="mt-0.5 shrink-0 text-pro-accent" />
          <div className="min-w-0">
            <p className="text-pro-text font-medium">
              Prix modifié
              {l.metadata?.leg_label && l.metadata.leg_label !== "Mission simple"
                ? ` — volet ${l.metadata.leg_label} (${l.metadata.leg === "retour" ? "R" : "L"})`
                : ""}
            </p>
            <p className="text-pro-text-soft text-xs">
              <span className="line-through text-pro-muted">{fmt(l.old_value?.prix)}</span>
              {" → "}
              <b className="text-pro-text">{fmt(l.new_value?.prix)}</b>
            </p>
            <p className="text-pro-muted text-xs">
              Par {l.actor_label || "Admin"} · {new Date(l.created_at).toLocaleString("fr-FR")}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
