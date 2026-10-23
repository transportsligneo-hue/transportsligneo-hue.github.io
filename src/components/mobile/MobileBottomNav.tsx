import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Home, Truck, User, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { RouteAB } from "@/components/mobile/MobileIcons";
import "@/styles/mobile-home-v2.css";
import { useAuth } from "@/hooks/useAuth";

/**
 * Dock de navigation publique (mobile).
 * 4 onglets : Accueil · Services · Estimer (CTA central surélevé) · Connexion.
 */
export default function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, role } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const lastY = useRef(0);

  // Se replie quand on descend dans la page, réapparaît quand on remonte.
  useEffect(() => {
    lastY.current = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (Math.abs(y - lastY.current) < 8) return;
      setCollapsed(y > lastY.current && y > 120);
      lastY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
    navigate({ to: "/tarifs" });
  };

  const isHome = location.pathname === "/";
  const isServices = location.pathname.startsWith("/services");
  const isEspace = isAuthenticated || location.pathname.startsWith("/login");


  return (
    <nav aria-label="Navigation principale" className={`md:hidden ldock-zone mh2-dock${collapsed ? " is-collapsed" : ""}`}>
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

        <Link to="/services" search={{ audience: "particuliers" }} className={`ldock-item${isServices ? " is-active" : ""}`} aria-label="Services">
          <span className="ldock-ic">
            <Truck strokeWidth={2} />
          </span>
          <span>Services</span>
          <i className="ldock-dot" />
        </Link>

        <button onClick={goEstimer} className="ldock-item is-raised" aria-label="Estimer mon trajet">
          <span className="ldock-fab">
            <RouteAB />
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
