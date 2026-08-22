import { Link } from "@tanstack/react-router";
import { Home } from "lucide-react";

/**
 * Petit bouton flottant "Revenir à l'accueil" en bleu néon électrique.
 * Apparaît sur toutes les pages publiques (hors tunnels, dashboards, app native).
 */
export default function BackToHome() {
  return (
    <Link
      to="/"
      className="back-to-home"
      aria-label="Revenir à l'accueil"
    >
      <Home size={18} strokeWidth={2.25} />
      <span className="back-to-home-label">Accueil</span>
    </Link>
  );
}
