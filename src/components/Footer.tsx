import { Link } from "@tanstack/react-router";

export default function Footer() {
  return (
    <footer className="py-12 bg-navy border-t border-primary/15">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid md:grid-cols-3 gap-8 mb-10">
          <div>
            <p className="font-heading text-primary tracking-[0.2em] uppercase text-lg mb-3">
              Transports Ligneo
            </p>
            <p className="text-cream/50 text-sm leading-relaxed">
              Convoyage automobile premium<br />
              Basé à Tours (37)
            </p>
          </div>
          <div>
            <p className="font-heading text-cream/70 text-xs tracking-[0.15em] uppercase mb-3">
              Navigation
            </p>
            <ul className="space-y-2 text-sm">
              {["Accueil", "Engagements", "Prestations", "Tarifs", "Devis", "Contact"].map((l) => (
                <li key={l}>
                  <a
                    href={`#${l.toLowerCase()}`}
                    className="text-cream/50 hover:text-primary transition-colors"
                  >
                    {l}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-heading text-cream/70 text-xs tracking-[0.15em] uppercase mb-3">
              Coordonnées
            </p>
            <div className="text-sm text-cream/50 space-y-1 mb-6">
              <p>07 82 45 61 81</p>
              <p>contact@transportsligneo.fr</p>
              <p>www.transportsligneo.fr</p>
            </div>
            <p className="font-heading text-cream/70 text-xs tracking-[0.15em] uppercase mb-3">
              Informations légales
            </p>
            <ul className="space-y-2 text-sm">
              <li><Link to="/pro" className="text-cream/50 hover:text-primary transition-colors">Espace professionnels</Link></li>
              <li><Link to="/blog" className="text-cream/50 hover:text-primary transition-colors">Blog</Link></li>
              <li><Link to="/cgv" className="text-cream/50 hover:text-primary transition-colors">Conditions Générales de Vente</Link></li>
              <li><Link to="/mentions-legales" className="text-cream/50 hover:text-primary transition-colors">Mentions Légales</Link></li>
              <li><Link to="/confidentialite" className="text-cream/50 hover:text-primary transition-colors">Politique de Confidentialité</Link></li>
              <li><Link to="/inscription-convoyeur" className="text-cream/50 hover:text-primary transition-colors">Devenir convoyeur</Link></li>
              <li><Link to="/login" className="text-cream/30 hover:text-primary transition-colors text-xs mt-2 inline-block">Espace pro</Link></li>
            </ul>
          </div>
        </div>
        <div className="gold-divider mb-6" />
        <p className="text-center text-cream/30 text-xs tracking-wider">
          © {new Date().getFullYear()} Transports Ligneo — Tous droits réservés
        </p>
      </div>
    </footer>
  );
}
