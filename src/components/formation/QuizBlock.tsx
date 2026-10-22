import { useMemo, useState } from "react";
import { CheckCircle2, XCircle, Trophy, Loader2, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { QuizQuestion } from "@/lib/formation/types";
import { PASS_SCORE } from "@/lib/formation/types";

type Result = { score: number; passed: boolean; results: { index: number; correct: boolean; answer: number; answers?: number[]; explanation: string | null }[] };

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
  const [answers, setAnswers] = useState<Record<number, number | number[]>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);

  // Ordre d'affichage des réponses mélangé (une fois par affichage / réessai).
  // On garde les indices d'origine pour la correction côté serveur.
  const [shuffleKey, setShuffleKey] = useState(0);
  const orders = useMemo(
    () =>
      questions.map((q) => {
        const idx = q.choices.map((_, i) => i);
        for (let i = idx.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [idx[i], idx[j]] = [idx[j], idx[i]];
        }
        return idx;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [questions, shuffleKey],
  );

  if (!questions.length) return null;

  const submit = async () => {
    setLoading(true);
    const payload = questions.map((q, i) => (q.multiple ? (answers[i] ?? []) : (answers[i] ?? -1)));
    const { data, error } = await supabase.rpc("submit_module_quiz", { _module_id: moduleId, _answers: payload });
    setLoading(false);
    if (error || !data) return;
    const r = data as unknown as Result;
    r.passed = r.score >= PASS_SCORE;
    setResult(r);
    if (r.passed) onPassed();
  };

  const allAnswered = questions.every((q, i) =>
    q.multiple ? Array.isArray(answers[i]) && (answers[i] as number[]).length > 0 : answers[i] !== undefined,
  );
  const isPicked = (qi: number, ci: number) => {
    const a = answers[qi];
    return Array.isArray(a) ? a.includes(ci) : a === ci;
  };
  const pick = (qi: number, ci: number, multiple?: boolean) =>
    setAnswers((a) => {
      if (!multiple) return { ...a, [qi]: ci };
      const cur = Array.isArray(a[qi]) ? (a[qi] as number[]) : [];
      return { ...a, [qi]: cur.includes(ci) ? cur.filter((x) => x !== ci) : [...cur, ci] };
    });

  return (
    <section className="fm-card">
      <div className="fm-card-h" style={{ marginBottom: 4 }}>
        <h3 className="fm-card-t"><span className="fm-ic"><Trophy size={16} /></span> Quiz de validation</h3>
      </div>
      <p className="fm-sub" style={{ marginBottom: 16 }}>
        Score minimum {PASS_SCORE} % · {attempts} tentative{attempts > 1 ? "s" : ""}
        {bestScore !== null ? ` · meilleur score ${bestScore} %` : ""} · tentatives illimitées
      </p>

      <div className="fm-qs">
        {questions.map((q, i) => {
          const res = result?.results.find((r) => r.index === i);
          return (
            <div key={i}>
              <p className="fm-q">{i + 1}. {q.question}</p>
              {q.multiple && <p className="fm-qh">Plusieurs réponses possibles : cochez toutes les bonnes.</p>}
              <div className="fm-opts">
                {orders[i].map((ci, pos) => {
                  const c = q.choices[ci];
                  const picked = isPicked(i, ci);
                  const goodSet = res ? (res.answers ?? [res.answer]) : [];
                  const isGood = !!res && goodSet.includes(ci);
                  const isBadPick = !!res && picked && !goodSet.includes(ci);
                  const state = isGood ? " ok" : isBadPick ? " ko" : picked ? " sel" : "";
                  return (
                    <button key={ci} type="button" disabled={!!result} onClick={() => pick(i, ci, q.multiple)} className={`fm-opt${state}`}>
                      <span className="fm-l">{String.fromCharCode(65 + pos)}</span>
                      <span>{c}</span>
                    </button>
                  );
                })}
              </div>
              {res && (
                <p className={`fm-expl ${res.correct ? "ok" : "ko"}`}>
                  {res.correct ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                  <span>{res.explanation}</span>
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="fm-act">
        {!result ? (
          <button type="button" disabled={!allAnswered || loading} onClick={() => void submit()} className="fm-cta">
            {loading && <Loader2 size={15} className="fm-spin" />} Valider le quiz
          </button>
        ) : (
          <>
            <span className={`fm-score ${result.passed ? "ok" : "ko"}`}>
              {result.passed ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
              {result.score} % · {result.passed ? "Quiz réussi" : "Quiz non validé"}
            </span>
            {!result.passed && (
              <button
                type="button"
                onClick={() => {
                  setResult(null);
                  setAnswers({});
                  setShuffleKey((k) => k + 1);
                }}
                className="fm-link"
              >
                <RotateCcw size={15} /> Réessayer
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}

export default QuizBlock;
