import { useState } from "react";
import { CheckCircle2, XCircle, Puzzle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { CaseStudy } from "@/lib/formation/types";

export function CaseStudyBlock({
  moduleId,
  caseStudy,
  initialAnswer,
}: {
  moduleId: string;
  caseStudy: CaseStudy;
  initialAnswer: number | null;
}) {
  const [selected, setSelected] = useState<number | null>(initialAnswer);
  const [feedback, setFeedback] = useState<{ correct: boolean; feedback: string } | null>(null);
  const [loading, setLoading] = useState(false);

  if (!caseStudy?.scenario) return null;

  const choose = async (i: number) => {
    setSelected(i);
    setLoading(true);
    const { data, error } = await supabase.rpc("submit_case_study", { _module_id: moduleId, _choice: i });
    setLoading(false);
    if (!error && data) setFeedback(data as unknown as { correct: boolean; feedback: string });
  };

  return (
    <section className="rounded-2xl border border-pro-border bg-white p-5">
      <h3 className="text-sm font-semibold text-pro-text flex items-center gap-2 mb-2">
        <Puzzle size={16} className="text-[#2F5FFF]" /> Étude de cas
      </h3>
      <p className="text-sm text-pro-text-soft leading-relaxed mb-4">{caseStudy.scenario}</p>
      <div className="space-y-2">
        {(caseStudy.choices ?? []).map((c, i) => (
          <button
            key={i}
            type="button"
            disabled={loading}
            onClick={() => void choose(i)}
            className={`w-full text-left rounded-xl border px-4 py-3 text-sm transition-all ${
              selected === i
                ? feedback
                  ? feedback.correct
                    ? "border-emerald-400 bg-emerald-50 text-emerald-900"
                    : "border-red-300 bg-red-50 text-red-900"
                  : "border-[#2F5FFF] bg-[#2F5FFF]/5"
                : "border-pro-border hover:border-[#2F5FFF]/40 text-pro-text-soft"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
      {loading && <p className="mt-3 text-xs text-pro-muted flex items-center gap-2"><Loader2 size={12} className="animate-spin" /> Analyse…</p>}
      {feedback && (
        <div
          className={`mt-4 rounded-xl p-4 text-sm flex gap-3 ${
            feedback.correct ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"
          }`}
        >
          {feedback.correct ? <CheckCircle2 size={18} className="shrink-0" /> : <XCircle size={18} className="shrink-0" />}
          <span>{feedback.feedback}</span>
        </div>
      )}
    </section>
  );
}

export default CaseStudyBlock;
