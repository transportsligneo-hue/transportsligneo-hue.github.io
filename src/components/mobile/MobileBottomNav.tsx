import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Home, Tag, User, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { scrollToDevis } from "@/lib/scroll-to-devis";

/**
 * Bottom navigation publique (mobile uniquement).
 * 4 onglets : Accueil · Tarifs · Estimer (CTA centré, scrolle vers #devis) · Mon espace.
 */
export default function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, role } = useAuth();

  // Ne pas afficher la nav publique sur les espaces authentifiés
  const inDashboard =
    location.pathname.startsWith("/dashboard-client") ||
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
  const isTarifs = location.pathname.startsWith("/tarifs");
  const isEspace =
    isAuthenticated ||
    location.pathname.startsWith("/dashboard-client") ||
    location.pathname.startsWith("/admin") ||
    location.pathname.startsWith("/convoyeur") ||
    location.pathname.startsWith("/login");

  const tabBase = "flex flex-col items-center justify-center gap-1 h-full tap-scale";
  const colorOn = "text-[#5fb6ff]";
  const colorOff = "text-cream/55";

  return (
    <nav
      aria-label="Navigation principale"
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass-bar border-t border-[rgba(95,182,255,0.20)] safe-bottom"
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

        {/* CTA Estimer — centré, surélevé */}
        <button
          onClick={goEstimer}
          className="relative flex flex-col items-center justify-center gap-1 h-full tap-scale"
          aria-label="Estimer mon trajet"
        >
          <span
            className="absolute -top-5 w-12 h-12 rounded-full text-white flex items-center justify-center border-2 border-[#0a1335]"
            style={{
              background: "linear-gradient(135deg, #2c6bff 0%, #5fb6ff 100%)",
              boxShadow: "0 10px 28px -6px rgba(44,107,255,0.65)",
            }}
          >
            <Sparkles size={20} />
          </span>
          <span className="mt-7 text-[10px] tracking-[0.15em] uppercase font-heading text-[#5fb6ff]">
            Estimer
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
  );
}
