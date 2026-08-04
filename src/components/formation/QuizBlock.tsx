import { useState } from "react";
import { CheckCircle2, XCircle, Trophy, Loader2, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { QuizQuestion } from "@/lib/formation/types";
import { PASS_SCORE } from "@/lib/formation/types";

type Result = { score: number; passed: boolean; results: { index: number; correct: boolean; answer: number; explanation: string | null }[] };

export function QuizBlock({
  moduleId,
  questions,
  bestScore,
  attempts,
  onPassed,
}: {
  moduleId: string;
  questions: QuizQuestion[];
  bestScore: number | null;
  attempts: number;
  onPassed: () => void;
}) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);

  if (!questions.length) return null;

  const submit = async () => {
    setLoading(true);
    const payload = questions.map((_, i) => answers[i] ?? -1);
    const { data, error } = await supabase.rpc("submit_module_quiz", { _module_id: moduleId, _answers: payload });
    setLoading(false);
    if (error || !data) return;
    const r = data as unknown as Result;
    setResult(r);
    if (r.passed) onPassed();
  };

  const allAnswered = questions.every((_, i) => answers[i] !== undefined);

  return (
    <section className="rounded-2xl border border-pro-border bg-white p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-pro-text flex items-center gap-2">
          <Trophy size={16} className="text-[#B8862A]" /> Quiz de validation
        </h3>
        <span className="text-xs text-pro-muted">
          Score minimum {PASS_SCORE}% · {attempts} tentative{attempts > 1 ? "s" : ""}
          {bestScore !== null ? ` · meilleur ${bestScore}%` : ""}
        </span>
      </div>
      <p className="text-xs text-pro-muted mb-4">Tentatives illimitées en cas d'échec.</p>

      <div className="space-y-5">
        {questions.map((q, i) => {
          const res = result?.results.find((r) => r.index === i);
          return (
            <div key={i}>
              <p className="text-sm font-medium text-pro-text mb-2">
                {i + 1}. {q.question}
              </p>
              <div className="space-y-1.5">
                {q.choices.map((c, ci) => {
                  const picked = answers[i] === ci;
                  const isGood = res && res.answer === ci;
                  const isBadPick = res && picked && !res.correct;
                  return (
                    <button
                      key={ci}
                      type="button"
                      disabled={!!result}
                      onClick={() => setAnswers((a) => ({ ...a, [i]: ci }))}
                      className={`w-full text-left rounded-lg border px-3 py-2 text-sm transition-all ${
                        isGood
                          ? "border-emerald-400 bg-emerald-50 text-emerald-900"
                          : isBadPick
                            ? "border-red-300 bg-red-50 text-red-900"
                            : picked
                              ? "border-[#2F5FFF] bg-[#2F5FFF]/5 text-pro-text"
                              : "border-pro-border hover:border-[#2F5FFF]/40 text-pro-text-soft"
                      }`}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
              {res && (
                <p className={`mt-2 text-xs flex items-start gap-1.5 ${res.correct ? "text-emerald-700" : "text-amber-700"}`}>
                  {res.correct ? <CheckCircle2 size={13} className="mt-0.5" /> : <XCircle size={13} className="mt-0.5" />}
                  {res.explanation}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex items-center gap-3">
        {!result ? (
          <button
            type="button"
            disabled={!allAnswered || loading}
            onClick={() => void submit()}
            className="rounded-xl bg-[#0B1338] text-white text-sm font-semibold px-5 py-2.5 disabled:opacity-40 hover:bg-[#111a3d] transition-colors flex items-center gap-2"
          >
            {loading && <Loader2 size={14} className="animate-spin" />} Valider le quiz
          </button>
        ) : (
          <>
            <span
              className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
                result.passed ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
              }`}
            >
              {result.score}% — {result.passed ? "Réussi" : "Échec"}
            </span>
            {!result.passed && (
              <button
                type="button"
                onClick={() => {
                  setResult(null);
                  setAnswers({});
                }}
                className="text-sm text-[#2F5FFF] font-medium flex items-center gap-1.5"
              >
                <RotateCcw size={14} /> Réessayer
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}

export default QuizBlock;
