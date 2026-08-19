import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { GraduationCap, PlayCircle, Sparkles, ArrowRight, Award, Loader2, X } from "lucide-react";
import { useTraining } from "@/lib/formation/useTraining";
import { moduleStatus, STATUS_LABEL } from "@/lib/formation/types";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { generateAttestationPdf } from "@/lib/formation/attestation-pdf";
import { TrainingStatusBadge, resolveTrainingStatut } from "@/components/convoyeur/TrainingStatusBadge";

export const Route = createFileRoute("/_authenticated/convoyeur/formation/")({
  head: () => ({
    meta: [
      { title: "Formation convoyeur — Transports Ligneo" },
      { name: "description", content: "Parcours de formation interne des convoyeurs Transports Ligneo." },
    ],
  }),
  component: FormationHome,
});

const TOUR = [
  { title: "Votre parcours", text: "8 modules à suivre dans l'ordre. Votre progression est enregistrée automatiquement." },
  { title: "Reprise automatique", text: "À chaque reconnexion, vous repartez du dernier module non terminé." },
  { title: "Quiz et validation", text: "Chaque module se valide par un quiz (100% minimum), tentatives illimitées." },
  { title: "Besoin d'aide ?", text: "La FAQ et l'équipe Ligneo sont accessibles depuis chaque page." },
];

function FormationHome() {
  const { modules, progress, percent, completedCount, loading } = useTraining();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tourStep, setTourStep] = useState<number | null>(null);
  const [identity, setIdentity] = useState<{ prenom: string; nom: string }>({ prenom: "", nom: "" });
  const firstName = identity.prenom || "convoyeur";

  useEffect(() => {
    if (!user?.id) return;
    void supabase
      .from("profiles")
      .select("prenom, nom")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setIdentity({ prenom: data.prenom ?? "", nom: data.nom ?? "" });
      });
  }, [user?.id]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem("ligneo_formation_tour")) setTourStep(0);
  }, []);

  const nextModule = useMemo(
    () => modules.find((m) => !progress[m.id]?.completed) ?? modules[0],
    [modules, progress],
  );
  const allDone = modules.length > 0 && completedCount === modules.length;

  const closeTour = () => {
    localStorage.setItem("ligneo_formation_tour", "1");
    setTourStep(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-[#2F5FFF]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl overflow-hidden border border-pro-border bg-[#0B1338] text-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] uppercase tracking-[0.22em] text-[#E7C76A] font-semibold flex items-center gap-2">
            <GraduationCap size={14} /> Espace formation interne
          </p>
          <TrainingStatusBadge
            statut={resolveTrainingStatut(allDone, completedCount)}
            percent={percent}
          />
        </div>
        <h1 className="mt-2 text-2xl font-semibold">Bienvenue {firstName} 👋</h1>
        <p className="mt-2 text-sm text-white/75 max-w-2xl leading-relaxed">
          « Cette formation, c'est ce qui garantit la même qualité de service sur chaque mission Ligneo. Elle couvre
          l'essentiel du terrain : conformité de vos documents, états des lieux, sécurité, incidents et clôture de
          mission. Prenez le temps, elle vous protège autant qu'elle protège nos clients. »
        </p>
        <p className="mt-2 text-xs text-[#E7C76A]">— Responsable exploitation, Transports Ligneo</p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {nextModule && (
            <Link
              to="/convoyeur/formation/module/$id"
              params={{ id: nextModule.id }}
              className="rounded-xl bg-gradient-to-r from-[#B8862A] to-[#E7C76A] text-[#0B1338] text-sm font-semibold px-5 py-2.5 flex items-center gap-2"
            >
              <PlayCircle size={16} />
              {completedCount === 0 ? "Commencer la formation" : "Reprendre où je me suis arrêté"}
            </Link>
          )}
          <span className="text-sm text-white/70">
            {completedCount}/{modules.length} modules · {percent}%
          </span>
        </div>
      </section>

      {allDone && (
        <section className="rounded-2xl border border-[#B8862A]/40 bg-gradient-to-r from-[#0B1338] to-[#111a3d] text-white p-6 text-center">
          <Sparkles className="mx-auto text-[#E7C76A]" />
          <h2 className="mt-2 text-xl font-semibold">Félicitations {firstName}, formation terminée !</h2>
          <p className="text-sm text-white/75 mt-1">
            Vous avez validé les {modules.length} modules. Votre attestation interne est disponible.
          </p>
          <button
            type="button"
            onClick={() =>
              user &&
              generateAttestationPdf({
                fullName: `${identity.prenom} ${identity.nom}`.trim(),
                userId: user.id,
                completedAt: new Date(),
                modulesCount: modules.length,
              })
            }
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#E7C76A] text-[#0B1338] text-sm font-semibold px-5 py-2.5"
          >
            <Award size={16} /> Télécharger mon attestation
          </button>
        </section>
      )}

      <section className="grid gap-3 sm:grid-cols-2">
        {modules.map((m) => {
          const st = moduleStatus(progress[m.id]);
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => navigate({ to: "/convoyeur/formation/module/$id", params: { id: m.id } })}
              className="text-left rounded-2xl border border-pro-border bg-white p-4 hover:border-[#2F5FFF]/40 hover:shadow-sm transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#B8862A]">
                  Module {m.order_index} {m.tag ? `· ${m.tag}` : ""}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    st === "done"
                      ? "bg-emerald-100 text-emerald-700"
                      : st === "in_progress"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-pro-bg-soft text-pro-muted"
                  }`}
                >
                  {STATUS_LABEL[st]}
                </span>
              </div>
              <h3 className="mt-1.5 text-sm font-semibold text-pro-text">{m.title}</h3>
              <p className="mt-1 text-xs text-pro-muted">{m.duration_minutes} min · {m.quiz_questions.length} questions</p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[#2F5FFF]">
                Ouvrir <ArrowRight size={12} />
              </span>
            </button>
          );
        })}
      </section>

      {tourStep !== null && TOUR[tourStep] && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4 overscroll-contain"
          style={{
            paddingTop: "calc(env(safe-area-inset-top, 0px) + 16px)",
            paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 96px)",
          }}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between">
              <h3 className="text-sm font-semibold text-pro-text">{TOUR[tourStep].title}</h3>
              <button type="button" onClick={closeTour}><X size={16} className="text-pro-muted" /></button>
            </div>
            <p className="mt-2 text-sm text-pro-text-soft">{TOUR[tourStep].text}</p>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-pro-muted">{tourStep + 1}/{TOUR.length}</span>
              <button
                type="button"
                onClick={() => (tourStep + 1 < TOUR.length ? setTourStep(tourStep + 1) : closeTour())}
                className="rounded-lg bg-[#0B1338] text-white text-xs font-semibold px-4 py-2"
              >
                {tourStep + 1 < TOUR.length ? "Suivant" : "C'est parti"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
