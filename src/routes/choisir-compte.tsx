import { createFileRoute, Link } from "@tanstack/react-router";
import { Car, UserCheck, Building2, Truck, ArrowRight } from "lucide-react";
import logoLigneo from "@/assets/logo-transports-ligneo-officiel.png";

export const Route = createFileRoute("/choisir-compte")({
  component: ChoisirCompte,
  head: () => ({
    meta: [
      { title: "Créer un compte · Transports Ligneo" },
      { name: "description", content: "Choisissez votre type de compte : particulier, professionnel B2B, flotte ou convoyeur." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

type Card = {
  to: "/inscription-client" | "/inscription-pro" | "/inscription-flotte" | "/inscription-convoyeur";
  icon: typeof Car;
  title: string;
  desc: string;
  badge?: string;
};

const CARDS: Card[] = [
  { to: "/inscription-client", icon: Car, title: "Particulier", desc: "Réservez le convoyage de votre véhicule en quelques clics. Devis instantané, paiement sécurisé." },
  { to: "/inscription-pro", icon: Building2, title: "Professionnel", desc: "Concession, loueur, agence : dashboard pro, tarifs négociés, facturation mensuelle.", badge: "B2B" },
  { to: "/inscription-flotte", icon: Truck, title: "Flotte", desc: "Multi-sites, gros volumes, contrat-cadre. Tarifs sur mesure et compte dédié.", badge: "Grand compte" },
  { to: "/inscription-convoyeur", icon: UserCheck, title: "Convoyeur", desc: "Rejoignez notre réseau de chauffeurs indépendants. Validation par notre équipe sous 48 h." },
];

function ChoisirCompte() {
  return (
    <div className="auth-shell flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-5xl auth-fade-in">
        <div className="text-center mb-10">
          <Link to="/" className="inline-block mb-5">
            <img src={logoLigneo} alt="Transports Ligneo" className="h-14 w-auto mx-auto drop-shadow-[0_8px_20px_rgba(59,130,246,0.35)]" />
          </Link>
          <div className="auth-eyebrow justify-center">Créer un compte</div>
          <h1 className="auth-title text-3xl md:text-[42px]">
            Choisissez votre <span className="auth-accent">profil</span>
          </h1>
          <p className="auth-subtle text-sm md:text-base mt-3 max-w-xl mx-auto">
            Sélectionnez le type de compte qui correspond à votre besoin. Vous pourrez le faire évoluer à tout moment.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {CARDS.map(({ to, icon: Icon, title, desc, badge }) => (
            <Link
              key={to}
              to={to}
              className="group auth-card p-6 relative transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_50px_-10px_rgba(59,130,246,0.5)] hover:border-blue-300/40"
            >
              {badge && (
                <div className="absolute top-3 right-3 px-2 py-0.5 bg-blue-400/15 text-blue-200 text-[10px] uppercase tracking-wider rounded-full border border-blue-300/25">
                  {badge}
                </div>
              )}
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/25 to-blue-400/10 border border-blue-300/25 flex items-center justify-center group-hover:from-blue-500/40 group-hover:border-blue-300/40 transition-all">
                  <Icon size={26} className="text-blue-200" />
                </div>
                <h2 className="font-heading text-lg text-white font-bold" style={{ fontFamily: "'Poppins', sans-serif" }}>
                  {title}
                </h2>
                <p className="text-white/60 text-xs leading-relaxed">{desc}</p>
                <span className="inline-flex items-center gap-1.5 text-blue-200 text-[10px] uppercase tracking-[0.18em] font-semibold group-hover:gap-2.5 transition-all pt-1">
                  Continuer <ArrowRight size={12} />
                </span>
              </div>
            </Link>
          ))}
        </div>

        <div className="text-center mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link to="/login" className="auth-link-lg is-gold">
            Déjà inscrit ? Se connecter
            <ArrowRight size={14} className="arrow" />
          </Link>
          <Link to="/" className="auth-link-lg">
            <ArrowRight size={14} className="arrow-back rotate-180" />
            Retour au site
          </Link>
        </div>
      </div>
    </div>
  );
}
