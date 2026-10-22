import { Link } from "@tanstack/react-router";
import { Check, GraduationCap } from "lucide-react";
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
    <div className="fm-side">
      <div className="fm-side-h">
        <p className="fm-eyebrow"><GraduationCap size={14} /> Formation convoyeur</p>
        <div className="fm-side-r">
          <span>Progression</span>
          <b>{percent} %</b>
        </div>
        <div className="fm-bar"><i style={{ width: `${percent}%` }} /></div>
      </div>
      <nav className="fm-side-l">
        {modules.map((m) => {
          const st = moduleStatus(progress[m.id]);
          const cls = st === "done" ? " done" : st === "in_progress" ? " prog" : "";
          return (
            <Link
              key={m.id}
              to="/convoyeur/formation/module/$id"
              params={{ id: m.id }}
              onClick={onNavigate}
              className={`fm-si${cls}${activeId === m.id ? " on" : ""}`}
            >
              <span className="fm-si-n">{st === "done" ? <Check size={14} strokeWidth={3} /> : m.order_index}</span>
              <span style={{ minWidth: 0 }}>
                <b>{m.title}</b>
                <small>{STATUS_LABEL[st]}</small>
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export default TrainingSidebar;
