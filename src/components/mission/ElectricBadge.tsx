/**
 * Badge "véhicule électrique" · visible partout où une mission apparaît
 * (catalogue convoyeur, détail mission, admin, espace client) afin que le
 * convoyeur puisse en tenir compte AVANT d'accepter la mission.
 */
import { Zap } from "lucide-react";
import { isElectricEnergie } from "@/lib/vehicule-electrique";

interface Props {
  energie?: string | null;
  marque?: string | null;
  modele?: string | null;
  /** Force l'affichage (quand la détection est faite en amont). */
  force?: boolean;
  size?: "sm" | "md";
  variant?: "dark" | "light";
  className?: string;
}

export function ElectricBadge({
  energie, force, size = "sm", variant = "dark", className = "",
}: Props) {
  const show = force ?? isElectricEnergie(energie);
  if (!show) return null;

  const isSm = size === "sm";
  return (
    <span
      className={className}
      title="Véhicule électrique — câbles de recharge à contrôler"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: isSm ? 4 : 6,
        padding: isSm ? "3px 8px" : "5px 11px",
        borderRadius: 999,
        fontSize: isSm ? 10.5 : 12,
        fontWeight: 800,
        letterSpacing: "0.04em",
        whiteSpace: "nowrap",
        color: variant === "dark" ? "#34E8B0" : "#0B7D5C",
        background: variant === "dark" ? "rgba(52,232,176,0.12)" : "rgba(11,125,92,0.10)",
        border: `1px solid ${variant === "dark" ? "rgba(52,232,176,0.38)" : "rgba(11,125,92,0.28)"}`,
      }}
    >
      <Zap size={isSm ? 11 : 13} strokeWidth={2.6} /> Électrique
    </span>
  );
}
