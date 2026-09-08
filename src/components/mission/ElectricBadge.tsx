/**
 * Badge motorisation · visible partout où une mission/un véhicule apparaît
 * (catalogue convoyeur, détail mission, admin, espace client) afin que le
 * convoyeur sache AVANT d'accepter qu'il devra gérer la recharge.
 *
 * Deux cas distincts :
 *  - 100 % électrique  → "Électrique · recharge uniquement" (pas de carburant)
 *  - hybride rechargeable → "Hybride rechargeable" (carburant + câble)
 */
import { Zap, PlugZap } from "lucide-react";
import { isElectricEnergie, isHybrideEnergie, guessElectricFromModel } from "@/lib/vehicule-electrique";

interface Props {
  energie?: string | null;
  marque?: string | null;
  modele?: string | null;
  /** Force l'affichage (quand la détection est faite en amont). */
  force?: boolean;
  size?: "sm" | "md";
  variant?: "dark" | "light";
  /** Version courte "Électrique" (listes denses). */
  compact?: boolean;
  className?: string;
}

type Kind = "electrique" | "hybride" | null;

export function resolveMotorisationKind(
  energie?: string | null,
  marque?: string | null,
  modele?: string | null,
): Kind {
  const e = energie ?? "";
  if (/hybride?\s*rechargeable|phev|plug.?in/i.test(e)) return "hybride";
  if (isElectricEnergie(e)) return "electrique";
  if (isHybrideEnergie(e)) return null;
  if (guessElectricFromModel(marque, modele)) return "electrique";
  return null;
}

export function ElectricBadge({
  energie, marque, modele, force, size = "sm", variant = "dark", compact = false, className = "",
}: Props) {
  const kind: Kind = force ? "electrique" : resolveMotorisationKind(energie, marque, modele);
  if (!kind) return null;

  const isSm = size === "sm";
  const electrique = kind === "electrique";
  const Icon = electrique ? Zap : PlugZap;
  const label = electrique
    ? (compact ? "Électrique" : "Électrique · recharge uniquement")
    : (compact ? "Hybride rech." : "Hybride rechargeable");

  const accent = electrique
    ? { dark: "#34E8B0", light: "#0B7D5C" }
    : { dark: "#8FD3FF", light: "#0A5FA8" };
  const color = variant === "dark" ? accent.dark : accent.light;

  return (
    <span
      className={className}
      title={
        electrique
          ? "Véhicule 100 % électrique — aucune station-service : prévoir la recharge et contrôler les câbles"
          : "Hybride rechargeable — câble de recharge à contrôler"
      }
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: isSm ? 4 : 6,
        padding: isSm ? "3px 8px" : "5px 11px",
        borderRadius: 999,
        fontSize: isSm ? 10.5 : 12,
        fontWeight: 800,
        letterSpacing: "0.03em",
        lineHeight: 1.15,
        whiteSpace: "nowrap",
        color,
        background: variant === "dark" ? `${color}1f` : `${color}14`,
        border: `1px solid ${color}55`,
      }}
    >
      <Icon size={isSm ? 11 : 13} strokeWidth={2.6} /> {label}
    </span>
  );
}
