import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PlateBadge } from "@/components/plate/PlateBadge";
import { CheckCircle2, ShieldCheck, Wrench, ClipboardCheck, ArrowRight } from "lucide-react";
import { computeFleetDeadlines, type DeadlineVehicle, type FleetDeadline } from "@/lib/fleet-deadlines";

const KIND_META: Record<FleetDeadline["kind"], { label: string; Icon: typeof Wrench }> = {
  ct: { label: "Contrôle technique", Icon: ClipboardCheck },
  revision: { label: "Révision", Icon: Wrench },
  assurance: { label: "Assurance", Icon: ShieldCheck },
};

type Filter = "all" | FleetDeadline["kind"];

function delayLabel(days: number) {
  if (days < 0) return `Dépassé de ${-days} j`;
  if (days === 0) return "Aujourd'hui";
  return `Dans ${days} j`;
}

/** Échéances du parc (CT, révision, assurance) à moins de 60 jours, triées par urgence. */
export function FleetDeadlinesCard() {
  const [rows, setRows] = useState<DeadlineVehicle[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    let off = false;
    supabase
      .from("vehicles")
      .select("id, marque, modele, immatriculation, controle_technique_expire_le, assurance_expire_le, derniere_revision_le, intervalle_revision_mois")
      .is("archived_at", null)
      .then(({ data }) => { if (!off) setRows((data ?? []) as DeadlineVehicle[]); });
    return () => { off = true; };
  }, []);

  const all = useMemo(() => computeFleetDeadlines(rows ?? [], new Date()), [rows]);
  const list = filter === "all" ? all : all.filter((d) => d.kind === filter);

  return (
    <div className="v3-card v3-card-hover p-6 flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h3 className="font-v3-display text-[15px] font-semibold text-v3">Échéances du parc</h3>
        <div className="v3-tabs">
          {([["all", "Toutes"], ["ct", "CT"], ["revision", "Révisions"], ["assurance", "Assurance"]] as [Filter, string][]).map(([k, l]) => (
            <button key={k} type="button" className={filter === k ? "active" : ""} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
      </div>

      {rows === null ? (
        <p className="text-v3-muted text-[13px]">Chargement…</p>
      ) : list.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
          <CheckCircle2 size={28} className="text-emerald-500" aria-hidden />
          <p className="text-v3 text-[14px] font-medium">Parc à jour</p>
          <p className="text-v3-muted text-[13px]">Aucune échéance dans les 60 prochains jours.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
          {list.slice(0, 8).map((d) => {
            const { label, Icon } = KIND_META[d.kind];
            const tone = d.days < 0 ? "bg-red-500/10 text-red-600 border-red-500/30" : d.days <= 30 ? "bg-orange-500/10 text-orange-600 border-orange-500/30" : "bg-blue-500/10 text-blue-600 border-blue-500/30";
            return (
              <li key={`${d.vehicle.id}-${d.kind}`} className="flex flex-wrap items-center gap-3 rounded-lg border border-border/60 px-3 py-2.5">
                <PlateBadge plate={d.vehicle.immatriculation} />
                <div className="min-w-0 flex-1">
                  <p className="text-v3 text-[13px] font-medium truncate">{[d.vehicle.marque, d.vehicle.modele].filter(Boolean).join(" ") || "Véhicule"}</p>
                  <p className="text-v3-muted text-[12px] flex items-center gap-1"><Icon size={12} aria-hidden /> {label} · {new Date(d.date).toLocaleDateString("fr-FR")}</p>
                </div>
                <span className={`rounded-full border px-2.5 py-0.5 text-[12px] font-semibold ${tone}`}>{delayLabel(d.days)}</span>
                {d.kind !== "assurance" && (
                  <Link to="/dashboard-pro/nouvelle-mission" className="v3-link inline-flex items-center gap-1 text-[12px]">
                    Convoyer <ArrowRight size={12} />
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <Link to="/dashboard-pro/calendrier" className="v3-link mt-4 self-end text-[13px]">Calendrier complet →</Link>
    </div>
  );
}
