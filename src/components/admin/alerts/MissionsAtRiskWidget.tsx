/**
 * MissionsAtRiskWidget — bloc "Missions à risque" du tableau de bord admin.
 */
import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, ShieldCheck } from "lucide-react";
import { useMissionAlerts } from "@/hooks/useMissionAlerts";
import { SEVERITY_META, alertTypeLabel, sinceLabel } from "@/lib/mission-alerts";

export function MissionsAtRiskWidget({ limit = 4 }: { limit?: number }) {
  const { alerts, counts, loading } = useMissionAlerts("active");
  const top = alerts.slice(0, limit);

  return (
    <div className="a6-card p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="inline-flex items-center gap-2 font-bold text-[13.5px] text-[var(--a6-text)]">
          <AlertTriangle size={16} className="text-[#f59e0b]" /> Missions à risque
        </p>
        <div className="flex items-center gap-1.5">
          {(["critique", "attention", "info"] as const).map((s) =>
            counts[s] > 0 ? (
              <span key={s} className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${SEVERITY_META[s].chip}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${SEVERITY_META[s].dot}`} />
                {counts[s]}
              </span>
            ) : null,
          )}
          <Link to="/admin/alertes" className="text-[11.5px] font-semibold text-[#2f5fff] hover:underline inline-flex items-center gap-1">
            Tout voir <ArrowRight size={12} />
          </Link>
        </div>
      </div>

      {loading ? (
        <p className="text-[12px] text-[var(--a6-dim)] py-6 text-center">Analyse en cours…</p>
      ) : top.length === 0 ? (
        <div className="py-7 text-center">
          <ShieldCheck size={26} className="mx-auto text-emerald-500 mb-2" />
          <p className="text-[12.5px] font-semibold text-[var(--a6-text)]">Aucune mission à risque</p>
          <p className="text-[11.5px] text-[var(--a6-dim)]">Toutes les missions en cours suivent le planning.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {top.map((a) => (
            <li key={a.id} className={`rounded-xl border p-3 ${SEVERITY_META[a.severity].card}`}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`h-2 w-2 rounded-full ${SEVERITY_META[a.severity].dot}`} />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--a6-muted)]">
                  {alertTypeLabel(a.alert_type)}
                </span>
                <span className="text-[10.5px] text-[var(--a6-dim)]">{sinceLabel(a.triggered_at)}</span>
                {a.attribution?.numero_mission && (
                  <span className="a6-mono text-[10.5px] font-semibold text-[var(--a6-blue-deep)]">
                    {a.attribution.numero_mission}
                  </span>
                )}
              </div>
              <p className="mt-1 text-[12.5px] font-semibold text-[var(--a6-text)]">{a.titre}</p>
              {a.message && <p className="text-[11.5px] text-[var(--a6-muted)] line-clamp-2">{a.message}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
