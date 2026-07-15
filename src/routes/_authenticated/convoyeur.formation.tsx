import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  ArrowRight,
  Award,
  CheckCircle2,
  FileText,
  GraduationCap,
  HelpCircle,
  Loader2,
  Lock,
  PlayCircle,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/convoyeur/formation")({
  component: ConvoyeurFormation,
});

type QuizQuestion = {
  question: string;
  choices: string[];
  answer: number;
};

type FormationModule = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  content_type: "text" | "video" | "quiz";
  content_url: string | null;
  content_body: string | null;
  quiz_questions: QuizQuestion[];
  minimum_score: number;
  estimated_minutes: number;
  sort_order: number;
};

type FormationProgress = {
  id: string;
  module_id: string;
  status: "not_started" | "in_progress" | "completed";
  score: number | null;
  completed_at: string | null;
};

type ConvoyeurTraining = {
  id: string;
  has_completed_training: boolean;
  training_status: "not_started" | "in_progress" | "completed";
  training_completed_at: string | null;
};

function ConvoyeurFormation() {
  const { user } = useAuth();
  const [convoyeur, setConvoyeur] = useState<ConvoyeurTraining | null>(null);
  const [modules, setModules] = useState<FormationModule[]>([]);
  const [progress, setProgress] = useState<FormationProgress[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);

    const { data: convData } = await supabase
      .from("convoyeurs")
      .select("id, has_completed_training, training_status, training_completed_at")
      .eq("user_id", user.id)
      .maybeSingle();

    const conv = convData as ConvoyeurTraining | null;
    setConvoyeur(conv);

    if (!conv) {
      setLoading(false);
      return;
    }

    const [{ data: moduleRows }, { data: progressRows }] = await Promise.all([
      supabase
        .from("formation_modules" as never)
        .select("id, slug, title, description, content_type, content_url, content_body, quiz_questions, minimum_score, estimated_minutes, sort_order" as never)
        .eq("is_active" as never, true as never)
        .order("sort_order" as never, { ascending: true }),
      supabase
        .from("formation_progress" as never)
        .select("id, module_id, status, score, completed_at" as never)
        .eq("convoyeur_id" as never, conv.id as never),
    ]);

    const nextModules = ((moduleRows ?? []) as unknown as FormationModule[]).map((m) => ({
      ...m,
      quiz_questions: Array.isArray(m.quiz_questions) ? m.quiz_questions : [],
    }));
    const nextProgress = (progressRows ?? []) as unknown as FormationProgress[];

    setModules(nextModules);
    setProgress(nextProgress);
    setSelectedId((current) => current ?? nextModules.find((m) => nextProgress.find((p) => p.module_id === m.id)?.status !== "completed")?.id ?? nextModules[0]?.id ?? null);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const progressMap = useMemo(() => new Map(progress.map((p) => [p.module_id, p])), [progress]);
  const completedCount = modules.filter((m) => progressMap.get(m.id)?.status === "completed").length;
  const selected = modules.find((m) => m.id === selectedId) ?? null;
  const selectedProgress = selected ? progressMap.get(selected.id) : null;
  const percent = modules.length ? Math.round((completedCount / modules.length) * 100) : 0;

  const markModule = async (module: FormationModule, score: number) => {
    if (!convoyeur) return;
    setSaving(true);
    const completedAt = new Date().toISOString();
    const { error } = await supabase
      .from("formation_progress" as never)
      .upsert({
        convoyeur_id: convoyeur.id,
        module_id: module.id,
        status: "completed",
        score,
        completed_at: completedAt,
        last_seen_at: completedAt,
      } as never, { onConflict: "convoyeur_id,module_id" } as never);

    if (!error && module.content_type === "quiz") {
      await supabase.from("formation_quiz_attempts" as never).insert({
        convoyeur_id: convoyeur.id,
        module_id: module.id,
        score,
        passed: score >= module.minimum_score,
        answers,
      } as never);
    }

    setSaving(false);
    if (error) {
      toast.error("Progression non enregistrée", { description: error.message });
      return;
    }
    setAnswers({});
    toast.success(score >= module.minimum_score ? "Module validé" : "Tentative enregistrée");
    await load();
  };

  const submitQuiz = async () => {
    if (!selected) return;
    const questions = selected.quiz_questions ?? [];
    if (questions.some((_, index) => answers[index] == null)) {
      toast.error("Répondez à toutes les questions avant de valider.");
      return;
    }
    const correct = questions.filter((q, index) => answers[index] === q.answer).length;
    const score = questions.length ? Math.round((correct / questions.length) * 100) : 100;
    if (score < selected.minimum_score) {
      await supabase.from("formation_quiz_attempts" as never).insert({
        convoyeur_id: convoyeur?.id,
        module_id: selected.id,
        score,
        passed: false,
        answers,
      } as never);
      toast.error(`Score ${score} % — minimum ${selected.minimum_score} %. Recommencez le quiz.`);
      setAnswers({});
      return;
    }
    await markModule(selected, score);
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-pro-accent" size={28} /></div>;
  }

  if (!convoyeur) {
    return (
      <div className="rounded-xl border border-pro-border bg-white p-8 text-center">
        <GraduationCap className="mx-auto mb-3 text-pro-muted" size={36} />
        <p className="text-pro-text-soft text-sm">Profil convoyeur introuvable.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-pro-border bg-white p-5 shadow-pro-card">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-pro-muted font-semibold">Formation obligatoire</p>
            <h1 className="text-2xl font-semibold text-pro-text mt-1 flex items-center gap-2">
              <GraduationCap size={24} className="text-pro-accent" /> Certification convoyeur Ligneo
            </h1>
            <p className="text-pro-text-soft text-sm mt-1">Validation requise avant toute candidature ou acceptation de mission.</p>
          </div>
          {convoyeur.has_completed_training ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
              <Award size={14} /> Certifié
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">
              <Lock size={14} /> Missions bloquées
            </span>
          )}
        </div>
        <div className="mt-5">
          <div className="flex items-center justify-between text-xs text-pro-muted mb-2">
            <span>{completedCount}/{modules.length} module{modules.length > 1 ? "s" : ""} validé{completedCount > 1 ? "s" : ""}</span>
            <span>{percent} %</span>
          </div>
          <div className="h-2 rounded-full bg-pro-bg-soft overflow-hidden">
            <div className="h-full bg-pro-brand-strip transition-all" style={{ width: `${percent}%` }} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="space-y-2">
          {modules.map((m, index) => {
            const p = progressMap.get(m.id);
            const done = p?.status === "completed";
            const active = selectedId === m.id;
            return (
              <button
                key={m.id}
                onClick={() => { setSelectedId(m.id); setAnswers({}); }}
                className={`w-full rounded-xl border p-4 text-left transition-colors ${active ? "border-pro-accent bg-white shadow-pro-card" : "border-pro-border bg-white hover:bg-pro-bg-soft"}`}
              >
                <div className="flex items-center gap-3">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-semibold ${done ? "bg-emerald-50 text-emerald-700" : active ? "bg-pro-accent text-white" : "bg-pro-bg-soft text-pro-muted"}`}>
                    {done ? <CheckCircle2 size={16} /> : index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-pro-text truncate">{m.title}</p>
                    <p className="text-[11px] text-pro-muted">{m.estimated_minutes} min · score min. {m.minimum_score}%</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="rounded-2xl border border-pro-border bg-white p-5 shadow-pro-card min-h-[420px]">
          {!selected ? (
            <div className="flex h-full items-center justify-center text-pro-muted text-sm">Aucun module disponible.</div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-pro-muted font-semibold flex items-center gap-1.5">
                    {selected.content_type === "video" ? <PlayCircle size={13} /> : selected.content_type === "quiz" ? <HelpCircle size={13} /> : <FileText size={13} />}
                    Module
                  </p>
                  <h2 className="text-xl font-semibold text-pro-text mt-1">{selected.title}</h2>
                  {selected.description && <p className="text-sm text-pro-text-soft mt-1">{selected.description}</p>}
                </div>
                {selectedProgress?.status === "completed" && (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Validé</span>
                )}
              </div>

              {selected.content_url && (
                <a href={selected.content_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-pro-border px-3 py-2 text-sm text-pro-accent hover:bg-pro-bg-soft">
                  Ouvrir le support <ArrowRight size={14} />
                </a>
              )}

              {selected.content_body && (
                <div className="rounded-xl border border-pro-border bg-pro-bg-soft p-4 text-sm leading-relaxed text-pro-text-soft whitespace-pre-line">
                  {selected.content_body}
                </div>
              )}

              {selected.content_type === "quiz" ? (
                <div className="space-y-4">
                  {selected.quiz_questions.map((q, questionIndex) => (
                    <div key={questionIndex} className="rounded-xl border border-pro-border p-4">
                      <p className="text-sm font-semibold text-pro-text">{questionIndex + 1}. {q.question}</p>
                      <div className="mt-3 space-y-2">
                        {q.choices.map((choice, choiceIndex) => (
                          <button
                            key={choiceIndex}
                            type="button"
                            onClick={() => setAnswers((prev) => ({ ...prev, [questionIndex]: choiceIndex }))}
                            className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${answers[questionIndex] === choiceIndex ? "border-pro-accent bg-pro-accent/10 text-pro-text" : "border-pro-border bg-white text-pro-text-soft hover:bg-pro-bg-soft"}`}
                          >
                            {choice}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  <button onClick={submitQuiz} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-pro-accent px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
                    {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Valider le quiz
                  </button>
                </div>
              ) : (
                <button onClick={() => markModule(selected, 100)} disabled={saving || selectedProgress?.status === "completed"} className="inline-flex items-center gap-2 rounded-lg bg-pro-accent px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Marquer comme terminé
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {convoyeur.has_completed_training && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-emerald-800 font-medium">Formation validée : vous pouvez maintenant candidater aux missions du catalogue.</p>
          <Link to="/convoyeur/catalogue" className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
            Voir le catalogue <ArrowRight size={14} />
          </Link>
        </div>
      )}
    </div>
  );
}