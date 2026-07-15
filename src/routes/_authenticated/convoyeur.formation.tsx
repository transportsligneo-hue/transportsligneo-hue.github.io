/**
 * Académie Ligneo — parcours e-learning convoyeur.
 * 10 modules pédagogiques, quiz de fin de module, examen final 50 questions, certificat.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2, GraduationCap, Lock, Award, Trophy, ArrowRight, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ProgressBar } from "@/components/formation/ProgressBar";
import { ModuleCard, type ModuleStatus } from "@/components/formation/ModuleCard";
import { ModuleViewer } from "@/components/formation/ModuleViewer";
import { ExamViewer } from "@/components/formation/ExamViewer";
import { CertificateViewer } from "@/components/formation/CertificateViewer";

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
  id: string;
  slug: string;
  title: string;
  description: string | null;
  content_type: "text" | "video" | "quiz";
  content_url: string | null;
  content_body: string | null;
  quiz_questions: QuizQ[];
  sections: Section[];
  category: string;
  is_required: boolean;
  minimum_score: number;
  estimated_minutes: number;
  sort_order: number;
};

type Progress = {
  id: string;
  module_id: string;
  status: "not_started" | "in_progress" | "completed";
  score: number | null;
  completed_at: string | null;
};

type Convoyeur = {
  id: string;
  nom: string | null;
  prenom: string | null;
  has_completed_training: boolean;
  training_status: string;
  training_completed_at: string | null;
};

type Exam = {
  id: string;
  title: string;
  description: string | null;
  question_pool: QuizQ[];
  question_count: number;
  time_limit_minutes: number;
  minimum_score: number;
};

type ExamAttempt = { id: string; score: number; passed: boolean; finished_at: string };

type Certificate = {
  id: string;
  certificate_number: string;
  full_name: string;
  issued_at: string;
  verification_token: string;
};

function ConvoyeurFormation() {
  const { user } = useAuth();
  const [convoyeur, setConvoyeur] = useState<Convoyeur | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [exam, setExam] = useState<Exam | null>(null);
  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [view, setView] = useState<
    | "overview"
    | { kind: "module"; id: string }
    | { kind: "exam" }
    | { kind: "certificate" }
  >("overview");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data: conv } = await supabase
      .from("convoyeurs")
      .select("id, nom, prenom, has_completed_training, training_status, training_completed_at")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!conv) {
      setLoading(false);
      return;
    }
    setConvoyeur(conv as Convoyeur);

    const [mods, prog, exams, atts, certs] = await Promise.all([
      supabase.rpc("get_formation_modules_for_driver" as never),
      supabase
        .from("formation_progress" as never)
        .select("id, module_id, status, score, completed_at" as never)
        .eq("convoyeur_id" as never, conv.id as never),
      supabase.rpc("get_formation_exam_for_driver" as never),
      supabase
        .from("formation_exam_attempts" as never)
        .select("id, score, passed, finished_at" as never)
        .eq("convoyeur_id" as never, conv.id as never)
        .order("finished_at" as never, { ascending: false }),
      supabase
        .from("formation_certificates" as never)
        .select("id, certificate_number, full_name, issued_at, verification_token" as never)
        .eq("convoyeur_id" as never, conv.id as never)
        .is("revoked_at" as never, null as never)
        .limit(1),
    ]);

    const modsArr = Array.isArray(mods.data) ? (mods.data as unknown as Module[]) : [];
    setModules(
      modsArr.map((m) => ({
        ...m,
        quiz_questions: Array.isArray(m.quiz_questions) ? m.quiz_questions : [],
        sections: Array.isArray(m.sections) ? m.sections : [],
      }))
    );
    setProgress((prog.data ?? []) as unknown as Progress[]);
    setExam((exams.data ?? null) as unknown as Exam | null);
    setAttempts((atts.data ?? []) as unknown as ExamAttempt[]);
    setCertificate((((certs.data ?? [])[0]) ?? null) as unknown as Certificate | null);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [user?.id]); // eslint-disable-line

  const progressMap = useMemo(() => new Map(progress.map((p) => [p.module_id, p])), [progress]);
  const requiredModules = modules.filter((m) => m.is_required);
  const completedRequired = requiredModules.filter(
    (m) => progressMap.get(m.id)?.status === "completed"
  ).length;
  const allModulesDone = requiredModules.length > 0 && completedRequired >= requiredModules.length;
  const examPassed = attempts.some((a) => a.passed);
  const totalSteps = requiredModules.length + (exam ? 1 : 0);
  const doneSteps = completedRequired + (examPassed ? 1 : 0);
  const percent = totalSteps ? Math.round((doneSteps / totalSteps) * 100) : 0;

  const getModuleStatus = (m: Module, index: number): ModuleStatus => {
    const p = progressMap.get(m.id);
    if (p?.status === "completed") return "completed";
    if (p?.status === "in_progress") return "in_progress";
    // Le premier module ou le précédent est complété => disponible
    if (index === 0) return "available";
    const prev = requiredModules[index - 1];
    if (prev && progressMap.get(prev.id)?.status === "completed") return "available";
    return "locked";
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-pro-accent" size={28} />
      </div>
    );
  }

  if (!convoyeur) {
    return (
      <div className="rounded-xl border border-pro-border bg-white p-8 text-center">
        <GraduationCap className="mx-auto mb-3 text-pro-muted" size={36} />
        <p className="text-pro-text-soft text-sm">Profil convoyeur introuvable.</p>
      </div>
    );
  }

  if (view !== "overview" && typeof view === "object") {
    if (view.kind === "module") {
      const mod = modules.find((m) => m.id === view.id);
      if (mod) {
        return (
          <ModuleViewer
            module={mod}
            isCompleted={progressMap.get(mod.id)?.status === "completed"}
            convoyeurId={convoyeur.id}
            onBack={() => setView("overview")}
            onDone={() => {
              void load();
              setView("overview");
            }}
          />
        );
      }
    }
    if (view.kind === "exam" && exam) {
      return (
        <ExamViewer
          exam={exam}
          onDone={() => {
            void load();
            setView("overview");
          }}
        />
      );
    }
    if (view.kind === "certificate" && certificate) {
      return <CertificateViewer cert={certificate} onBack={() => setView("overview")} />;
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-pro-border bg-white p-6 shadow-pro-card">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-pro-muted font-semibold">
              Académie de formation
            </p>
            <h1 className="text-2xl font-semibold text-pro-text mt-1 flex items-center gap-2">
              <GraduationCap size={24} className="text-pro-gold" /> Certification convoyeur Ligneo
            </h1>
            <p className="text-pro-text-soft text-sm mt-1">
              10 modules · examen final 50 questions · validation requise avant les missions.
            </p>
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
        <div className="mt-6">
          <ProgressBar
            label={`${doneSteps}/${totalSteps} étape${totalSteps > 1 ? "s" : ""} validée${totalSteps > 1 ? "s" : ""}`}
            percent={percent}
          />
        </div>
      </div>

      {/* Modules grid */}
      <div className="rounded-2xl border border-pro-border bg-white p-6 shadow-pro-card">
        <h2 className="text-lg font-semibold text-pro-text mb-4 flex items-center gap-2">
          <GraduationCap size={20} className="text-pro-accent" /> Modules de formation
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {requiredModules.map((m, i) => {
            const status = getModuleStatus(m, i);
            return (
              <ModuleCard
                key={m.id}
                index={i + 1}
                title={m.title}
                description={m.description}
                minutes={m.estimated_minutes}
                status={status}
                onClick={() => setView({ kind: "module", id: m.id })}
              />
            );
          })}
        </div>
      </div>

      {/* Exam block */}
      {exam && (
        <div
          className={`rounded-2xl border p-6 shadow-pro-card ${
            allModulesDone ? "border-pro-gold bg-white" : "border-pro-border bg-pro-bg-soft/40"
          }`}
        >
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-pro-muted font-semibold flex items-center gap-1.5">
                <Trophy size={13} className="text-pro-gold" /> Examen final
              </p>
              <h2 className="text-lg font-semibold text-pro-text mt-1">{exam.title}</h2>
              <p className="text-pro-text-soft text-sm mt-1">
                {exam.question_count} questions · {exam.time_limit_minutes} min · score min{" "}
                {exam.minimum_score}%
              </p>
              {attempts.length > 0 && (
                <p className="text-xs text-pro-muted mt-2">
                  Dernière tentative : {attempts[0].score}% —{" "}
                  {attempts[0].passed ? "✅ réussi" : "❌ échoué"}
                </p>
              )}
            </div>
            <button
              disabled={!allModulesDone}
              onClick={() => setView({ kind: "exam" })}
              className="inline-flex items-center gap-2 rounded-lg bg-pro-accent px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {examPassed ? (
                <>
                  <Trophy size={15} /> Repasser
                </>
              ) : (
                <>
                  {allModulesDone ? "Démarrer" : "Verrouillé"} <ArrowRight size={15} />
                </>
              )}
            </button>
          </div>
          {!allModulesDone && (
            <p className="mt-4 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
              Terminez tous les modules obligatoires pour débloquer l'examen final.
            </p>
          )}
        </div>
      )}

      {/* Certificate block */}
      {certificate && (
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-pro-card">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-emerald-700 font-semibold flex items-center gap-1.5">
                <ShieldCheck size={13} /> Certificat délivré
              </p>
              <h2 className="text-lg font-semibold text-pro-text mt-1">Convoyeur certifié Transports Ligneo</h2>
              <p className="text-pro-text-soft text-sm mt-1">
                N° {certificate.certificate_number} · délivré le{" "}
                {new Date(certificate.issued_at).toLocaleDateString("fr-FR")}
              </p>
            </div>
            <button
              onClick={() => setView({ kind: "certificate" })}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Voir le certificat <ArrowRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Certified CTA */}
      {convoyeur.has_completed_training && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-emerald-800 font-medium">
            Formation validée : accès aux missions activé.
          </p>
          <Link
            to="/convoyeur/catalogue"
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Voir le catalogue <ArrowRight size={14} />
          </Link>
        </div>
      )}
    </div>
  );
}
