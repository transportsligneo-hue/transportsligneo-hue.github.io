import { BatteryCharging, Zap } from "lucide-react";

/** Détecte une mission « Recharge uniquement (sans livraison) ». */
export function isRechargeSeule(trajet?: {
  options_meta?: unknown;
  type_mission?: string | null;
  depart?: string | null;
  arrivee?: string | null;
} | null): boolean {
  if (!trajet) return false;
  const meta = trajet.options_meta as Record<string, unknown> | null | undefined;
  if (meta && typeof meta === "object") {
    if (meta.recharge_seule === true) return true;
    const metaType = typeof meta.type_mission === "string" ? meta.type_mission.toLowerCase() : "";
    if (metaType.startsWith("recharge")) return true;
  }
  const type = (trajet.type_mission ?? "").toLowerCase();
  if (type.startsWith("recharge")) return true;
  return false;
}


/**
 * Badge néon animé signalant une mission de recharge sur place,
 * sans livraison du véhicule.
 */
export function RechargeBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className="recharge-neon-badge"
      title="Recharge du véhicule sur place, sans livraison : le véhicule reste à la même adresse"
    >
      <span className="recharge-neon-icon">
        <BatteryCharging size={compact ? 12 : 13} strokeWidth={2.4} />
      </span>
      <span className="recharge-neon-label">
        {compact ? "Recharge seule" : "Recharge uniquement"}
      </span>
      {!compact && <span className="recharge-neon-sub">sans livraison</span>}
      <Zap size={10} className="recharge-neon-spark" strokeWidth={3} />
    </span>
  );
}

export default RechargeBadge;
