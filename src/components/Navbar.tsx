import { useState, useEffect } from "react";
import { Menu, X, User, Sparkles, Phone } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import logoLigneo from "@/assets/logo-transports-ligneo-officiel.png";
import { useAuth } from "@/hooks/useAuth";
import { scrollToDevis } from "@/lib/scroll-to-devis";

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
  

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // CTA principal : Estimer · scrolle vers l'estimateur (centré) si présent, sinon → /tarifs
  const goToEstimer = () => {
    setMobileOpen(false);
    if (scrollToDevis()) return;
    navigate({ to: "/tarifs", hash: "devis" });
  };

  const goToEspace = () => {
    setMobileOpen(false);
    if (!isAuthenticated) return navigate({ to: "/login" });
    if (role === "admin" || role === "super_admin") navigate({ to: "/admin" });
    else if (role === "convoyeur") navigate({ to: "/convoyeur" });
    else navigate({ to: "/dashboard-client" });
  };

  return (
    <>
      <nav
        className={`hidden md:block fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled ? "r4-topbar" : "bg-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto pl-10 pr-6 py-3 flex items-center justify-between gap-8">
          <Link to="/" className="flex items-center gap-3 mr-2 shrink-0" aria-label="Accueil · Transports Ligneo">
            <img
              src={logoLigneo}
              alt="Transports Ligneo"
              className="h-14 md:h-16 w-auto object-contain"
              loading="eager"
            />
          </Link>

          {/* Liens centraux · pilule englobante */}
          <ul className="r4-nav-pill whitespace-nowrap">
            {navLinks.map((l) => (
              <li key={l.to}>
                <Link
                  to={l.to}
                  activeOptions={{ exact: true }}
                  activeProps={{ className: "r4-nav-link is-active whitespace-nowrap" }}
                  inactiveProps={{ className: "r4-nav-link whitespace-nowrap" }}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>

          {/* Actions droite : téléphone + Estimer + Connexion */}
          <div className="flex items-center gap-3 shrink-0">
            <a
              href="tel:+33782456181"
              className="nav-phone-block hidden xl:inline-flex"
              aria-label="Appeler Transports Ligneo · 07 82 45 61 81"
            >
              <span className="nav-phone-icon">
                <Phone size={15} strokeWidth={2.25} />
              </span>
              <span className="flex flex-col items-start">
                <span className="nav-phone-number">07 82 45 61 81</span>
                <span className="nav-phone-sub">Disponible 7j/7</span>
              </span>
            </a>
            <button onClick={goToEstimer} className="r4-btn-estimer" type="button">
              <svg className="r4-ic-bolt" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" />
              </svg>
              Estimer mon trajet
              <svg className="r4-ic-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
            <button onClick={goToEspace} className="r4-btn-connect" type="button">
              <User size={13} />
              {isAuthenticated ? "Mon espace" : "Connexion"}
            </button>
          </div>
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
                <button onClick={goToEstimer} className="r4-btn-estimer" type="button">
                  <Sparkles size={13} />
                  Estimer
                </button>
              </li>
              <li>
                <button onClick={goToEspace} className="r4-btn-connect" type="button">
                  <User size={13} />
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

