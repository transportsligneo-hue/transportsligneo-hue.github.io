import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Clock, CheckCircle2, Loader2, RotateCcw, Award, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type QuizQ = { question: string; choices: string[]; answer?: number; explanation?: string };
type Exam = { id: string; title: string; description: string | null; question_pool: QuizQ[]; question_count: number; time_limit_minutes: number; minimum_score: number };

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

export function ExamViewer({
  exam,
  onDone,
}: {
  exam: Exam;
  onDone: () => void;
}) {
  const [selection] = useState(() => {
    const idxs = Array.from({ length: exam.question_pool.length }, (_, i) => i);
    return shuffle(idxs).slice(0, exam.question_count);
  });
  const questions = useMemo(() => selection.map((i) => exam.question_pool[i]), [selection, exam.question_pool]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const startedAt = useRef(Date.now());
  const [remaining, setRemaining] = useState(exam.time_limit_minutes * 60);
  const [phase, setPhase] = useState<"exam" | "result">("exam");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ score: number; passed: boolean; questions: QuizQ[] } | null>(null);

  const submit = async (auto = false) => {
    if (!auto && questions.some((_, i) => answers[i] == null)) {
      if (!confirm("Certaines questions n'ont pas de réponse. Soumettre quand même ?")) return;
    }
    setSaving(true);
    const { data, error } = await supabase.rpc("submit_formation_exam" as never, {
      _exam_id: exam.id,
      _question_indexes: selection,
      _answers: answers,
      _started_at: new Date(startedAt.current).toISOString(),
    } as never);
    setSaving(false);
    if (error || !data) {
      toast.error("Erreur lors de la soumission de l'examen.");
      return;
    }
    const r = data as unknown as { score: number; passed: boolean; questions: QuizQ[] };
    setResult({ score: r.score, passed: r.passed, questions: Array.isArray(r.questions) ? r.questions : [] });
    setPhase("result");
    if (r.passed) toast.success("Examen réussi — certificat en cours de délivrance");
  };

  useEffect(() => {
    if (phase !== "exam") return;
    const t = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(t);
          void submit(true);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [phase]); // eslint-disable-line

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  if (phase === "result" && result) {
    const tier = result.score >= 90
      ? { label: "Convoyeur confirmé", tone: "gold" as const, msg: "Excellence : maîtrise complète des procédures Ligneo." }
      : result.passed
        ? { label: "Certification validée", tone: "success" as const, msg: "Certification obtenue. Les missions sont débloquées." }
        : result.score >= 70
          ? { label: "Nouvelle tentative après révision", tone: "warning" as const, msg: "Vous êtes proche du seuil. Révisez les modules ciblés." }
          : { label: "Formation complémentaire obligatoire", tone: "danger" as const, msg: "Score insuffisant. Reprenez l'ensemble des modules." };

    const toneCard =
      tier.tone === "gold"
        ? "border-amber-300 bg-gradient-to-br from-amber-50 to-white"
        : tier.tone === "success"
          ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white"
          : tier.tone === "warning"
            ? "border-orange-200 bg-orange-50"
            : "border-red-200 bg-red-50";
    const toneText =
      tier.tone === "gold"
        ? "text-amber-800"
        : tier.tone === "success"
          ? "text-emerald-700"
          : tier.tone === "warning"
            ? "text-orange-700"
            : "text-red-700";

    return (
      <div className="space-y-5">
        <div className={`rounded-2xl p-6 border shadow-pro-card ${toneCard}`}>
          <p className={`text-[11px] uppercase tracking-wider font-semibold ${toneText}`}>
            Bilan de certification
          </p>
          <div className="mt-3 flex items-baseline gap-3 flex-wrap">
            <p className={`text-5xl font-bold ${toneText}`}>{result.score}%</p>
            <p className={`text-lg font-semibold ${toneText}`}>
              ({questions.length} questions)
            </p>
          </div>
          <p
            className={`mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border ${
              tier.tone === "gold"
                ? "bg-amber-100 text-amber-800 border-amber-300"
                : tier.tone === "success"
                  ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                  : tier.tone === "warning"
                    ? "bg-orange-100 text-orange-800 border-orange-200"
                    : "bg-red-100 text-red-800 border-red-200"
            }`}
          >
            {result.passed ? <Award size={13} /> : <RotateCcw size={13} />} {tier.label}
          </p>
          <p className={`text-sm mt-3 ${toneText}`}>{tier.msg}</p>
          <p className="text-xs text-pro-muted mt-2">
            Seuil de réussite : {exam.minimum_score}%
          </p>
        </div>

        {!result.passed && result.questions.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-pro-text">
              Questions à revoir ({result.questions.filter((q, i) => q.answer != null && answers[i] !== q.answer).length}) :
            </p>
            {result.questions.map((q, qi) =>
              q.answer != null && answers[qi] !== q.answer ? (
                <div key={qi} className="rounded-xl border border-red-200 bg-white p-4 text-sm">
                  <p className="font-semibold text-pro-text">Q{qi + 1}. {q.question}</p>
                  <p className="text-red-700 mt-2">
                    Votre réponse : {answers[qi] != null ? q.choices[answers[qi]] : "—"}
                  </p>
                  <p className="text-emerald-700 mt-1">Bonne réponse : {q.choices[q.answer]}</p>
                  {q.explanation && (
                    <p className="text-pro-text-soft mt-2 text-xs italic border-l-2 border-emerald-200 pl-2">
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
              <Award size={15} /> Voir mon certificat
            </button>
          ) : (
            <button
              onClick={() => {
                setAnswers({});
                setResult(null);
                setPhase("exam");
                setRemaining(exam.time_limit_minutes * 60);
                startedAt.current = Date.now();
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-pro-accent px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
            >
              <RotateCcw size={15} /> Repasser l'examen
            </button>
          )}
          <button
            onClick={onDone}
            className="inline-flex items-center gap-2 rounded-lg border border-pro-border px-4 py-2.5 text-sm text-pro-text hover:bg-pro-bg-soft"
          >
            Retour à l'académie <ArrowRight size={15} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold text-pro-text flex items-center gap-2">
            <Award size={22} className="text-pro-gold" /> {exam.title}
          </h2>
          <p className="text-sm text-pro-text-soft mt-1">
            {questions.length} questions · {exam.time_limit_minutes} min · score minimum {exam.minimum_score}%
          </p>
        </div>
        <div
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-mono font-semibold ${
            remaining < 60 ? "bg-red-100 text-red-700" : "bg-pro-bg-soft text-pro-text"
          }`}
        >
          <Clock size={15} /> {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
        </div>
      </div>

      <div className="space-y-4">
        {questions.map((q, qi) => (
          <div key={qi} className="rounded-xl border border-pro-border bg-white p-5 shadow-pro-card">
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
        onClick={() => submit(false)}
        disabled={saving}
        className="inline-flex items-center gap-2 rounded-lg bg-pro-accent px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
        Soumettre l'examen
      </button>
    </div>
  );
}
