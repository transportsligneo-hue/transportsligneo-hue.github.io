import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { humanizeActivity } from "@/lib/activity-humanizer";

type Row = { id: string; action: string; actor_label: string | null; created_at: string; metadata: unknown };

/** Historique des actions enregistrées sur une mission (qui, quoi, quand). */
export function MissionHistory({ missionId, createdAt }: { missionId: string; createdAt?: string | null }) {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    supabase
      .from("activity_logs")
      .select("id, action, actor_label, created_at, metadata")
      .eq("entity_id", missionId)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => setRows((data ?? []) as Row[]));
  }, [missionId]);

  const fmt = (d: string) => new Date(d).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });

  return (
    <section className="mission-surface p-5">
      <h3 className="flex items-center gap-2 font-semibold mb-3"><History size={16} /> Historique de la mission</h3>
      <ol className="space-y-2 text-sm">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap gap-x-3">
            <span className="text-muted-foreground tabular-nums">{fmt(r.created_at)}</span>
            <span>{safeHuman(r.action)}</span>
            {r.actor_label && <span className="text-muted-foreground">— {r.actor_label}</span>}
          </li>
        ))}
        {createdAt && (
          <li className="flex gap-3">
            <span className="text-muted-foreground tabular-nums">{fmt(createdAt)}</span>
            <span>Mission créée</span>
          </li>
        )}
      </ol>
    </section>
  );
}

function safeHuman(action: string): string {
  try {
    const h = (humanizeActivity as unknown as (a: string) => unknown)(action);
    return typeof h === "string" ? h : action.replace(/[._]/g, " ");
  } catch {
    return action.replace(/[._]/g, " ");
  }
}
