import { Link } from "@tanstack/react-router";
import { CheckCircle2, Circle, Clock3, GraduationCap } from "lucide-react";
import type { ModuleProgress, TrainingModule } from "@/lib/formation/types";
import { moduleStatus, STATUS_LABEL } from "@/lib/formation/types";

export function TrainingSidebar({
  modules,
  progress,
  percent,
  activeId,
  onNavigate,
}: {
  modules: TrainingModule[];
  progress: Record<string, ModuleProgress>;
  percent: number;
  activeId?: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-pro-border bg-white overflow-hidden">
      <div className="driver-training-hero p-4">
        <p className="driver-training-accent text-[11px] uppercase tracking-[0.18em] font-semibold flex items-center gap-2">
          <GraduationCap size={14} /> Formation convoyeur
        </p>
        <div className="mt-3 flex items-center justify-between text-xs driver-training-copy">
          <span>Progression globale</span>
          <span className="font-semibold">{percent}%</span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-white/15 overflow-hidden">
          <div
            className="h-full rounded-full driver-training-progress transition-all duration-700"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
      <nav className="p-2 max-h-[60vh] overflow-y-auto">
        {modules.map((m) => {
          const st = moduleStatus(progress[m.id]);
          const active = activeId === m.id;
          return (
            <Link
              key={m.id}
              to="/convoyeur/formation/module/$id"
              params={{ id: m.id }}
              onClick={onNavigate}
              className={`flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                active ? "bg-[#2F5FFF]/10 border border-[#2F5FFF]/30" : "hover:bg-pro-bg-soft border border-transparent"
              }`}
            >
              <span className="mt-0.5 shrink-0">
                {st === "done" ? (
                  <CheckCircle2 size={16} className="text-emerald-600" />
                ) : st === "in_progress" ? (
                  <Clock3 size={16} className="driver-training-accent" />
                ) : (
                  <Circle size={16} className="text-pro-muted" />
                )}
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-medium text-pro-text truncate">
                  {m.order_index}. {m.title}
                </span>
                <span className="block text-[11px] text-pro-muted">
                  {STATUS_LABEL[st]} · {m.duration_minutes} min
                </span>
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export default TrainingSidebar;
