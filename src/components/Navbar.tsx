import { useState, useEffect } from "react";
import { Menu, X, User, Sparkles, Phone } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import logoLigneo from "@/assets/logo-transports-ligneo-officiel.png";
import { useAuth } from "@/hooks/useAuth";
import { scrollToDevis } from "@/lib/scroll-to-devis";

type NavAccent = "purple" | "green" | undefined;
const navLinks: ReadonlyArray<{ to: string; label: string; accent?: NavAccent }> = [
  { to: "/", label: "Accueil" },
  { to: "/services", label: "Services" },
  { to: "/tarifs", label: "Tarifs" },
  { to: "/comment-ca-marche", label: "Comment ça marche" },
  { to: "/pro", label: "B2B", accent: "purple" },
  { to: "/devenir-convoyeur", label: "Espace Driver", accent: "green" },
  { to: "/a-propos", label: "À propos" },
  { to: "/contact", label: "Contact" },
] as const;

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}


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
        className={`hidden 2xl:block fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled ? "r4-topbar" : "bg-transparent"
        }`}
      >
        <div className="w-full px-5 py-2.5 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2.5 shrink-0" aria-label="Accueil · Transports Ligneo">
            <div
              className="h-11 w-11 overflow-hidden rounded-xl shrink-0"
              style={{ boxShadow: "0 0 0 1px rgba(122,163,255,0.4), 0 0 16px rgba(63,123,255,0.35)" }}
            >
              <img src={logoLigneo} alt="Transports Ligneo" className="h-full w-full object-cover" loading="eager" />
            </div>
            <span
              className="font-heading text-[15px] font-extrabold tracking-[0.03em] text-white whitespace-nowrap"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              TRANSPORTS <span className="text-[#6ea1ff] [text-shadow:0_0_10px_rgba(91,143,255,0.7)]">LIGNEO</span>
            </span>
          </Link>

          {/* Liens centraux · pilule englobante */}
          <ul className="r4-nav-pill whitespace-nowrap mx-auto">
            {navLinks.map((l) => {
              const accentClass = l.accent === "purple" ? " nav-accent-purple" : l.accent === "green" ? " nav-accent-green" : "";
              return (
                <li key={l.to}>
                  <Link
                    to={l.to}
                    activeOptions={{ exact: true }}
                    activeProps={{ className: `r4-nav-link is-active whitespace-nowrap${accentClass}` }}
                    inactiveProps={{ className: `r4-nav-link whitespace-nowrap${accentClass}` }}
                  >
                    {l.accent === "green" && <LockIcon />}
                    {l.label}
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Actions droite : téléphone + Connexion */}
          <div className="flex items-center gap-2.5 shrink-0">
            <a
              href="tel:+33782456181"
              className="nav-phone-block hidden xl:inline-flex"
              aria-label="Appeler Transports Ligneo · 07 82 45 61 81"
            >
              <span className="nav-phone-icon">
                <Phone size={15} strokeWidth={2.25} />
                <span className="nav-phone-pulse" aria-hidden="true" />
              </span>
              <span className="flex flex-col items-start">
                <span className="nav-phone-number">07 82 45 61 81</span>
                <span className="nav-phone-sub">
                  <span className="nav-phone-live" aria-hidden="true" />
                  Disponible 7j/7
                </span>
              </span>
            </a>
            <button onClick={goToEspace} className="r4-btn-connect" type="button">
              <User size={13} />
              {isAuthenticated ? "Mon espace" : "Connexion"}
            </button>
          </div>
        </div>

        {/* Menu compact */}
        {mobileOpen && (
          <div className="2xl:hidden bg-navy/98 backdrop-blur-md border-t border-primary/20 pb-6">
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
                <a
                  href="tel:+33782456181"
                  className="nav-phone-block"
                  aria-label="Appeler Transports Ligneo · 07 82 45 61 81"
                >
                  <span className="nav-phone-icon">
                    <Phone size={15} strokeWidth={2.25} />
                    <span className="nav-phone-pulse" aria-hidden="true" />
                  </span>
                  <span className="flex flex-col items-start">
                    <span className="nav-phone-number">07 82 45 61 81</span>
                    <span className="nav-phone-sub">
                      <span className="nav-phone-live" aria-hidden="true" />
                      Disponible 7j/7
                    </span>
                  </span>
                </a>
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

