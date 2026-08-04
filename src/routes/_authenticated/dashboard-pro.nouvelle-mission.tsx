import { createFileRoute, Link } from "@tanstack/react-router";
import { Car, Layers, ArrowRight } from "lucide-react";
import FleetPageHeader from "@/components/flotte/FleetPageHeader";

export const Route = createFileRoute("/_authenticated/dashboard-pro/nouvelle-mission")({
  component: NouvelleMissionChoice,
});

function NouvelleMissionChoice() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <FleetPageHeader
        breadcrumb="Nouvelle mission"
        eyebrow="Créer une demande"
        title="Que souhaitez-vous"
        highlight="créer ?"
        subtitle="Choisissez le type de mission adapté à votre besoin."
      />


      <div className="grid gap-5 sm:grid-cols-2">
        <Link
          to="/dashboard-pro/nouvelle-demande"
          className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-[#2f5fff]/40 hover:shadow-[0_20px_40px_-24px_rgba(47,95,255,0.35)]"
        >
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#eaf0ff] text-[#2f5fff]">
            <Car className="h-6 w-6" strokeWidth={2} />
          </div>
          <h2 className="text-lg font-semibold text-slate-900">Mission simple</h2>
          <p className="mt-1 text-sm text-slate-500">
            Un seul véhicule, un trajet, un contact départ et arrivée.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-[#2f5fff]">
            Créer une mission simple
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </div>
        </Link>

        <Link
          to="/dashboard-pro/nouvelle-mission/groupee"
          className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-[#7c5cff]/40 hover:shadow-[0_20px_40px_-24px_rgba(124,92,255,0.35)]"
        >
          <span className="absolute right-4 top-4 rounded-full bg-[#f0ecff] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#5334d6]">
            Flotte
          </span>
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#f0ecff] text-[#7c5cff]">
            <Layers className="h-6 w-6" strokeWidth={2} />
          </div>
          <h2 className="text-lg font-semibold text-slate-900">Mission groupée</h2>
          <p className="mt-1 text-sm text-slate-500">
            Plusieurs véhicules de votre parc à convoyer en une seule opération.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-[#7c5cff]">
            Créer une mission groupée
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </div>
        </Link>
      </div>
    </div>
  );
}
