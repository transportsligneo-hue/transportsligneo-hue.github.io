import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2, RotateCcw, ArrowRight, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type QuizQ = { question: string; choices: string[]; answer?: number; explanation?: string };

export function ModuleQuiz({
  moduleId,
  questions,
  minimumScore,
  onDone,
}: {
  moduleId: string;
  questions: QuizQ[];
  minimumScore: number;
  onDone: () => void;
}) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ score: number; passed: boolean; review: QuizQ[] } | null>(null);

  const submit = async () => {
    if (questions.some((_, i) => answers[i] == null)) {
      toast.error("Répondez à toutes les questions.");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.rpc("submit_module_quiz" as never, {
      _module_id: moduleId,
      _answers: answers,
    } as never);
    setSaving(false);
    if (error || !data) {
      toast.error("Erreur lors de la soumission du QCM.");
      return;
    }
    const r = data as unknown as { score: number; passed: boolean; review: QuizQ[] };
    setResult({ score: r.score, passed: r.passed, review: Array.isArray(r.review) ? r.review : [] });
  };

  if (result) {
    return (
      <div className="space-y-5">
        <div
          className={`rounded-2xl p-6 border ${
            result.passed
              ? "border-emerald-200 bg-emerald-50"
              : "border-red-200 bg-red-50"
          }`}
        >
          <p
            className={`text-4xl font-bold ${
              result.passed ? "text-emerald-700" : "text-red-700"
            }`}
          >
            {result.score}%
          </p>
          <p
            className={`text-sm mt-2 font-medium ${
              result.passed ? "text-emerald-800" : "text-red-800"
            }`}
          >
            {result.passed
              ? "Module validé ! Vous pouvez passer au suivant."
              : `Score insuffisant · minimum ${minimumScore}%. Revoyez le contenu et recommencez.`}
          </p>
        </div>

        {!result.passed && result.review.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-pro-text">Questions à revoir :</p>
            {result.review.map((q, qi) =>
              q.answer != null && answers[qi] !== q.answer ? (
                <div key={qi} className="rounded-xl border border-red-200 bg-white p-4 text-sm">
                  <p className="font-semibold text-pro-text">{q.question}</p>
                  <p className="text-red-700 mt-2">
                    Votre réponse : {answers[qi] != null ? q.choices[answers[qi]] : " · "}
                  </p>
                  <p className="text-emerald-700 mt-1">
                    Bonne réponse : {q.choices[q.answer]}
                  </p>
                  {q.explanation && (
                    <p className="text-pro-text-soft mt-2 text-xs border-l-2 border-emerald-200 pl-2">
                      {q.explanation}
                    </p>
                  )}
                </div>
              ) : null
            )}
          </div>
        )}

        <div className="flex gap-3 flex-wrap">
          {result.passed ? (
            <button
              onClick={onDone}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Continuer <ArrowRight size={15} />
            </button>
          ) : (
            <button
              onClick={() => {
                setAnswers({});
                setResult(null);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-pro-accent px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
            >
              <RotateCcw size={15} /> Recommencer
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-pro-text flex items-center gap-2">
          <CheckCircle2 size={20} className="text-pro-gold" /> Quiz de fin de module
        </h3>
        <span className="text-xs text-pro-muted">Score minimum : {minimumScore}%</span>
      </div>
      <div className="space-y-4">
        {questions.map((q, qi) => (
          <div key={qi} className="rounded-xl border border-pro-border bg-white p-4 shadow-pro-card">
            <p className="text-sm font-semibold text-pro-text">
              {qi + 1}. {q.question}
            </p>
            <div className="mt-3 space-y-2">
              {q.choices.map((c, ci) => (
                <button
                  key={ci}
                  type="button"
                  onClick={() => setAnswers((a) => ({ ...a, [qi]: ci }))}
                  className={`w-full rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                    answers[qi] === ci
                      ? "border-pro-accent bg-pro-accent/10 text-pro-text"
                      : "border-pro-border bg-white text-pro-text-soft hover:bg-pro-bg-soft"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={submit}
        disabled={saving}
        className="inline-flex items-center gap-2 rounded-lg bg-pro-accent px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
        Valider le QCM
      </button>
    </div>
  );
}
