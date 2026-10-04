import { Link } from "@tanstack/react-router";
import { AlertTriangle, CalendarDays, Euro, Layers, PlusCircle, Timer, Truck } from "lucide-react";
import { HelpTip } from "./HelpTip";
import { computePilotage, euro, useProMissions } from "@/hooks/useProMissions";

/** Bandeau « comprendre sa situation en 5 secondes » : 4 indicateurs + raccourcis. */
export function PilotageStrip({ isFlotte }: { isFlotte: boolean }) {
  const { missions, loading } = useProMissions();
  if (loading) return null;
  const k = computePilotage(missions);
  const delta = k.lastMonth > 0 ? Math.round(((k.thisMonth - k.lastMonth) / k.lastMonth) * 100) : null;

  return (
    <section className="pp-pilot mb-8" aria-label="Pilotage">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="pp-kpi">
          <Truck size={18} className="pp-kpi-ico" />
          <span className="pp-kpi-val">{k.inTransit}</span>
          <span className="pp-kpi-lbl">Véhicules en convoyage</span>
        </div>
        <div className={`pp-kpi ${k.late > 0 ? "pp-kpi-alert" : ""}`}>
          <AlertTriangle size={18} className="pp-kpi-ico" />
          <span className="pp-kpi-val">{k.late}</span>
          <span className="pp-kpi-lbl">Missions à surveiller <HelpTip text="Missions en retard sur la date prévue ou signalées avec un incident." /></span>
        </div>
        <div className="pp-kpi">
          <Euro size={18} className="pp-kpi-ico" />
          <span className="pp-kpi-val">{euro(k.thisMonth)}</span>
          <span className="pp-kpi-lbl">
            Dépenses du mois
            {delta !== null && (
              <em className={delta > 0 ? "pp-up" : "pp-down"}>
                {" "}
                {delta > 0 ? "+" : ""}
                {delta} % vs mois dernier
              </em>
            )}
          </span>
        </div>
        <div className="pp-kpi">
          <Timer size={18} className="pp-kpi-ico" />
          <span className="pp-kpi-val">{k.punctuality === null ? "—" : `${k.punctuality} %`}</span>
          <span className="pp-kpi-lbl">Délais respectés (30 j)</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 mt-3">
        <Link to={isFlotte ? "/dashboard-pro/nouvelle-demande" : "/dashboard-pro/nouvelle-mission"} className="pp-quick">
          <PlusCircle size={14} /> Nouvelle demande
        </Link>
        {isFlotte && (
          <Link to="/dashboard-pro/nouvelle-mission/groupee" className="pp-quick">
            <Layers size={14} /> Demande groupée
          </Link>
        )}
        <Link to="/dashboard-pro/calendrier" className="pp-quick">
          <CalendarDays size={14} /> Voir le calendrier
        </Link>
      </div>
    </section>
  );
}
