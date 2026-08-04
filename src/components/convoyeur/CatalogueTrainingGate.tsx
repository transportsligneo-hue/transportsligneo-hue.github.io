import { Link } from "@tanstack/react-router";
import { GraduationCap, Lock, ArrowRight } from "lucide-react";
import { useTraining } from "@/lib/formation/useTraining";
import { TrainingStatusBadge, resolveTrainingStatut } from "./TrainingStatusBadge";

/**
 * Écran de blocage : le catalogue des missions reste inaccessible
 * tant que la formation "Académie Ligneo" n'est pas validée.
 */
export function CatalogueTrainingGate() {
  const { percent, completedCount, modules } = useTraining();
  const statut = resolveTrainingStatut(false, completedCount);

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 -mt-4 sm:-mt-6 lg:-mt-8">
      <div
        className="relative min-h-[calc(100vh-2rem)] px-4 sm:px-6 lg:px-8 pt-10 pb-24 text-white"
        style={{
          background:
            "radial-gradient(120% 80% at 50% 0%, #0b1a44 0%, #060e28 55%, #030814 100%)",
        }}
      >
        <div className="relative z-10 mx-auto max-w-2xl space-y-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-300/40 bg-amber-500/10">
            <Lock size={26} className="text-amber-200" />
          </div>
          <h1
            className="text-2xl font-black sm:text-3xl"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Catalogue verrouillé
          </h1>
          <p className="mx-auto max-w-lg text-sm text-white/70">
            L'accès au catalogue des missions est ouvert une fois la formation
            <strong className="text-white"> Académie Ligneo</strong> validée. Elle couvre
            l'état des lieux, la prise en charge, la livraison et la qualité de service.
          </p>

          <div className="mx-auto flex flex-col items-center gap-3">
            <TrainingStatusBadge statut={statut} percent={percent} />
            <div className="h-2 w-full max-w-sm overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-300 to-amber-500 transition-all"
                style={{ width: `${percent}%` }}
              />
            </div>
            <p className="text-xs text-white/50">
              {completedCount} / {modules.length || 8} modules terminés
            </p>
          </div>

          <Link
            to="/convoyeur/formation"
            className="inline-flex items-center gap-2 rounded-xl bg-[#2F5FFF] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110"
          >
            <GraduationCap size={16} />
            {completedCount > 0 ? "Reprendre ma formation" : "Démarrer ma formation"}
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  );
}
