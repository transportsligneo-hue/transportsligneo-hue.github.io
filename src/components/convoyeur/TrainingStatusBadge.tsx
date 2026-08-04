import { GraduationCap, CheckCircle2, Clock } from "lucide-react";

export type TrainingStatut = "a_demarrer" | "en_cours" | "validee";

export function resolveTrainingStatut(
  hasCompleted: boolean,
  completedCount: number,
): TrainingStatut {
  if (hasCompleted) return "validee";
  return completedCount > 0 ? "en_cours" : "a_demarrer";
}

const STYLES: Record<TrainingStatut, { label: string; className: string }> = {
  a_demarrer: {
    label: "Formation à démarrer",
    className: "border-white/25 bg-white/10 text-white/80",
  },
  en_cours: {
    label: "Formation en cours",
    className: "border-amber-300/40 bg-amber-500/15 text-amber-100",
  },
  validee: {
    label: "Formation validée",
    className: "border-emerald-400/40 bg-emerald-500/15 text-emerald-100",
  },
};

export function TrainingStatusBadge({
  statut,
  percent,
  className = "",
}: {
  statut: TrainingStatut;
  percent?: number;
  className?: string;
}) {
  const s = STYLES[statut];
  const Icon = statut === "validee" ? CheckCircle2 : statut === "en_cours" ? Clock : GraduationCap;
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold ${s.className} ${className}`}
    >
      <Icon size={13} />
      {s.label}
      {statut !== "validee" && typeof percent === "number" ? ` · ${percent}%` : ""}
    </span>
  );
}
