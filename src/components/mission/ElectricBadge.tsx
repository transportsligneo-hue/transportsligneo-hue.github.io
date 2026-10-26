/**
 * Badge motorisation · visible partout où une mission/un véhicule apparaît
 * (catalogue convoyeur, détail mission, admin, espace client) afin que le
 * convoyeur sache AVANT d'accepter qu'il devra gérer la recharge.
 *
 * Deux cas distincts :
 *  - 100 % électrique  → "Électrique · recharge uniquement" (pas de carburant)
 *  - hybride rechargeable → "Hybride rechargeable" (carburant + câble)
 */
import { Zap, PlugZap, Flame, Leaf } from "lucide-react";
import { resolveMotorisation, MOTORISATION_LABEL, type Motorisation } from "@/lib/vehicle-meta";
import { isElectricEnergie, isHybrideEnergie, guessElectricFromModel } from "@/lib/vehicule-electrique";

interface Props {
  energie?: string | null;
  /** Autres sources possibles de l'énergie (carburant mission, devis…) — la première renseignée gagne. */
  alt?: (string | null | undefined)[];
  marque?: string | null;
  modele?: string | null;
  /** Force l'affichage électrique (quand la détection est faite en amont). */
  force?: boolean;
  size?: "sm" | "md";
  variant?: "dark" | "light";
  /** Version courte (listes denses). */
  compact?: boolean;
  className?: string;
}

type Kind = "electrique" | "hybride" | null;

/** Conservé pour les filtres existants : électrique / hybride rechargeable uniquement. */
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

/** Couleurs : électrique = bleu néon électrique · hybride = violet · thermique = orange brûlé. */
const TONES: Record<Motorisation, { light: string; dark: string; Icon: typeof Zap; glow: string }> = {
  electrique: { light: "#1f4dff", dark: "#6ea2ff", Icon: Zap, glow: "rgba(31,77,255,.45)" },
  hybride_rechargeable: { light: "#7c3aed", dark: "#b79bff", Icon: PlugZap, glow: "rgba(124,58,237,.35)" },
  hybride: { light: "#7c3aed", dark: "#b79bff", Icon: Leaf, glow: "rgba(124,58,237,.30)" },
  thermique: { light: "#c2410c", dark: "#ffa66b", Icon: Flame, glow: "rgba(194,65,12,.30)" },
};

export function ElectricBadge({
  energie, alt, marque, modele, force, size = "sm", variant = "dark", compact = false, className = "",
}: Props) {
  const info = force ? { kind: "electrique" as Motorisation, inferred: false } : resolveMotorisation([energie, ...(alt ?? [])], marque, modele);
  const kind = info.kind;
  if (!kind) return null;

  const isSm = size === "sm";
  const { Icon } = TONES[kind];
  const label =
    kind === "electrique" ? (compact ? "Électrique" : "Électrique · recharge uniquement")
    : kind === "hybride_rechargeable" ? (compact ? "Hybride rech." : MOTORISATION_LABEL.hybride_rechargeable)
    : MOTORISATION_LABEL[kind];
  const color = variant === "dark" ? TONES[kind].dark : TONES[kind].light;

  return (
    <span
      className={className}
      title={
        kind === "electrique"
          ? "Véhicule 100 % électrique — aucune station-service : prévoir la recharge et contrôler les câbles"
          : kind === "hybride_rechargeable"
            ? "Hybride rechargeable — câble de recharge à contrôler"
            : kind === "hybride" ? "Hybride" : "Thermique (essence / diesel)"
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
        border: `1px solid ${color}${kind === "electrique" ? "99" : "55"}`,
        boxShadow: kind === "electrique" ? `0 0 12px ${TONES[kind].glow}` : undefined,
      }}
    >
      <Icon size={isSm ? 11 : 13} strokeWidth={2.6} /> {label}
    </span>
  );
}
