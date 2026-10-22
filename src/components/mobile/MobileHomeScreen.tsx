import { Link } from "@tanstack/react-router";
import { Briefcase, ChevronRight, Clock, LogIn, Route as RouteIcon, ShieldCheck, Star, User } from "lucide-react";
import StoreBadges from "@/components/public/StoreBadges";
import MobileGoogleReviews from "@/components/mobile/MobileGoogleReviews";
import MobileFaq from "@/components/mobile/MobileFaq";
import { GoogleG, RouteAB, SteeringWheel } from "@/components/mobile/MobileIcons";
import DevisGenerator from "@/components/DevisGenerator";
import { useAuth } from "@/hooks/useAuth";
import heroBg from "@/assets/hero-ligneo-night.jpg";
import carteFrance from "@/assets/carte-france-tours.png";
import "@/styles/mobile-home-v2.css";

/**
 * MobileHomeScreen · v4
 * Reproduction fidèle de la maquette « accueil mobile client » :
 * hero photo, trio de confiance, vrai estimateur (DevisGenerator) dans un panneau bleu nuit,
 * parcours colorés, « Comment ça marche » animé, suivi, avis Google, FAQ, pied de page.
 * Toutes les routes et le vrai simulateur restent branchés.
 */
export default function MobileHomeScreen() {
  const { isAuthenticated, homeRoute } = useAuth();
  return (
    <div className="mh2-root md:hidden">
      {/* === HERO === */}
      <section className="mh2-hero">
        <img src={heroBg} alt="Convoyeur Transports Ligneo" loading="eager" decoding="async" fetchPriority="high" />
        <div className="mh2-hero-c">
          <div className="mh2-kick">
            <i />
            Convoyage et logistique automobile
          </div>
          <h1>
            Votre convoyage <em>sur toute la ligne</em>
          </h1>
          <p>Estimez, réservez et suivez vos convoyages en quelques secondes, partout en France.</p>
        </div>
      </section>

      {/* === Trio de confiance === */}
      <div className="mh2-trust">
        <div>
          <span className="mh2-ti"><Star size={15} className="mh-i" /></span>
          <b>4,8/5</b>
          <span className="mh2-gg"><GoogleG size={14} />Avis Google</span>
        </div>
        <div>
          <span className="mh2-ti"><ShieldCheck size={15} /></span>
          <b>100 %</b>
          Assuré
        </div>
        <div>
          <span className="mh2-ti"><Clock size={15} /></span>
          <b>7j/7</b>
          Disponible
        </div>
      </div>

      {/* === Estimateur (vrai simulateur) === */}
      <div id="mobile-devis" className="mh2-sec scroll-mt-20">
        <div className="mh2-h2">Devis instantané</div>
        <h2 className="mh2-t2">
          Estimez votre <em>trajet</em>
        </h2>
        <div className="mh2-est">
          <DevisGenerator variant="flat-mini" />
        </div>
      </div>

      {/* === Qui êtes-vous ? === */}
      <nav className="mh2-sec" aria-label="Choisir mon parcours">
        <div className="mh2-h2">Mon parcours</div>
        <h2 className="mh2-t2">Qui êtes-vous ?</h2>
        <div className="mh2-paths">
          <Link to="/services" search={{ audience: "particuliers" }} className="mh2-path"><User size={20} />Je suis un particulier</Link>
          <Link to="/services" search={{ audience: "pro" }} className="mh2-path"><Briefcase size={20} />Je suis un professionnel</Link>
          <Link to="/devenir-convoyeur" className="mh2-path"><SteeringWheel className="mh-i" />Je suis convoyeur</Link>
          <Link to={isAuthenticated ? homeRoute : "/login"} className="mh2-path"><LogIn size={20} />Mon espace client</Link>
        </div>
      </nav>

      {/* === Comment ça marche === */}
      <section className="mh2-sec mh2-band">
        <div className="mh2-h2">Comment ça marche</div>
        <h2 className="mh2-t2">
          Simple comme <em>1, 2, 3</em>
        </h2>
        <div className="mh2-steps">
          <div className="mh2-step">
            <div className="mh2-n">1</div>
            <div><b>Estimez en 30 secondes</b><p>Départ, arrivée, date : prix immédiat.</p></div>
            <RouteAB className="mh2-si mh-i" />
          </div>
          <div className="mh2-step">
            <div className="mh2-n">2</div>
            <div><b>Un convoyeur vérifié</b><p>Il prend en charge votre véhicule, assuré.</p></div>
            <SteeringWheel className="mh2-si mh-i" />
          </div>
          <div className="mh2-step">
            <div className="mh2-n">3</div>
            <div><b>Suivi & remise par code</b><p>Position en direct, livraison sécurisée.</p></div>
            <RouteIcon className="mh2-si mh-i" size={22} />
          </div>
        </div>
      </section>

      {/* === Suivre mon véhicule === */}
      <div className="mh2-sec">
        <Link to="/suivi" className="mh2-track">
          <span className="mh2-ico"><RouteAB className="mh-i" /></span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <b>Suivre mon véhicule</b>
            <p>Entrez votre numéro de mission pour voir la position en direct.</p>
          </span>
          <span className="mh2-go"><ChevronRight size={16} /></span>
        </Link>
      </div>

      {/* === Avis Google + FAQ === */}
      <MobileGoogleReviews />
      <MobileFaq />

      {/* === Pied de page === */}
      <footer>
        <div className="mh2-foot">
          <img src={carteFrance} alt="Carte de France : Transports Ligneo est basé à Tours" className="mh2-map" width={78} height={78} loading="lazy" />
          <div style={{ minWidth: 0 }}>
            <b>Basé à Tours (37)</b>
            <small>07 82 45 61 81 · contact@transportsligneo.fr</small>
          </div>
        </div>
        <div className="mh2-links">
          <Link to="/suivi">Suivi mission</Link>
          <Link to="/actualites">Actualités</Link>
          <Link to="/cgv">CGV</Link>
          <Link to="/mentions-legales">Mentions</Link>
          <Link to="/confidentialite">Privacy</Link>
        </div>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
          <StoreBadges />
        </div>
        <p className="mh2-copy">© {new Date().getFullYear()} Transports LIGNEO</p>
      </footer>
    </div>
  );
}
