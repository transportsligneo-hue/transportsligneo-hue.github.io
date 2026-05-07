import { useState, useEffect } from "react";
import { Menu, X, User, Sparkles } from "lucide-react";
import { Link, useNavigate, useLocation } from "@tanstack/react-router";
import logoLigneo from "@/assets/logo-transports-ligneo-officiel.png";
import { useAuth } from "@/hooks/useAuth";

const navLinks = [
  { to: "/", label: "Accueil" },
  { to: "/services", label: "Services" },
  { to: "/tarifs", label: "Tarifs" },
  { to: "/comment-ca-marche", label: "Comment ça marche" },
  { to: "/pro", label: "B2B" },
  { to: "/a-propos", label: "À propos" },
  { to: "/contact", label: "Contact" },
] as const;

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isAuthenticated, role } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // CTA principal : Estimer (scrolle vers #devis si on est sur l'accueil, sinon → /tarifs)
  const goToEstimer = () => {
    setMobileOpen(false);
    if (location.pathname === "/") {
      const el = document.getElementById("devis");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
    }
    navigate({ to: "/tarifs", hash: "devis" });
  };

  const goToEspace = () => {
    setMobileOpen(false);
    if (!isAuthenticated) return navigate({ to: "/login" });
    if (role === "admin") navigate({ to: "/admin" });
    else if (role === "convoyeur") navigate({ to: "/convoyeur" });
    else navigate({ to: "/dashboard-client" });
  };

  return (
    <>
      <nav
        className={`hidden md:block fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled
            ? "bg-navy/95 backdrop-blur-md shadow-lg shadow-black/30"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-6xl mx-auto pl-10 pr-6 py-3 flex items-center justify-between gap-10">
          <Link to="/" className="flex items-center gap-3 mr-6" aria-label="Accueil — Transports Ligneo">
            <img
              src={logoLigneo}
              alt="Transports Ligneo"
              className="h-12 md:h-14 w-auto object-contain"
              loading="eager"
            />
          </Link>

          {/* Desktop */}
          <ul className="flex gap-8 items-center">
            {navLinks.map((l) => (
              <li key={l.to}>
                <Link
                  to={l.to}
                  activeOptions={{ exact: true }}
                  activeProps={{ className: "text-primary" }}
                  className="text-sm tracking-[0.15em] uppercase text-cream/80 hover:text-primary transition-colors duration-300"
                >
                  {l.label}
                </Link>
              </li>
            ))}
            <li>
              <button
                onClick={goToEstimer}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs tracking-[0.15em] uppercase font-medium edl-cta"
              >
                <Sparkles size={14} />
                Estimer
              </button>
            </li>
            <li>
              <button
                onClick={goToEspace}
                className="inline-flex items-center gap-2 px-4 py-2 border border-primary/60 text-primary text-xs tracking-[0.15em] uppercase font-medium hover:bg-primary hover:text-navy transition-colors"
              >
                <User size={14} />
                {isAuthenticated ? "Mon espace" : "Connexion"}
              </button>
            </li>
          </ul>

          {/* Mobile toggle */}
          <button
            className="md:hidden text-primary"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Menu"
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden bg-navy/98 backdrop-blur-md border-t border-primary/20 pb-6">
            <ul className="flex flex-col items-center gap-6 pt-6">
              {navLinks.map((l) => (
                <li key={l.to}>
                  <Link
                    to={l.to}
                    onClick={() => setMobileOpen(false)}
                    activeOptions={{ exact: true }}
                    activeProps={{ className: "text-primary" }}
                    className="text-sm tracking-[0.15em] uppercase text-cream/80 hover:text-primary transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
              <li>
                <button
                  onClick={goToEstimer}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs tracking-[0.15em] uppercase font-medium edl-cta"
                >
                  <Sparkles size={14} />
                  Estimer
                </button>
              </li>
              <li>
                <button
                  onClick={goToEspace}
                  className="inline-flex items-center gap-2 px-6 py-2.5 border border-primary/60 text-primary text-xs tracking-[0.15em] uppercase font-medium"
                >
                  <User size={14} />
                  {isAuthenticated ? "Mon espace" : "Connexion"}
                </button>
              </li>
            </ul>
          </div>
        )}
      </nav>
    </>
  );
}
