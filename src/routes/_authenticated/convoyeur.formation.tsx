/**
 * Formation obligatoire convoyeur — parcours e-learning complet.
 * Modules riches (sections), QCM, examen final chronométré, certificat.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import QRCode from "qrcode";
import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  ArrowRight, Award, CheckCircle2, FileText, GraduationCap, HelpCircle,
  Loader2, Lock, PlayCircle, Clock, Download, ShieldCheck, RotateCcw, Trophy,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/convoyeur/formation")({
  component: ConvoyeurFormation,
});

type QuizQ = { question: string; choices: string[]; answer?: number; explanation?: string };
type Section =
  | { type: "text"; content: string }
  | { type: "image"; url: string; alt?: string; caption?: string }
  | { type: "video"; url: string }
  | { type: "checklist"; items: string[] }
  | { type: "callout"; tone?: "info" | "warning" | "success"; content: string };

type Module = {
  id: string; slug: string; title: string; description: string | null;
  content_type: "text" | "video" | "quiz"; content_url: string | null; content_body: string | null;
  quiz_questions: QuizQ[]; sections: Section[]; category: string; is_required: boolean;
  minimum_score: number; estimated_minutes: number; sort_order: number;
};
type Progress = { id: string; module_id: string; status: "not_started" | "in_progress" | "completed"; score: number | null; completed_at: string | null };
type Convoyeur = { id: string; nom: string | null; prenom: string | null; has_completed_training: boolean; training_status: string; training_completed_at: string | null };
type Exam = { id: string; title: string; description: string | null; question_pool: QuizQ[]; question_count: number; time_limit_minutes: number; minimum_score: number };
type ExamAttempt = { id: string; score: number; passed: boolean; finished_at: string };
type Certificate = { id: string; certificate_number: string; full_name: string; issued_at: string; verification_token: string };

function shuffle<T>(arr: T[]): T[] { return [...arr].sort(() => Math.random() - 0.5); }

function ConvoyeurFormation() {
  const { user } = useAuth();
  const [convoyeur, setConvoyeur] = useState<Convoyeur | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [exam, setExam] = useState<Exam | null>(null);
  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [view, setView] = useState<"overview" | { kind: "module"; id: string } | { kind: "exam" } | { kind: "certificate" }>("overview");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data: conv } = await supabase.from("convoyeurs").select("id, nom, prenom, has_completed_training, training_status, training_completed_at").eq("user_id", user.id).maybeSingle();
    if (!conv) { setLoading(false); return; }
    setConvoyeur(conv as Convoyeur);

    const [mods, prog, exams, atts, certs] = await Promise.all([
      supabase.rpc("get_formation_modules_for_driver" as never),
      supabase.from("formation_progress" as never).select("id, module_id, status, score, completed_at" as never).eq("convoyeur_id" as never, conv.id as never),
      supabase.rpc("get_formation_exam_for_driver" as never),
      supabase.from("formation_exam_attempts" as never).select("id, score, passed, finished_at" as never).eq("convoyeur_id" as never, conv.id as never).order("finished_at" as never, { ascending: false }),
      supabase.from("formation_certificates" as never).select("id, certificate_number, full_name, issued_at, verification_token" as never).eq("convoyeur_id" as never, conv.id as never).is("revoked_at" as never, null as never).limit(1),
    ]);

    const modsArr = Array.isArray(mods.data) ? (mods.data as unknown as Module[]) : [];
    setModules(modsArr.map(m => ({
      ...m,
      quiz_questions: Array.isArray(m.quiz_questions) ? m.quiz_questions : [],
      sections: Array.isArray(m.sections) ? m.sections : [],
    })));
    setProgress((prog.data ?? []) as unknown as Progress[]);
    setExam((exams.data ?? null) as unknown as Exam | null);
    setAttempts((atts.data ?? []) as unknown as ExamAttempt[]);
    setCertificate((((certs.data ?? [])[0]) ?? null) as unknown as Certificate | null);
    setLoading(false);
  };

  useEffect(() => { void load(); }, [user?.id]); // eslint-disable-line

  const progressMap = useMemo(() => new Map(progress.map(p => [p.module_id, p])), [progress]);
  const requiredModules = modules.filter(m => m.is_required);
  const completedRequired = requiredModules.filter(m => progressMap.get(m.id)?.status === "completed").length;
  const allModulesDone = requiredModules.length > 0 && completedRequired >= requiredModules.length;
  const examPassed = attempts.some(a => a.passed);
  const totalSteps = requiredModules.length + (exam ? 1 : 0);
  const doneSteps = completedRequired + (examPassed ? 1 : 0);
  const percent = totalSteps ? Math.round((doneSteps / totalSteps) * 100) : 0;

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-pro-accent" size={28} /></div>;
  if (!convoyeur) return <div className="rounded-xl border border-pro-border bg-white p-8 text-center"><GraduationCap className="mx-auto mb-3 text-pro-muted" size={36} /><p className="text-pro-text-soft text-sm">Profil convoyeur introuvable.</p></div>;

  if (view !== "overview" && typeof view === "object") {
    if (view.kind === "module") {
      const mod = modules.find(m => m.id === view.id);
      if (mod) return <ModuleView module={mod} progress={progressMap.get(mod.id) ?? null} convoyeurId={convoyeur.id} onBack={() => setView("overview")} onDone={() => { void load(); setView("overview"); }} />;
    }
    if (view.kind === "exam" && exam) return <ExamView exam={exam} convoyeurId={convoyeur.id} onBack={() => setView("overview")} onDone={() => { void load(); setView("overview"); }} />;
    if (view.kind === "certificate" && certificate) return <CertificateView cert={certificate} onBack={() => setView("overview")} />;
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-pro-border bg-white p-5 shadow-pro-card">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-pro-muted font-semibold">Formation obligatoire</p>
            <h1 className="text-2xl font-semibold text-pro-text mt-1 flex items-center gap-2"><GraduationCap size={24} className="text-pro-accent" /> Certification convoyeur Ligneo</h1>
            <p className="text-pro-text-soft text-sm mt-1">Validation requise avant toute candidature ou acceptation de mission.</p>
          </div>
          {convoyeur.has_completed_training ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700"><Award size={14} /> Certifié</span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800"><Lock size={14} /> Missions bloquées</span>
          )}
        </div>
        <div className="mt-5">
          <div className="flex items-center justify-between text-xs text-pro-muted mb-2">
            <span>{doneSteps}/{totalSteps} étape{totalSteps > 1 ? "s" : ""}</span>
            <span>{percent} %</span>
          </div>
          <div className="h-2 rounded-full bg-pro-bg-soft overflow-hidden">
            <div className="h-full bg-pro-brand-strip transition-all" style={{ width: `${percent}%` }} />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-pro-border bg-white p-5 shadow-pro-card">
        <h2 className="text-lg font-semibold text-pro-text mb-3">Modules de formation</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {modules.map((m, i) => {
            const p = progressMap.get(m.id);
            const done = p?.status === "completed";
            const inProgress = p?.status === "in_progress";
            return (
              <button key={m.id} onClick={() => setView({ kind: "module", id: m.id })} className={`rounded-xl border p-4 text-left transition-colors ${done ? "border-emerald-200 bg-emerald-50/40" : inProgress ? "border-pro-accent bg-pro-accent/5" : "border-pro-border bg-white hover:bg-pro-bg-soft"}`}>
                <div className="flex items-center gap-3">
                  <span className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-semibold ${done ? "bg-emerald-100 text-emerald-700" : inProgress ? "bg-pro-accent text-white" : "bg-pro-bg-soft text-pro-muted"}`}>
                    {done ? <CheckCircle2 size={16} /> : i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-pro-text">{m.title}</p>
                    <p className="text-[11px] text-pro-muted flex items-center gap-2 mt-0.5"><Clock size={11} /> {m.estimated_minutes} min · score min {m.minimum_score}%</p>
                    {m.description && <p className="text-xs text-pro-text-soft mt-1 line-clamp-2">{m.description}</p>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {exam && (
        <div className={`rounded-2xl border p-5 shadow-pro-card ${allModulesDone ? "border-pro-accent bg-white" : "border-pro-border bg-pro-bg-soft/40"}`}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-pro-muted font-semibold flex items-center gap-1.5"><Trophy size={13} /> Examen final</p>
              <h2 className="text-lg font-semibold text-pro-text mt-1">{exam.title}</h2>
              <p className="text-pro-text-soft text-sm mt-1">{exam.question_count} questions · {exam.time_limit_minutes} min · score min {exam.minimum_score}%</p>
              {attempts.length > 0 && (
                <p className="text-xs text-pro-muted mt-2">Dernière tentative : {attempts[0].score}% — {attempts[0].passed ? "✅ réussi" : "❌ échoué"}</p>
              )}
            </div>
            <button disabled={!allModulesDone} onClick={() => setView({ kind: "exam" })} className="inline-flex items-center gap-2 rounded-lg bg-pro-accent px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed">
              {examPassed ? <><RotateCcw size={15} /> Repasser</> : <>{allModulesDone ? "Démarrer" : "Verrouillé"} <ArrowRight size={15} /></>}
            </button>
          </div>
          {!allModulesDone && <p className="mt-3 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">Terminez tous les modules obligatoires pour débloquer l'examen final.</p>}
        </div>
      )}

      {certificate && (
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-pro-card">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-emerald-700 font-semibold flex items-center gap-1.5"><ShieldCheck size={13} /> Certificat délivré</p>
              <h2 className="text-lg font-semibold text-pro-text mt-1">Convoyeur certifié Transports Ligneo</h2>
              <p className="text-pro-text-soft text-sm mt-1">N° {certificate.certificate_number} · délivré le {new Date(certificate.issued_at).toLocaleDateString("fr-FR")}</p>
            </div>
            <button onClick={() => setView({ kind: "certificate" })} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
              Voir le certificat <ArrowRight size={15} />
            </button>
          </div>
        </div>
      )}

      {convoyeur.has_completed_training && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-emerald-800 font-medium">Formation validée : accès aux missions activé.</p>
          <Link to="/convoyeur/catalogue" className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Voir le catalogue <ArrowRight size={14} /></Link>
        </div>
      )}
    </div>
  );
}

/* ============ MODULE VIEW ============ */

function SectionBlock({ s }: { s: Section }) {
  if (s.type === "text") return <p className="text-sm leading-relaxed text-pro-text-soft whitespace-pre-line">{s.content}</p>;
  if (s.type === "image") return <figure><img src={s.url} alt={s.alt ?? ""} className="rounded-xl border border-pro-border w-full" loading="lazy" />{s.caption && <figcaption className="text-xs text-pro-muted mt-1">{s.caption}</figcaption>}</figure>;
  if (s.type === "video") {
    const yt = s.url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?]+)/);
    if (yt) return <div className="aspect-video rounded-xl overflow-hidden border border-pro-border"><iframe src={`https://www.youtube.com/embed/${yt[1]}`} className="w-full h-full" allowFullScreen /></div>;
    return <video src={s.url} controls className="w-full rounded-xl border border-pro-border" />;
  }
  if (s.type === "checklist") return <ul className="space-y-2">{s.items.map((it, i) => <li key={i} className="flex items-start gap-2 text-sm text-pro-text-soft"><CheckCircle2 size={16} className="text-emerald-600 mt-0.5 flex-shrink-0" /><span>{it}</span></li>)}</ul>;
  if (s.type === "callout") {
    const tone = s.tone ?? "info";
    const cls = tone === "warning" ? "border-amber-200 bg-amber-50 text-amber-900" : tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-blue-200 bg-blue-50 text-blue-900";
    return <div className={`rounded-xl border p-3 text-sm ${cls}`}>{s.content}</div>;
  }
  return null;
}

function ModuleView({ module: mod, progress: prog, convoyeurId, onBack, onDone }: { module: Module; progress: Progress | null; convoyeurId: string; onBack: () => void; onDone: () => void }) {
  const [phase, setPhase] = useState<"content" | "quiz" | "result">(prog?.status === "completed" ? "content" : "content");
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ score: number; passed: boolean; review: QuizQ[] } | null>(null);
  const questions = mod.quiz_questions ?? [];

  useEffect(() => {
    if (prog?.status !== "completed") {
      void supabase.from("formation_progress" as never).upsert({ convoyeur_id: convoyeurId, module_id: mod.id, status: "in_progress", last_seen_at: new Date().toISOString() } as never, { onConflict: "convoyeur_id,module_id" } as never);
    }
  }, [convoyeurId, mod.id, prog?.status]);

  const submitQuiz = async () => {
    if (questions.some((_, i) => answers[i] == null)) { toast.error("Répondez à toutes les questions."); return; }
    setSaving(true);
    const { data, error } = await supabase.rpc("submit_module_quiz" as never, { _module_id: mod.id, _answers: answers } as never);
    setSaving(false);
    if (error || !data) { toast.error("Erreur lors de la soumission du QCM."); return; }
    const r = data as unknown as { score: number; passed: boolean; review: QuizQ[] };
    setResult({ score: r.score, passed: r.passed, review: Array.isArray(r.review) ? r.review : [] });
    setPhase("result");
  };

  const markTextDone = async () => {
    setSaving(true);
    await supabase.from("formation_progress" as never).upsert({ convoyeur_id: convoyeurId, module_id: mod.id, status: "completed", score: 100, completed_at: new Date().toISOString(), last_seen_at: new Date().toISOString() } as never, { onConflict: "convoyeur_id,module_id" } as never);
    setSaving(false);
    toast.success("Module validé");
    onDone();
  };

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="text-sm text-pro-accent hover:underline">← Retour à la formation</button>
      <div className="rounded-2xl border border-pro-border bg-white p-6 shadow-pro-card">
        <p className="text-[11px] uppercase tracking-wider text-pro-muted font-semibold flex items-center gap-1.5">
          {mod.content_type === "video" ? <PlayCircle size={13} /> : mod.content_type === "quiz" ? <HelpCircle size={13} /> : <FileText size={13} />} Module · {mod.category}
        </p>
        <h1 className="text-2xl font-semibold text-pro-text mt-1">{mod.title}</h1>
        {mod.description && <p className="text-sm text-pro-text-soft mt-1">{mod.description}</p>}

        {phase === "content" && (
          <div className="mt-6 space-y-5">
            {mod.sections.map((s, i) => <SectionBlock key={i} s={s} />)}
            {mod.content_body && <div className="rounded-xl border border-pro-border bg-pro-bg-soft p-4 text-sm leading-relaxed text-pro-text-soft whitespace-pre-line">{mod.content_body}</div>}
            {mod.content_url && <a href={mod.content_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-pro-border px-3 py-2 text-sm text-pro-accent hover:bg-pro-bg-soft">Support externe <ArrowRight size={14} /></a>}
            <div className="pt-4 border-t border-pro-border flex flex-wrap gap-2">
              {questions.length > 0 ? (
                <button onClick={() => setPhase("quiz")} className="inline-flex items-center gap-2 rounded-lg bg-pro-accent px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"><HelpCircle size={15} /> Passer au QCM</button>
              ) : (
                <button onClick={markTextDone} disabled={saving || prog?.status === "completed"} className="inline-flex items-center gap-2 rounded-lg bg-pro-accent px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">{saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} {prog?.status === "completed" ? "Déjà validé" : "Marquer comme lu"}</button>
              )}
            </div>
          </div>
        )}

        {phase === "quiz" && (
          <div className="mt-6 space-y-4">
            {questions.map((q, qi) => (
              <div key={qi} className="rounded-xl border border-pro-border p-4">
                <p className="text-sm font-semibold text-pro-text">{qi + 1}. {q.question}</p>
                <div className="mt-3 space-y-2">
                  {q.choices.map((c, ci) => (
                    <button key={ci} type="button" onClick={() => setAnswers(a => ({ ...a, [qi]: ci }))} className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${answers[qi] === ci ? "border-pro-accent bg-pro-accent/10 text-pro-text" : "border-pro-border bg-white text-pro-text-soft hover:bg-pro-bg-soft"}`}>{c}</button>
                  ))}
                </div>
              </div>
            ))}
            <button onClick={submitQuiz} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-pro-accent px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">{saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Valider le QCM</button>
          </div>
        )}

        {phase === "result" && result && (
          <div className="mt-6 space-y-4">
            <div className={`rounded-xl p-5 border ${result.passed ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
              <p className={`text-2xl font-bold ${result.passed ? "text-emerald-700" : "text-red-700"}`}>{result.score}%</p>
              <p className={`text-sm ${result.passed ? "text-emerald-800" : "text-red-800"} mt-1`}>{result.passed ? "Module validé !" : `Score insuffisant — minimum ${mod.minimum_score}%. Revoyez le contenu et recommencez.`}</p>
            </div>
            {!result.passed && result.review.length > 0 && (
              <div className="space-y-3">
                {result.review.map((q, qi) => q.answer != null && answers[qi] !== q.answer && (
                  <div key={qi} className="rounded-lg border border-red-200 bg-white p-3 text-sm">
                    <p className="font-semibold text-pro-text">{q.question}</p>
                    <p className="text-red-700 mt-1">Votre réponse : {answers[qi] != null ? q.choices[answers[qi]] : "— (non répondue)"}</p>
                    <p className="text-emerald-700 mt-0.5">Bonne réponse : {q.choices[q.answer]}</p>
                    {q.explanation && <p className="text-pro-text-soft mt-1 text-xs">{q.explanation}</p>}
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2 flex-wrap">
              {result.passed ? (
                <button onClick={onDone} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">Continuer <ArrowRight size={15} /></button>
              ) : (
                <button onClick={() => { setAnswers({}); setResult(null); setPhase("quiz"); }} className="inline-flex items-center gap-2 rounded-lg bg-pro-accent px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"><RotateCcw size={15} /> Recommencer</button>
              )}
              <button onClick={() => { setPhase("content"); setResult(null); setAnswers({}); }} className="inline-flex items-center gap-2 rounded-lg border border-pro-border px-4 py-2.5 text-sm text-pro-text hover:bg-pro-bg-soft">Revoir le contenu</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============ EXAM VIEW ============ */

function ExamView({ exam, convoyeurId, onBack, onDone }: { exam: Exam; convoyeurId: string; onBack: () => void; onDone: () => void }) {
  const [selection] = useState(() => {
    const idxs = Array.from({ length: exam.question_pool.length }, (_, i) => i);
    return shuffle(idxs).slice(0, exam.question_count);
  });
  const questions = useMemo(() => selection.map(i => exam.question_pool[i]), [selection, exam.question_pool]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const startedAt = useRef(Date.now());
  const [remaining, setRemaining] = useState(exam.time_limit_minutes * 60);
  const [phase, setPhase] = useState<"exam" | "result">("exam");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ score: number; passed: boolean; questions: QuizQ[] } | null>(null);
  // Silence unused warning; convoyeurId is authoritative server-side via auth.uid()
  void convoyeurId;

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
    if (error || !data) { toast.error("Erreur lors de la soumission de l'examen."); return; }
    const r = data as unknown as { score: number; passed: boolean; questions: QuizQ[] };
    setResult({ score: r.score, passed: r.passed, questions: Array.isArray(r.questions) ? r.questions : [] });
    setPhase("result");
    if (r.passed) toast.success("Examen réussi — certificat en cours de délivrance");
  };

  useEffect(() => {
    if (phase !== "exam") return;
    const t = setInterval(() => setRemaining(r => {
      if (r <= 1) { clearInterval(t); void submit(true); return 0; }
      return r - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [phase]); // eslint-disable-line

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  if (phase === "result" && result) {
    const points = result.score * 2 * questions.length / 100; // total points (2 per Q on the shown set)
    const totalPoints = questions.length * 2;
    // Certification tier — based on the raw percent score
    const tier = result.score >= 90
      ? { label: "Convoyeur confirmé", tone: "gold" as const, msg: "Excellence : maîtrise complète des procédures Ligneo. Votre certificat est délivré." }
      : result.score >= 80
      ? { label: "Certification validée", tone: "success" as const, msg: "Certification obtenue. Votre certificat officiel est délivré, les missions sont débloquées." }
      : result.score >= 70
      ? { label: "Nouvelle tentative obligatoire après révision", tone: "warning" as const, msg: "Vous êtes proche du seuil. Révisez les modules ciblés puis repassez l'examen." }
      : { label: "Formation complémentaire obligatoire", tone: "danger" as const, msg: "Score insuffisant. Reprenez l'ensemble des modules avant une nouvelle tentative." };

    const toneCard =
      tier.tone === "gold" ? "border-amber-300 bg-gradient-to-br from-amber-50 to-white"
      : tier.tone === "success" ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white"
      : tier.tone === "warning" ? "border-orange-200 bg-orange-50"
      : "border-red-200 bg-red-50";
    const toneText =
      tier.tone === "gold" ? "text-amber-800"
      : tier.tone === "success" ? "text-emerald-700"
      : tier.tone === "warning" ? "text-orange-700"
      : "text-red-700";

    return (
      <div className="space-y-5">
        <div className={`rounded-2xl p-6 border shadow-pro-card ${toneCard}`}>
          <p className={`text-[11px] uppercase tracking-wider font-semibold ${toneText}`}>Bilan de certification</p>
          <div className="mt-2 flex items-baseline gap-3 flex-wrap">
            <p className={`text-5xl font-bold ${toneText}`}>{points}<span className="text-2xl opacity-70">/{totalPoints}</span></p>
            <p className={`text-lg font-semibold ${toneText}`}>({result.score} %)</p>
          </div>
          <p className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
            tier.tone === "gold" ? "bg-amber-100 text-amber-800 border border-amber-300"
            : tier.tone === "success" ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
            : tier.tone === "warning" ? "bg-orange-100 text-orange-800 border border-orange-200"
            : "bg-red-100 text-red-800 border border-red-200"
          }`}>
            {result.passed ? <Award size={13} /> : <RotateCcw size={13} />} {tier.label}
          </p>
          <p className={`text-sm mt-3 ${toneText}`}>{tier.msg}</p>
          <p className="text-xs text-pro-muted mt-2">Seuil de réussite : {exam.minimum_score}% · Barème : 2 points par question</p>
        </div>

        {!result.passed && result.questions.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-pro-text">Questions à revoir ({result.questions.filter((q, i) => q.answer != null && answers[i] !== q.answer).length}) :</p>
            {result.questions.map((q, qi) => q.answer != null && answers[qi] !== q.answer && (
              <div key={qi} className="rounded-lg border border-red-200 bg-white p-4 text-sm">
                <p className="font-semibold text-pro-text">Q{qi + 1}. {q.question}</p>
                <p className="text-red-700 mt-2">Votre réponse : {answers[qi] != null ? q.choices[answers[qi]] : "— (non répondue)"}</p>
                <p className="text-emerald-700 mt-0.5">Bonne réponse : {q.choices[q.answer]}</p>
                {q.explanation && <p className="text-pro-text-soft mt-2 text-xs italic border-l-2 border-emerald-200 pl-2">{q.explanation}</p>}
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          {result.passed ? (
            <button onClick={onDone} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
              <Award size={15} /> Voir mon certificat
            </button>
          ) : (
            <button
              onClick={() => { setAnswers({}); setResult(null); setPhase("exam"); setRemaining(exam.time_limit_minutes * 60); startedAt.current = Date.now(); }}
              className="inline-flex items-center gap-2 rounded-lg bg-pro-accent px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
            >
              <RotateCcw size={15} /> Repasser l'examen
            </button>
          )}
          <button onClick={onDone} className="inline-flex items-center gap-2 rounded-lg border border-pro-border px-4 py-2.5 text-sm text-pro-text hover:bg-pro-bg-soft">
            Retour à la formation <ArrowRight size={15} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button onClick={onBack} className="text-sm text-pro-accent hover:underline">← Quitter (progression perdue)</button>
        <div className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-mono font-semibold ${remaining < 60 ? "bg-red-100 text-red-700" : "bg-pro-bg-soft text-pro-text"}`}>
          <Clock size={15} /> {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
        </div>
      </div>
      <div className="rounded-2xl border border-pro-border bg-white p-6 shadow-pro-card">
        <h1 className="text-2xl font-semibold text-pro-text flex items-center gap-2"><Trophy size={22} className="text-pro-accent" /> {exam.title}</h1>
        <p className="text-pro-text-soft text-sm mt-1">{questions.length} questions · score minimum {exam.minimum_score}%</p>
        <div className="mt-6 space-y-4">
          {questions.map((q, qi) => (
            <div key={qi} className="rounded-xl border border-pro-border p-4">
              <p className="text-sm font-semibold text-pro-text">{qi + 1}. {q.question}</p>
              <div className="mt-3 space-y-2">
                {q.choices.map((c, ci) => (
                  <button key={ci} type="button" onClick={() => setAnswers(a => ({ ...a, [qi]: ci }))} className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${answers[qi] === ci ? "border-pro-accent bg-pro-accent/10 text-pro-text" : "border-pro-border bg-white text-pro-text-soft hover:bg-pro-bg-soft"}`}>{c}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <button onClick={() => submit(false)} disabled={saving} className="mt-6 inline-flex items-center gap-2 rounded-lg bg-pro-accent px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">{saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Soumettre l'examen</button>
      </div>
    </div>
  );
}

/* ============ CERTIFICATE VIEW ============ */

function CertificateView({ cert, onBack }: { cert: Certificate; onBack: () => void }) {
  const [qr, setQr] = useState<string | null>(null);
  const verifyUrl = typeof window !== "undefined" ? `${window.location.origin}/verify-certificat/${cert.verification_token}` : "";

  useEffect(() => {
    if (!verifyUrl) return;
    QRCode.toDataURL(verifyUrl, { margin: 1, width: 200 }).then(setQr).catch(() => setQr(null));
  }, [verifyUrl]);

  const downloadPdf = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.setFillColor(11, 16, 38); doc.rect(0, 0, 297, 210, "F");
    doc.setDrawColor(212, 175, 55); doc.setLineWidth(2); doc.rect(10, 10, 277, 190);
    doc.setTextColor(212, 175, 55); doc.setFontSize(14); doc.setFont("helvetica", "bold");
    doc.text("TRANSPORTS LIGNEO", 148.5, 30, { align: "center" });
    doc.setTextColor(250, 247, 239); doc.setFontSize(36);
    doc.text("Certificat de Convoyeur", 148.5, 60, { align: "center" });
    doc.setFontSize(14); doc.setFont("helvetica", "normal");
    doc.text("Ce certificat atteste que", 148.5, 80, { align: "center" });
    doc.setFontSize(28); doc.setFont("helvetica", "bold");
    doc.text(cert.full_name, 148.5, 100, { align: "center" });
    doc.setFontSize(13); doc.setFont("helvetica", "normal");
    doc.text("a validé avec succès la formation obligatoire", 148.5, 115, { align: "center" });
    doc.text("Transports Ligneo et est certifié pour effectuer des missions de convoyage.", 148.5, 123, { align: "center" });
    doc.setFontSize(11); doc.setTextColor(212, 175, 55);
    doc.text(`N° ${cert.certificate_number}`, 148.5, 150, { align: "center" });
    doc.setTextColor(250, 247, 239);
    doc.text(`Délivré le ${new Date(cert.issued_at).toLocaleDateString("fr-FR")}`, 148.5, 158, { align: "center" });
    if (qr) { try { doc.addImage(qr, "PNG", 235, 155, 35, 35); } catch { /* ignore */ } }
    doc.setFontSize(9); doc.text(`Vérification : ${verifyUrl}`, 148.5, 200, { align: "center" });
    doc.save(`certificat-${cert.certificate_number}.pdf`);
  };

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="text-sm text-pro-accent hover:underline">← Retour</button>
      <div className="rounded-2xl overflow-hidden shadow-pro-card border border-pro-border">
        <div className="bg-gradient-to-br from-[#0b1026] to-[#111a3d] p-10 text-center relative">
          <div className="absolute inset-4 border-2 border-[#d4af37] rounded-xl pointer-events-none" />
          <p className="text-[#d4af37] text-xs uppercase tracking-[0.3em] font-semibold">Transports Ligneo</p>
          <h1 className="text-4xl font-serif text-[#faf7ef] mt-6" style={{ fontFamily: "'Playfair Display', serif" }}>Certificat de Convoyeur</h1>
          <p className="text-[#faf7ef]/80 text-sm mt-6">Ce certificat atteste que</p>
          <p className="text-3xl font-bold text-[#faf7ef] mt-3">{cert.full_name}</p>
          <p className="text-[#faf7ef]/80 text-sm mt-4 max-w-lg mx-auto">a validé avec succès la formation obligatoire Transports Ligneo et est certifié pour effectuer des missions de convoyage.</p>
          <div className="mt-8 flex items-center justify-center gap-6 flex-wrap">
            <div className="text-left">
              <p className="text-[#d4af37] text-xs uppercase tracking-wider">N° certificat</p>
              <p className="text-[#faf7ef] font-mono text-sm mt-0.5">{cert.certificate_number}</p>
              <p className="text-[#d4af37] text-xs uppercase tracking-wider mt-3">Délivré le</p>
              <p className="text-[#faf7ef] text-sm mt-0.5">{new Date(cert.issued_at).toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" })}</p>
            </div>
            {qr && <img src={qr} alt="QR de vérification" className="w-28 h-28 rounded bg-white p-1" />}
          </div>
          <p className="text-[#faf7ef]/50 text-[10px] mt-6">Vérifier ce certificat : {verifyUrl}</p>
        </div>
      </div>
      <div className="flex gap-2 flex-wrap">
        <button onClick={downloadPdf} className="inline-flex items-center gap-2 rounded-lg bg-pro-accent px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"><Download size={15} /> Télécharger le PDF</button>
        <a href={verifyUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-pro-border px-4 py-2.5 text-sm text-pro-text hover:bg-pro-bg-soft"><ShieldCheck size={15} /> Page de vérification publique</a>
      </div>
    </div>
  );
}
