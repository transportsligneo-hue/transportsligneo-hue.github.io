import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Home, Truck, User, Sparkles } from "lucide-react";
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
  const colorOn = "text-[#60a5fa]";
  const colorOff = "text-white/50";

  return (
    <nav
      aria-label="Navigation principale"
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 px-3 pb-3 pt-2 safe-bottom pointer-events-none"
    >
      <div
        className="pointer-events-auto relative rounded-[28px] border border-white/[0.08] backdrop-blur-2xl"
        style={{
          background:
            "linear-gradient(180deg, rgba(10,22,56,0.85) 0%, rgba(5,11,29,0.9) 100%)",
          boxShadow:
            "0 20px 50px -20px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04) inset",
        }}
      >
        <div className="grid grid-cols-4 h-16 items-stretch">
          <Link to="/" className={tabBase}>
            <Home size={20} className={isHome ? colorOn : colorOff} strokeWidth={2} />
            <span className={`text-[10px] tracking-[0.08em] font-heading font-bold ${isHome ? colorOn : colorOff}`}>
              Accueil
            </span>
          </Link>

          <Link to="/tarifs" className={tabBase}>
            <Tag size={20} className={isTarifs ? colorOn : colorOff} strokeWidth={2} />
            <span className={`text-[10px] tracking-[0.08em] font-heading font-bold ${isTarifs ? colorOn : colorOff}`}>
              Tarifs
            </span>
          </Link>

          {/* CTA Estimer — centré, surélevé, halo bleu */}
          <button
            onClick={goEstimer}
            className="relative flex flex-col items-center justify-center gap-1 h-full tap-scale"
            aria-label="Estimer mon trajet"
          >
            <span
              aria-hidden
              className="absolute -top-8 w-16 h-16 rounded-full blur-2xl bg-[#3b82f6]/60 pointer-events-none"
            />
            <span
              className="absolute -top-6 w-14 h-14 rounded-full text-white flex items-center justify-center border border-white/20"
              style={{
                background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
                boxShadow:
                  "0 12px 30px -6px rgba(59,130,246,0.75), inset 0 1px 0 rgba(255,255,255,0.3)",
              }}
            >
              <Sparkles size={22} strokeWidth={2} />
            </span>
            <span className="mt-8 text-[10px] tracking-[0.08em] font-heading font-bold text-[#60a5fa]">
              Estimer
            </span>
          </button>

          <button onClick={goEspace} className={tabBase} aria-label="Mon espace">
            <User size={20} className={isEspace ? colorOn : colorOff} strokeWidth={2} />
            <span className={`text-[10px] tracking-[0.08em] font-heading font-bold ${isEspace ? colorOn : colorOff}`}>
              {isAuthenticated ? "Espace" : "Connexion"}
            </span>
          </button>
        </div>
      </div>
    </nav>
  );
}
