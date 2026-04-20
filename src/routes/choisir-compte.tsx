import { createFileRoute, Link } from "@tanstack/react-router";
import { Car, UserCheck, Building2, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/choisir-compte")({
  component: ChoisirCompte,
  head: () => ({
    meta: [
      { title: "Créer un compte — Transports Ligneo" },
      { name: "description", content: "Choisissez votre type de compte : particulier, professionnel B2B ou convoyeur." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function ChoisirCompte() {
  return (
    <div className="min-h-screen section-bg flex items-center justify-center px-4 py-12">
      <div className="max-w-6xl w-full">
        <div className="text-center mb-12">
          <div className="gold-divider-short mx-auto mb-4" />
          <h1 className="font-heading text-2xl md:text-4xl text-primary tracking-[0.15em] uppercase">
            Créer un compte
          </h1>
          <p className="text-cream/60 mt-3 text-sm md:text-base">
            Sélectionnez le profil correspondant à votre besoin
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link
            to="/inscription-client"
            className="group card-premium rounded p-6 md:p-8 border border-primary/20 hover:border-primary/60 transition-all duration-300 hover:shadow-[0_0_30px_rgba(212,175,55,0.15)]"
          >
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Car size={28} className="text-primary" />
              </div>
              <h2 className="font-heading text-lg md:text-xl text-cream tracking-[0.1em] uppercase">
                Particulier
              </h2>
              <p className="text-cream/60 text-sm leading-relaxed">
                Réservez le convoyage de votre véhicule en quelques clics. Devis instantané.
              </p>
              <span className="inline-flex items-center gap-2 text-primary text-xs uppercase tracking-[0.15em] group-hover:gap-3 transition-all">
                Continuer <ArrowRight size={14} />
              </span>
            </div>
          </Link>

          <Link
            to="/inscription-pro"
            className="group card-premium rounded p-6 md:p-8 border border-primary/40 hover:border-primary/70 transition-all duration-300 hover:shadow-[0_0_30px_rgba(212,175,55,0.2)] relative"
          >
            <div className="absolute top-3 right-3 px-2 py-0.5 bg-primary/20 text-primary text-[10px] uppercase tracking-wider rounded-full border border-primary/30">
              B2B
            </div>
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary/15 border border-primary/40 flex items-center justify-center group-hover:bg-primary/25 transition-colors">
                <Building2 size={28} className="text-primary" />
              </div>
              <h2 className="font-heading text-lg md:text-xl text-cream tracking-[0.1em] uppercase">
                Professionnel
              </h2>
              <p className="text-cream/60 text-sm leading-relaxed">
                Concessionnaires, loueurs, assurances : dashboard avancé et tarifs négociés.
              </p>
              <span className="inline-flex items-center gap-2 text-primary text-xs uppercase tracking-[0.15em] group-hover:gap-3 transition-all">
                Continuer <ArrowRight size={14} />
              </span>
            </div>
          </Link>

          <Link
            to="/inscription-convoyeur"
            className="group card-premium rounded p-6 md:p-8 border border-primary/20 hover:border-primary/60 transition-all duration-300 hover:shadow-[0_0_30px_rgba(212,175,55,0.15)]"
          >
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <UserCheck size={28} className="text-primary" />
              </div>
              <h2 className="font-heading text-lg md:text-xl text-cream tracking-[0.1em] uppercase">
                Convoyeur
              </h2>
              <p className="text-cream/60 text-sm leading-relaxed">
                Rejoignez notre réseau de chauffeurs. Validation par notre équipe sous 48h.
              </p>
              <span className="inline-flex items-center gap-2 text-primary text-xs uppercase tracking-[0.15em] group-hover:gap-3 transition-all">
                Continuer <ArrowRight size={14} />
              </span>
            </div>
          </Link>
        </div>

        <div className="text-center mt-10 space-y-2">
          <Link to="/login" className="block text-primary text-xs hover:text-gold-light transition-colors uppercase tracking-[0.15em]">
            Déjà inscrit ? Se connecter
          </Link>
          <Link to="/" className="block text-cream/40 text-xs hover:text-primary transition-colors">
            ← Retour au site
          </Link>
        </div>
      </div>
    </div>
  );
}
