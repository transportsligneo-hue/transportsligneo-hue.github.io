import { CheckCircle2, Clock, Lock, PlayCircle } from "lucide-react";

export type ModuleStatus = "locked" | "available" | "in_progress" | "completed";

export function ModuleCard({
  index,
  title,
  description,
  minutes,
  status,
  onClick,
}: {
  index: number;
  title: string;
  description?: string | null;
  minutes: number;
  status: ModuleStatus;
  onClick: () => void;
}) {
  const isLocked = status === "locked";
  const isDone = status === "completed";
  const isInProgress = status === "in_progress";

  return (
    <button
      onClick={onClick}
      disabled={isLocked}
      className={`group relative rounded-2xl border p-5 text-left transition-all duration-200 ${
        isLocked
          ? "border-pro-border/60 bg-pro-bg-soft/40 opacity-70 cursor-not-allowed"
          : isDone
            ? "border-emerald-200 bg-emerald-50/40 hover:shadow-pro-card-hover"
            : isInProgress
              ? "border-pro-gold bg-pro-gold-soft hover:shadow-pro-card-hover"
              : "border-pro-border bg-white hover:border-pro-accent/40 hover:shadow-pro-card-hover"
      }`}
    >
      <div className="flex items-start gap-4">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
            isDone
              ? "bg-emerald-100 text-emerald-700"
              : isInProgress
                ? "bg-pro-accent text-white"
                : isLocked
                  ? "bg-pro-bg-soft text-pro-muted"
                  : "bg-pro-bg-soft text-pro-text"
          }`}
        >
          {isDone ? <CheckCircle2 size={20} /> : index}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-pro-text leading-snug">{title}</p>
          <p className="text-[11px] text-pro-muted flex items-center gap-2 mt-1.5">
            <Clock size={11} /> {minutes} min
          </p>
          {description && (
            <p className="text-xs text-pro-text-soft mt-2 line-clamp-2">{description}</p>
          )}
        </div>
        {isLocked && <Lock size={16} className="text-pro-muted shrink-0" />}
        {isInProgress && <PlayCircle size={18} className="text-pro-accent shrink-0" />}
      </div>
    </button>
  );
}
