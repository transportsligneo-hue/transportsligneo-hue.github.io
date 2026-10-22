import { useState } from "react";
import { CheckCircle2, XCircle, Puzzle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { CaseStudy } from "@/lib/formation/types";

export function CaseStudyBlock({
  moduleId,
  caseStudy,
  initialAnswer,
  caseIndex = 0,
  total = 1,
}: {
  caseIndex?: number;
  total?: number;
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
    const { data, error } = await supabase.rpc("submit_case_study_at", { _module_id: moduleId, _case_index: caseIndex, _choice: i });
    setLoading(false);
    if (!error && data) setFeedback(data as unknown as { correct: boolean; feedback: string });
  };

  return (
    <section className="fm-card">
      <div className="fm-card-h">
        <h3 className="fm-card-t"><span className="fm-ic"><Puzzle size={16} /></span> Mise en situation{total > 1 ? ` ${caseIndex + 1}/${total}` : ""}</h3>
      </div>
      <p className="fm-q" style={{ fontWeight: 500, lineHeight: 1.65, marginBottom: 14 }}>{caseStudy.scenario}</p>
      <div className="fm-opts">
        {(caseStudy.choices ?? []).map((c, i) => {
          const state = selected === i ? (feedback ? (feedback.correct ? " ok" : " ko") : " sel") : "";
          return (
            <button key={i} type="button" disabled={loading} onClick={() => void choose(i)} className={`fm-opt${state}`}>
              <span className="fm-l">{String.fromCharCode(65 + i)}</span>
              <span>{c.label}</span>
            </button>
          );
        })}
      </div>
      {loading && <p className="fm-fine" style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}><Loader2 size={13} className="fm-spin" /> Analyse en cours</p>}
      {feedback && (
        <div className={`fm-fb ${feedback.correct ? "ok" : "ko"}`}>
          {feedback.correct ? <CheckCircle2 size={18} color="#14B866" /> : <XCircle size={18} color="#d97706" />}
          <span>{feedback.feedback}</span>
        </div>
      )}
    </section>
  );
}

export default CaseStudyBlock;
