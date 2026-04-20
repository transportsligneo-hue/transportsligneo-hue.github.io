import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Home, Tag, User, Calendar } from "lucide-react";
import { useState } from "react";
import ReservationModal from "@/components/ReservationModal";
import { useAuth } from "@/hooks/useAuth";

/**
 * Bottom navigation publique (mobile uniquement).
 * 4 onglets : Accueil · Tarifs · Réserver (CTA centré) · Mon espace.
 */
export default function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, role } = useAuth();
  const [reserveOpen, setReserveOpen] = useState(false);

  // Ne pas afficher la nav publique sur les espaces authentifiés (ils ont leur propre nav)
  const inDashboard =
    location.pathname.startsWith("/dashboard-client") ||
    location.pathname.startsWith("/admin") ||
    location.pathname.startsWith("/convoyeur");
  if (inDashboard) return null;

  const goEspace = () => {
    if (!isAuthenticated) return navigate({ to: "/login" });
    if (role === "admin") return navigate({ to: "/admin" });
    if (role === "convoyeur") return navigate({ to: "/convoyeur" });
    return navigate({ to: "/dashboard-client" });
  };

  const isHome = location.pathname === "/";
  const isTarifs = location.pathname.startsWith("/tarifs");
  const isEspace =
    isAuthenticated ||
    location.pathname.startsWith("/dashboard-client") ||
    location.pathname.startsWith("/admin") ||
    location.pathname.startsWith("/convoyeur") ||
    location.pathname.startsWith("/login");

  const tabBase = "flex flex-col items-center justify-center gap-1 h-full tap-scale";
  const colorOn = "text-primary";
  const colorOff = "text-cream/55";

  return (
    <>
      <nav
        aria-label="Navigation principale"
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass-bar border-t border-primary/15 safe-bottom"
      >
        <div className="grid grid-cols-4 h-16 items-stretch">
          <Link to="/" className={tabBase}>
            <Home size={20} className={isHome ? colorOn : colorOff} />
            <span className={`text-[10px] tracking-[0.1em] uppercase ${isHome ? colorOn : colorOff}`}>
              Accueil
            </span>
          </Link>

          <Link to="/tarifs" className={tabBase}>
            <Tag size={20} className={isTarifs ? colorOn : colorOff} />
            <span className={`text-[10px] tracking-[0.1em] uppercase ${isTarifs ? colorOn : colorOff}`}>
              Tarifs
            </span>
          </Link>

          {/* CTA Réserver — centré, surélevé */}
          <button
            onClick={() => setReserveOpen(true)}
            className="relative flex flex-col items-center justify-center gap-1 h-full tap-scale"
            aria-label="Réserver un convoyage"
          >
            <span className="absolute -top-5 w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-[0_8px_24px_-4px_rgba(212,175,55,0.55)] border-2 border-navy">
              <Calendar size={20} />
            </span>
            <span className="mt-7 text-[10px] tracking-[0.15em] uppercase font-heading text-primary">
              Réserver
            </span>
          </button>

          <button onClick={goEspace} className={tabBase} aria-label="Mon espace">
            <User size={20} className={isEspace ? colorOn : colorOff} />
            <span className={`text-[10px] tracking-[0.1em] uppercase ${isEspace ? colorOn : colorOff}`}>
              {isAuthenticated ? "Espace" : "Connexion"}
            </span>
          </button>
        </div>
      </nav>

      <ReservationModal open={reserveOpen} onClose={() => setReserveOpen(false)} />
    </>
  );
}
