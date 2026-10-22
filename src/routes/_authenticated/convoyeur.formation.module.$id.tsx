import { PageSkeleton } from "@/components/driver2/PageSkeleton";
import { PASS_SCORE } from "@/lib/formation/types";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { ArrowLeft, ArrowRight, Download, Target, Video, CheckCircle2, Check } from "lucide-react";
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

  // Rattrapage : quiz déjà réussi mais module jamais marqué « terminé »
  // (l'utilisateur avait quitté la page sans cliquer sur « Module suivant »).
  useEffect(() => {
    if (module && p && !p.completed && (p.quiz_score ?? 0) >= PASS_SCORE) void markCompleted(module.id);
  }, [module?.id, p?.completed, p?.quiz_score]);

  if (loading) {
    return (
      <PageSkeleton />
    );
  }
  if (!module) {
    return (
      <div className="fm-card" style={{ textAlign: "center" }}>
        <p className="fm-fine">Ce module est introuvable.</p>
        <Link to="/convoyeur/formation" className="fm-link" style={{ marginTop: 8 }}>
          Retour au parcours
        </Link>
      </div>
    );
  }

  return (
    <div className="fm">
      <header className="fm-card">
        <div className="fm-card-h" style={{ marginBottom: 0 }}>
          <span className="fm-eb">
            Module {module.order_index}
            {module.tag ? ` · ${module.tag}` : ""}
          </span>
          {p?.completed && (
            <span className="fm-done"><CheckCircle2 size={13} /> Terminé</span>
          )}
        </div>
        <h1 className="fm-h1">{module.title}</h1>
        <p className="fm-upd">Mis à jour le {new Date(module.last_updated).toLocaleDateString("fr-FR")}</p>
        {module.objectives.length > 0 && (
          <div className="fm-obj">
            <p className="fm-obj-t"><Target size={14} /> Ce que vous allez retenir</p>
            <ul>
              {module.objectives.map((o, i) => (
                <li key={i}><Check size={14} strokeWidth={3} />{o}</li>
              ))}
            </ul>
          </div>
        )}
      </header>

      <section className="fm-card">
        <ModuleContent content={module.content} />
        {(module.video_url || module.resource_url) && (
          <div className="fm-res">
            {module.video_url && (
              <a href={module.video_url} target="_blank" rel="noreferrer" className="fm-resb">
                <Video size={15} /> Vidéo du module
              </a>
            )}
            {module.resource_url && (
              <a href={module.resource_url} target="_blank" rel="noreferrer" className="fm-resb">
                <Download size={15} /> {module.resource_label ?? "Document à télécharger"}
              </a>
            )}
          </div>
        )}
      </section>

      {module.checklist_items.length > 0 && (
        <ChecklistBlock
          items={module.checklist_items}
          value={p?.checklist_state ?? {}}
          onChange={(next) => void saveChecklist(module.id, next)}
        />
      )}

      {(module.case_studies?.length ? module.case_studies : module.case_study?.scenario ? [module.case_study] : []).map((cs, ci, all) => (
        <CaseStudyBlock key={`${module.id}-${ci}`} moduleId={module.id} caseStudy={cs} caseIndex={ci} total={all.length} initialAnswer={null} />
      ))}

      <QuizBlock
        moduleId={module.id}
        questions={module.quiz_questions}
        bestScore={p?.quiz_score ?? null}
        attempts={p?.attempts_count ?? 0}
        onPassed={() => void markCompleted(module.id)}
      />

      <nav className="fm-nav">
        {prev ? (
          <Link to="/convoyeur/formation/module/$id" params={{ id: prev.id }} className="fm-ghost">
            <ArrowLeft size={16} /> Précédent
          </Link>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={async () => {
            if (!module.quiz_questions.length || (p?.quiz_score ?? 0) >= PASS_SCORE) await markCompleted(module.id);
            if (next) navigate({ to: "/convoyeur/formation/module/$id", params: { id: next.id } });
            else navigate({ to: "/convoyeur/formation" });
          }}
          className="fm-cta"
        >
          {next ? "Module suivant" : "Terminer le parcours"} <ArrowRight size={16} />
        </button>
      </nav>
    </div>
  );
}
