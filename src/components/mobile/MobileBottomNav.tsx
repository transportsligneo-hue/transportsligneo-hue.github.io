import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Home, Truck, Sparkles, User, ChevronDown } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { scrollToDevis } from "@/lib/scroll-to-devis";

/**
 * Dock de navigation publique (mobile).
 * 4 onglets : Accueil · Services · Estimer (CTA central surélevé) · Connexion.
 */
export default function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, role } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const inDashboard =
    location.pathname.startsWith("/dashboard-client") ||
    location.pathname.startsWith("/dashboard-pro") ||
    location.pathname.startsWith("/flotte") ||
    location.pathname.startsWith("/entreprise") ||
    location.pathname.startsWith("/admin") ||
    location.pathname.startsWith("/convoyeur");
  if (inDashboard) return null;

  const goEspace = () => {
    if (!isAuthenticated) return navigate({ to: "/login" });
    if (role === "admin" || role === "super_admin") return navigate({ to: "/admin" });
    if (role === "convoyeur") return navigate({ to: "/convoyeur" });
    return navigate({ to: "/dashboard-client" });
  };

  const goEstimer = () => {
    if (scrollToDevis()) return;
    navigate({ to: "/", hash: "devis" });
  };

  const isHome = location.pathname === "/";
  const isServices = location.pathname.startsWith("/services");
  const isEspace = isAuthenticated || location.pathname.startsWith("/login");


  return (
    <nav aria-label="Navigation principale" className={`md:hidden ldock-zone${collapsed ? " is-collapsed" : ""}`}>
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        aria-label={collapsed ? "Afficher la barre de navigation" : "Masquer la barre de navigation"}
        aria-expanded={!collapsed}
        className="ldock-toggle"
      >
        <ChevronDown size={16} />
      </button>
      <div className="ldock">
        <Link to="/" className={`ldock-item${isHome ? " is-active" : ""}`}>
          <span className="ldock-ic">
            <Home strokeWidth={2} />
          </span>
          <span>Accueil</span>
          <i className="ldock-dot" />
        </Link>

        <Link to="/services" className={`ldock-item${isServices ? " is-active" : ""}`} aria-label="Services">
          <span className="ldock-ic">
            <Truck strokeWidth={2} />
          </span>
          <span>Services</span>
          <i className="ldock-dot" />
        </Link>

        <button onClick={goEstimer} className="ldock-item is-raised" aria-label="Estimer mon trajet">
          <span className="ldock-fab">
            <Sparkles strokeWidth={2.1} />
          </span>
          <span>Estimer</span>
        </button>

        <button onClick={goEspace} className={`ldock-item${isEspace ? " is-active" : ""}`} aria-label="Mon espace">
          <span className="ldock-ic">
            <User strokeWidth={2} />
          </span>
          <span>{isAuthenticated ? "Espace" : "Connexion"}</span>
          <i className="ldock-dot" />
        </button>
      </div>
    </nav>
  );
}
