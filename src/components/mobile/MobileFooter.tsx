import { Link } from "@tanstack/react-router";
import StoreBadges from "@/components/public/StoreBadges";
import carteFrance from "@/assets/carte-france-tours.png";
import "@/styles/mobile-home-v2.css";

/** Pied de page commun des écrans mobiles publics (carte de France + liens légaux). */
export default function MobileFooter({ withStores = true }: { withStores?: boolean }) {
  return (
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
      {withStores && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
          <StoreBadges />
        </div>
      )}
      <p className="mh2-copy">© {new Date().getFullYear()} Transports LIGNEO</p>
    </footer>
  );
}
