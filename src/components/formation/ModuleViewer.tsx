import { useEffect } from "react";
import { ArrowLeft, BookOpen, CheckCircle2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { RichSection } from "./RichSection";
import { ModuleQuiz } from "./ModuleQuiz";

type Section =
  | { type: "text"; content: string }
  | { type: "image"; url: string; alt?: string; caption?: string }
  | { type: "video"; url: string }
  | { type: "checklist"; items: string[] }
  | { type: "callout"; tone?: "info" | "warning" | "success"; content: string };

type QuizQ = { question: string; choices: string[]; answer?: number; explanation?: string };

type Module = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  estimated_minutes: number;
  category: string;
  minimum_score: number;
  quiz_questions: QuizQ[];
  sections: Section[];
};

export function ModuleViewer({
  module,
  isCompleted,
  convoyeurId,
  onBack,
  onDone,
}: {
  module: Module;
  isCompleted: boolean;
  convoyeurId: string;
  onBack: () => void;
  onDone: () => void;
}) {
  useEffect(() => {
    if (!isCompleted) {
      void supabase.from("formation_progress" as never).upsert(
        {
          convoyeur_id: convoyeurId,
          module_id: module.id,
          status: "in_progress",
          last_seen_at: new Date().toISOString(),
        } as never,
        { onConflict: "convoyeur_id,module_id" } as never
      );
    }
  }, [convoyeurId, module.id, isCompleted]);

  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="text-sm text-pro-accent hover:underline flex items-center gap-1"
      >
        <ArrowLeft size={14} /> Retour à l'académie
      </button>

      <div className="rounded-2xl border border-pro-border bg-white p-6 shadow-pro-card">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-pro-muted font-semibold flex items-center gap-1.5">
              <BookOpen size={13} /> Module · {module.category}
            </p>
            <h1 className="text-2xl font-semibold text-pro-text mt-1">{module.title}</h1>
            {module.description && (
              <p className="text-sm text-pro-text-soft mt-1">{module.description}</p>
            )}
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-pro-border bg-pro-bg-soft px-3 py-1.5 text-xs font-medium text-pro-muted">
            <Clock size={12} /> {module.estimated_minutes} min
          </span>
        </div>

        <div className="mt-8 space-y-6">
          {module.sections.map((s, i) => (
            <RichSection key={i} section={s} />
          ))}
        </div>
      </div>

      {isCompleted ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 flex items-center gap-3">
          <CheckCircle2 size={22} className="text-emerald-600" />
          <div>
            <p className="text-sm font-semibold text-emerald-800">Module déjà validé</p>
            <p className="text-xs text-emerald-700">Vous pouvez passer au module suivant ou revoir le contenu.</p>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-pro-border bg-white p-6 shadow-pro-card">
          <ModuleQuiz
            moduleId={module.id}
            questions={module.quiz_questions}
            minimumScore={module.minimum_score}
            onDone={onDone}
          />
        </div>
      )}
    </div>
  );
}
