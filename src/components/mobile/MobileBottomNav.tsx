import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Home, Tag, User, Calendar } from "lucide-react";
import { useState } from "react";
import ReservationModal from "@/components/ReservationModal";
import { useAuth } from "@/hooks/useAuth";

/**
 * Bottom navigation publique (mobile uniquement).
 * 4 onglets : Accueil · Tarifs · Réserver (CTA centré) · Mon espace.
 * Le bouton Réserver ouvre la modal de réservation existante.
 * Mon espace redirige vers le dashboard correspondant au rôle, ou /login.
 */
export default function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, role } = useAuth();
  const [reserveOpen, setReserveOpen] = useState(false);

  const goEspace = () => {
    if (!isAuthenticated) return navigate({ to: "/login" });
    if (role === "admin") return navigate({ to: "/admin" });
    if (role === "convoyeur") return navigate({ to: "/convoyeur" });
    return navigate({ to: "/dashboard-client" });
  };

  const isActive = (path: string, exact = false) =>
    exact ? location.pathname === path : location.pathname.startsWith(path);

  return (
    <>
      <nav
        aria-label="Navigation principale"
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass-bar border-t border-primary/15 safe-bottom"
      >
        <div className="grid grid-cols-4 h-16 items-stretch">
          <NavTab
            label="Accueil"
            icon={<Home size={20} />}
            active={isActive("/", true)}
            as={
              <Link to="/" className="flex flex-col items-center justify-center gap-1 h-full tap-scale" />
            }
          />
          <NavTab
            label="Tarifs"
            icon={<Tag size={20} />}
            active={isActive("/tarifs")}
            as={
              <Link to="/tarifs" className="flex flex-col items-center justify-center gap-1 h-full tap-scale" />
            }
          />

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

          <button
            onClick={goEspace}
            className="flex flex-col items-center justify-center gap-1 h-full tap-scale"
            aria-label="Mon espace"
          >
            <User
              size={20}
              className={isAuthenticated || location.pathname.includes("dashboard") || location.pathname.includes("/admin") || location.pathname.includes("/convoyeur") ? "text-primary" : "text-cream/55"}
            />
            <span
              className={`text-[10px] tracking-[0.1em] uppercase ${
                isAuthenticated ? "text-primary" : "text-cream/55"
              }`}
            >
              {isAuthenticated ? "Espace" : "Connexion"}
            </span>
          </button>
        </div>
      </nav>

      <ReservationModal open={reserveOpen} onClose={() => setReserveOpen(false)} />
    </>
  );
}

function NavTab({
  label,
  icon,
  active,
  as,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  as: React.ReactElement;
}) {
  const className = `${active ? "text-primary" : "text-cream/55"}`;
  // Clone the link with content
  return (
    <as.type {...as.props}>
      <span className={className}>{icon}</span>
      <span className={`text-[10px] tracking-[0.1em] uppercase ${className}`}>{label}</span>
    </as.type>
  );
}
