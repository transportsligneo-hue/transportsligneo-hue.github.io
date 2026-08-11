import { useEffect, useState, useCallback } from "react";
import { History, FileText, Tag, Loader2, RefreshCw } from "lucide-react";
import { fetchPoHistory, formatPoValue, type PoHistoryEntry } from "@/lib/po-history";

interface Props {
  attributionId?: string | null;
  factureId?: string | null;
  /** Incrémenter pour forcer un rafraîchissement après une action. */
  refreshKey?: number;
  className?: string;
  title?: string;
}

/** Historique des changements de N° de PO et des régénérations de PDF. */
export function PoHistoryPanel({ attributionId, factureId, refreshKey = 0, className, title = "Historique PO & PDF" }: Props) {
  const [rows, setRows] = useState<PoHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!attributionId && !factureId) { setRows([]); setLoading(false); return; }
    setLoading(true);
    const data = await fetchPoHistory({ attributionId, factureId });
    setRows(data);
    setLoading(false);
  }, [attributionId, factureId]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  return (
    <div className={`rounded-lg border border-pro-border bg-pro-surface/60 p-3 ${className ?? ""}`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-pro-muted">
          <History size={12} /> {title}
        </span>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-pro-muted hover:text-pro-accent"
        >
          {loading ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
          Actualiser
        </button>
      </div>

      {loading && rows.length === 0 ? (
        <p className="text-xs text-pro-muted">Chargement…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-pro-muted">Aucun changement enregistré pour l'instant.</p>
      ) : (
        <ul className="space-y-1.5 max-h-64 overflow-auto pr-1">
          {rows.map((r) => (
            <li key={r.id} className="flex items-start gap-2 rounded-md border border-pro-border/60 bg-white/40 px-2 py-1.5">
              <span className={`mt-0.5 shrink-0 ${r.action === "po_change" ? "text-amber-500" : "text-blue-500"}`}>
                {r.action === "po_change" ? <Tag size={12} /> : <FileText size={12} />}
              </span>
              <div className="min-w-0 text-[11px] leading-relaxed">
                <div className="font-medium text-pro-text">
                  {r.action === "po_change" ? (
                    <>
                      N° de PO : <span className="font-mono line-through text-pro-muted">{formatPoValue(r.old_po)}</span>
                      {" → "}
                      <span className="font-mono">{formatPoValue(r.new_po)}</span>
                    </>
                  ) : (
                    <>
                      PDF régénéré{r.facture_numero ? ` · ${r.facture_numero}` : ""}
                      {r.new_po ? <> (PO <span className="font-mono">{r.new_po}</span>)</> : null}
                    </>
                  )}
                </div>
                <div className="text-pro-muted truncate">
                  {new Date(r.created_at).toLocaleString("fr-FR", {
                    day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit",
                  })}
                  {r.actor_name ? ` · ${r.actor_name}` : ""}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
