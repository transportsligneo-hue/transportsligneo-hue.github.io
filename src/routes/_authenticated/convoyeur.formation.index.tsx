import { toast } from "sonner";
import { PageSkeleton } from "@/components/driver2/PageSkeleton";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { GraduationCap, Play, Sparkles, ChevronRight, Award, Check, LifeBuoy, X } from "lucide-react";
import { useTraining } from "@/lib/formation/useTraining";
import { moduleStatus, STATUS_LABEL } from "@/lib/formation/types";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { generateAttestationPdf } from "@/lib/formation/attestation-pdf";
import { resolveTrainingStatut } from "@/components/convoyeur/TrainingStatusBadge";

export const Route = createFileRoute("/_authenticated/convoyeur/formation/")({
  head: () => ({
    meta: [
      { title: "Formation convoyeur — Transports Ligneo" },
      { name: "description", content: "Parcours de formation interne des convoyeurs Transports Ligneo." },
      { property: "og:title", content: "Formation convoyeur — Transports Ligneo" },
      { property: "og:description", content: "Parcours de formation interne des convoyeurs Transports Ligneo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FormationHome,
});

const TOUR = [
  { title: "Votre parcours", text: "8 modules, dans l'ordre qui vous convient. Votre progression est enregistrée automatiquement." },
  { title: "Reprise automatique", text: "À chaque connexion, vous repartez du dernier module non terminé." },
  { title: "Quiz de validation", text: "Chaque module se valide par un quiz (100 % requis). Les tentatives sont illimitées." },
  { title: "Besoin d'aide ?", text: "La FAQ et l'équipe Ligneo restent accessibles depuis chaque page." },
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
      <PageSkeleton />
    );
  }

  const statut = resolveTrainingStatut(allDone, completedCount);
  const statutLabel = statut === "validee" ? "Formation validée" : statut === "en_cours" ? "Formation en cours" : "À démarrer";
  const R = 32;
  const C = 2 * Math.PI * R;

  return (
    <>
      <section className="fm-hero">
        <div className="fm-hero-row">
          <div style={{ minWidth: 0 }}>
            <p className="fm-eyebrow"><GraduationCap size={14} /> Formation Ligneo</p>
            <h1 className="fm-hero-t">Bonjour {firstName}</h1>
          </div>
          <div className="fm-ring" role="img" aria-label={`Progression ${percent} %`}>
            <svg viewBox="0 0 76 76" aria-hidden="true">
              <circle cx="38" cy="38" r={R} fill="none" stroke="rgba(255,255,255,.16)" strokeWidth="7" />
              <circle cx="38" cy="38" r={R} fill="none" stroke="url(#fmg)" strokeWidth="7" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - percent / 100)} style={{ transition: "stroke-dashoffset .7s" }} />
              <defs><linearGradient id="fmg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#14B866" /><stop offset="1" stopColor="#6effcd" /></linearGradient></defs>
            </svg>
            <b>{percent}%</b>
          </div>
        </div>
        <p className="fm-quote">
          Cette formation garantit la même qualité de service sur chaque mission Ligneo : documents, états des lieux,
          sécurité, incidents et clôture. Prenez le temps, elle vous protège autant qu'elle protège nos clients.
        </p>
        <p className="fm-sign">Responsable exploitation, Transports Ligneo</p>
        <div className="fm-bar"><i style={{ width: `${percent}%` }} /></div>
        <div className="fm-foot">
          <span className="fm-meta">{completedCount} module{completedCount > 1 ? "s" : ""} validé{completedCount > 1 ? "s" : ""} sur {modules.length} · {statutLabel}</span>
          {nextModule && (
            <Link to="/convoyeur/formation/module/$id" params={{ id: nextModule.id }} className="fm-cta">
              <Play size={16} fill="currentColor" />
              {completedCount === 0 ? "Commencer la formation" : "Reprendre où je me suis arrêté"}
            </Link>
          )}
        </div>
      </section>

      {allDone && (
        <section className="fm-hero fm-win">
          <Sparkles size={26} color="#6effcd" style={{ margin: "0 auto" }} />
          <h2 className="fm-hero-t">Félicitations {firstName}</h2>
          <p className="fm-quote" style={{ margin: "8px auto 0" }}>
            Vous avez validé les {modules.length} modules. Votre attestation interne est disponible.
          </p>
          <button
            type="button"
            onClick={async () => {
              if (!user) return;
              try {
                await generateAttestationPdf({
                  fullName: `${identity.prenom} ${identity.nom}`.trim(),
                  userId: user.id,
                  completedAt: new Date(),
                  modulesCount: modules.length,
                });
              } catch (e) {
                toast.error("Impossible de générer l'attestation. Réessayez.");
                console.error(e);
              }
            }}
            className="fm-cta"
            style={{ marginTop: 16 }}
          >
            <Award size={16} /> Télécharger mon attestation
          </button>
        </section>
      )}

      <div className="fm-sec"><span>Les modules</span><em>{completedCount}/{modules.length}</em><i /></div>
      <section className="fm-list">
        {modules.map((m) => {
          const st = moduleStatus(progress[m.id]);
          const cls = st === "done" ? " done" : st === "in_progress" ? " prog" : "";
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => navigate({ to: "/convoyeur/formation/module/$id", params: { id: m.id } })}
              className={`fm-mod${cls}`}
            >
              <span className="fm-n">{st === "done" ? <Check size={18} strokeWidth={3} /> : m.order_index}</span>
              <span className="fm-mt">
                <b>{m.title}</b>
                <small>{m.tag ? `${m.tag} · ` : ""}{m.quiz_questions.length} questions</small>
              </span>
              <span className="fm-st">{STATUS_LABEL[st]}</span>
              <ChevronRight size={16} className="fm-chev" />
            </button>
          );
        })}
      </section>

      <div className="fm-help">
        <LifeBuoy size={18} />
        <p style={{ margin: 0 }}><b>Besoin d'aide ?</b> Consultez la FAQ ou contactez le responsable exploitation, Transports Ligneo.</p>
      </div>

      {tourStep !== null && TOUR[tourStep] && (
        <div className="fm-ov" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 16px)", paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 96px)" }}>
          <div role="dialog" aria-modal="true" aria-labelledby="driver-tour-title" className="fm-pop">
            <div className="fm-pop-h">
              <h3 id="driver-tour-title">{TOUR[tourStep].title}</h3>
              <button type="button" aria-label="Fermer" onClick={closeTour} className="fm-x"><X size={16} /></button>
            </div>
            <p>{TOUR[tourStep].text}</p>
            <div className="fm-pop-f">
              <span className="fm-dots" aria-label={`Étape ${tourStep + 1} sur ${TOUR.length}`}>
                {TOUR.map((_, i) => <i key={i} className={i === tourStep ? "on" : ""} />)}
              </span>
              <button
                type="button"
                onClick={() => (tourStep + 1 < TOUR.length ? setTourStep(tourStep + 1) : closeTour())}
                className="fm-cta"
                style={{ height: 42, padding: "0 18px" }}
              >
                {tourStep + 1 < TOUR.length ? "Suivant" : "C'est parti"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
