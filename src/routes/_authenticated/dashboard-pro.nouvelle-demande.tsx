import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Calculator, FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard-pro/nouvelle-demande")({
  component: ProNouvelleDemande,
});

function ProNouvelleDemande() {
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-pro-text">Nouvelle mission</h1>
        <p className="text-pro-muted text-sm mt-0.5">Choisissez votre mode de demande</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          to="/reserver"
          className="group bg-white rounded-xl border border-pro-border hover:border-pro-accent hover:shadow-md transition-all p-6"
        >
          <div className="w-11 h-11 rounded-lg bg-pro-accent/10 text-pro-accent flex items-center justify-center mb-4">
            <Calculator size={20} />
          </div>
          <h2 className="font-semibold text-pro-text">Devis instantané</h2>
          <p className="text-pro-text-soft text-sm mt-1.5 leading-relaxed">
            Calculez votre tarif en quelques secondes et réservez immédiatement.
          </p>
          <span className="inline-flex items-center gap-1 mt-4 text-pro-accent text-sm font-medium group-hover:gap-2 transition-all">
            Démarrer <ArrowRight size={14} />
          </span>
        </Link>

        <Link
          to="/contact"
          className="group bg-white rounded-xl border border-pro-border hover:border-pro-accent hover:shadow-md transition-all p-6"
        >
          <div className="w-11 h-11 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center mb-4">
            <FileText size={20} />
          </div>
          <h2 className="font-semibold text-pro-text">Demande sur mesure</h2>
          <p className="text-pro-text-soft text-sm mt-1.5 leading-relaxed">
            Volume important, conditions spécifiques, contrat-cadre : parlons-en.
          </p>
          <span className="inline-flex items-center gap-1 mt-4 text-pro-accent text-sm font-medium group-hover:gap-2 transition-all">
            Nous contacter <ArrowRight size={14} />
          </span>
        </Link>
      </div>

      <div className="bg-pro-accent/5 border border-pro-accent/20 rounded-xl p-5">
        <p className="text-sm text-pro-text">
          <span className="font-semibold">Vous gérez plusieurs missions ?</span>{" "}
          <span className="text-pro-text-soft">
            Contactez-nous pour mettre en place un compte avec tarifs négociés et facturation mensuelle groupée.
          </span>
        </p>
      </div>
    </div>
  );
}
