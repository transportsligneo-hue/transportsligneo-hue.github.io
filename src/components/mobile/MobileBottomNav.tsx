import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Home, Truck, Sparkles, User, LogIn } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { scrollToDevis } from "@/lib/scroll-to-devis";

/**
 * Dock de navigation publique (mobile).
 * 4 onglets : Accueil · Missions (badge) · Estimer (CTA central surélevé) · Connexion.
 * Bandeau "Se connecter" au-dessus, uniquement pour les visiteurs non connectés.
 */
export default function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, role } = useAuth();
  const [pending, setPending] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!isAuthenticated) {
      setPending(0);
      return;
    }
    (async () => {
      try {
        const { count } = await supabase
          .from("devis")
          .select("id", { count: "exact", head: true })
          .in("statut", ["genere", "envoye", "en_attente"]);
        if (!cancelled) setPending(count ?? 0);
      } catch {
        if (!cancelled) setPending(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

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

  const goMissions = () => {
    if (!isAuthenticated) return navigate({ to: "/login" });
    if (role === "convoyeur") return navigate({ to: "/convoyeur/missions" });
    return navigate({ to: "/dashboard-client/missions" });
  };

  const goEstimer = () => {
    if (scrollToDevis()) return;
    navigate({ to: "/", hash: "devis" });
  };

  const isHome = location.pathname === "/";
  const isMissions = location.pathname.includes("/missions");
  const isEspace = isAuthenticated || location.pathname.startsWith("/login");

  return (
    <nav aria-label="Navigation principale" className="md:hidden ldock-zone">
      {!isAuthenticated && (
        <Link to="/login" className="ldock-login" aria-label="Se connecter">
          <span className="ldock-login-ic">
            <LogIn size={20} strokeWidth={2.2} />
          </span>
          <span className="flex-1 min-w-0 relative">
            <span className="ldock-login-title block">Se connecter</span>
            <span className="ldock-login-sub block">Accéder à mon compte</span>
          </span>
        </Link>
      )}

      <div className="ldock">
        <Link to="/" className={`ldock-item${isHome ? " is-active" : ""}`}>
          <span className="ldock-ic">
            <Home strokeWidth={2} />
          </span>
          <span>Accueil</span>
          <i className="ldock-dot" />
        </Link>

        <button onClick={goMissions} className={`ldock-item${isMissions ? " is-active" : ""}`} aria-label="Missions">
          {pending > 0 && <i className="ldock-badge not-italic">{pending > 9 ? "9+" : pending}</i>}
          <span className="ldock-ic">
            <Truck strokeWidth={2} />
          </span>
          <span>Missions</span>
          <i className="ldock-dot" />
        </button>

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
