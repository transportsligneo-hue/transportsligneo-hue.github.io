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

  // CTA principal : Estimer — scrolle vers l'estimateur (centré) si présent, sinon → /tarifs
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
          scrolled
            ? "bg-navy/95 backdrop-blur-md navbar-hairline"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto pl-10 pr-6 py-4 flex items-center justify-between gap-8">
          <Link to="/" className="flex items-center gap-3 mr-4 shrink-0" aria-label="Accueil — Transports Ligneo">
            <img
              src={logoLigneo}
              alt="Transports Ligneo"
              className="h-12 md:h-14 w-auto object-contain"
              loading="eager"
            />
          </Link>

          {/* Liens centraux */}
          <ul className="flex gap-7 items-center">
            {navLinks.map((l) => (
              <li key={l.to}>
                <Link
                  to={l.to}
                  activeOptions={{ exact: true }}
                  activeProps={{ className: "text-primary" }}
                  className="text-[11px] font-medium tracking-[0.22em] uppercase text-cream/75 hover:text-primary transition-colors duration-300"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>

          {/* Actions droite : téléphone premium + CTAs */}
          <div className="flex items-center gap-3 shrink-0">
            <a
              href="tel:+33782456181"
              className="nav-phone-block hidden xl:inline-flex"
              aria-label="Appeler Transports Ligneo — 07 82 45 61 81"
            >
              <span className="nav-phone-icon">
                <Phone size={15} strokeWidth={2.25} />
              </span>
              <span className="flex flex-col items-start">
                <span className="nav-phone-number">07 82 45 61 81</span>
                <span className="nav-phone-sub">Disponible 7j/7</span>
              </span>
            </a>
            <button
              onClick={goToEstimer}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-[11px] tracking-[0.22em] uppercase font-heading edl-cta"
            >
              <Sparkles size={13} />
              Estimer
            </button>
            <button
              onClick={goToEspace}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-primary/55 text-primary text-[11px] tracking-[0.22em] uppercase font-heading hover:bg-primary hover:text-navy transition-colors"
            >
              <User size={13} />
              {isAuthenticated ? "Mon espace" : "Connexion"}
            </button>
          </div>
        </div>

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
