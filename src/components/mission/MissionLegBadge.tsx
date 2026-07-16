import { ArrowRight, ArrowLeft } from "lucide-react";

type Leg = "simple" | "aller" | "retour" | null | undefined;

const styles: Record<string, string> = {
  aller: "bg-indigo-50 text-indigo-700 border-indigo-200",
  retour: "bg-amber-50 text-amber-700 border-amber-200",
};

export function MissionLegBadge({ leg, size = "sm" }: { leg: Leg; size?: "xs" | "sm" }) {
  if (!leg || leg === "simple") return null;
  const label = leg === "aller" ? "Aller" : "Retour";
  const Icon = leg === "aller" ? ArrowRight : ArrowLeft;
  const cls =
    size === "xs"
      ? "text-[10px] px-1.5 py-0.5 gap-1"
      : "text-xs px-2 py-0.5 gap-1";
  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium ${styles[leg]} ${cls}`}
      title={leg === "aller" ? "Mission Aller d'un aller-retour" : "Mission Retour d'un aller-retour"}
    >
      <Icon size={size === "xs" ? 10 : 11} />
      {label}
    </span>
  );
}
