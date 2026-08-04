import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { ArrowLeft, ArrowRight, Clock3, Download, Loader2, Target, Video, CheckCircle2 } from "lucide-react";
import { useTraining } from "@/lib/formation/useTraining";
import ModuleContent from "@/components/formation/ModuleContent";
import ChecklistBlock from "@/components/formation/ChecklistBlock";
import CaseStudyBlock from "@/components/formation/CaseStudyBlock";
import QuizBlock from "@/components/formation/QuizBlock";

export const Route = createFileRoute("/_authenticated/convoyeur/formation/module/$id")({
  head: () => ({
    meta: [
      { title: "Module de formation — Transports Ligneo" },
      { name: "description", content: "Module du parcours de formation interne convoyeur Transports Ligneo." },
    ],
  }),
  component: ModulePage,
});

function ModulePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { modules, progress, loading, saveChecklist, markCompleted, touchVisit, reload } = useTraining();

  const module = useMemo(() => modules.find((m) => m.id === id), [modules, id]);
  const index = modules.findIndex((m) => m.id === id);
  const prev = index > 0 ? modules[index - 1] : undefined;
  const next = index >= 0 && index < modules.length - 1 ? modules[index + 1] : undefined;
  const p = progress[id];

  useEffect(() => {
    if (module) void touchVisit(module.id);
  }, [module?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-[#2F5FFF]" />
      </div>
    );
  }
  if (!module) {
    return (
      <div className="rounded-2xl border border-pro-border bg-white p-8 text-center">
        <p className="text-sm text-pro-muted">Module introuvable.</p>
        <Link to="/convoyeur/formation" className="mt-3 inline-block text-sm text-[#2F5FFF] font-medium">
          Retour au parcours
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="rounded-2xl border border-pro-border bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#B8862A]">
            Module {module.order_index}
            {module.tag ? ` · ${module.tag}` : ""}
          </span>
          {p?.completed && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 px-2.5 py-1 text-[11px] font-semibold">
              <CheckCircle2 size={12} /> Terminé
            </span>
          )}
        </div>
        <h1 className="mt-1.5 text-xl font-semibold text-pro-text">{module.title}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-pro-muted">
          <span className="inline-flex items-center gap-1">
            <Clock3 size={12} /> {module.duration_minutes} min
          </span>
          <span>Mise à jour {new Date(module.last_updated).toLocaleDateString("fr-FR")}</span>
        </div>
        {module.objectives.length > 0 && (
          <div className="mt-4 rounded-xl bg-[#0B1338]/[0.04] border border-pro-border p-4">
            <p className="text-xs font-semibold text-[#0B1338] flex items-center gap-1.5">
              <Target size={13} className="text-[#2F5FFF]" /> Objectifs du module
            </p>
            <ul className="mt-2 space-y-1">
              {module.objectives.map((o, i) => (
                <li key={i} className="text-sm text-pro-text-soft flex gap-2">
                  <span className="text-[#B8862A]">•</span>
                  {o}
                </li>
              ))}
            </ul>
          </div>
        )}
      </header>

      <section className="rounded-2xl border border-pro-border bg-white p-5">
        <ModuleContent content={module.content} />
        <div className="mt-4 flex flex-wrap gap-2">
          {module.video_url && (
            <a
              href={module.video_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-pro-border px-3 py-2 text-xs font-medium text-pro-text hover:border-[#2F5FFF]/40"
            >
              <Video size={14} className="text-[#2F5FFF]" /> Vidéo du module
            </a>
          )}
          {module.resource_url && (
            <a
              href={module.resource_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-pro-border px-3 py-2 text-xs font-medium text-pro-text hover:border-[#B8862A]/50"
            >
              <Download size={14} className="text-[#B8862A]" /> {module.resource_label ?? "Ressource à télécharger"}
            </a>
          )}
        </div>
      </section>

      {module.checklist_items.length > 0 && (
        <ChecklistBlock
          items={module.checklist_items}
          value={p?.checklist_state ?? {}}
          onChange={(next) => void saveChecklist(module.id, next)}
        />
      )}

      {module.case_study?.scenario && (
        <CaseStudyBlock moduleId={module.id} caseStudy={module.case_study} initialAnswer={p?.case_study_answer ?? null} />
      )}

      <QuizBlock
        moduleId={module.id}
        questions={module.quiz_questions}
        bestScore={p?.quiz_score ?? null}
        attempts={p?.attempts_count ?? 0}
        onPassed={() => void reload()}
      />

      <nav className="flex items-center justify-between gap-3 pb-6">
        {prev ? (
          <Link
            to="/convoyeur/formation/module/$id"
            params={{ id: prev.id }}
            className="inline-flex items-center gap-2 rounded-xl border border-pro-border bg-white px-4 py-2.5 text-sm font-medium text-pro-text"
          >
            <ArrowLeft size={15} /> Module précédent
          </Link>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={async () => {
            await markCompleted(module.id);
            if (next) navigate({ to: "/convoyeur/formation/module/$id", params: { id: next.id } });
            else navigate({ to: "/convoyeur/formation" });
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-[#0B1338] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#111a3d]"
        >
          {next ? "Module suivant" : "Terminer le parcours"} <ArrowRight size={15} />
        </button>
      </nav>
    </div>
  );
}
