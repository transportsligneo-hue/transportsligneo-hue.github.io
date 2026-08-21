import { useState, useEffect } from "react";
import { Menu, X, User, Sparkles, Phone } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import LigneoLockup from "@/components/brand/LigneoLockup";
import { useAuth } from "@/hooks/useAuth";
import { scrollToDevis } from "@/lib/scroll-to-devis";
import ThemeToggle from "@/components/ThemeToggle";

type NavAccent = "purple" | "green" | undefined;
const navLinks: ReadonlyArray<{ to: string; label: string; accent?: NavAccent; search?: Record<string, unknown> }> = [
  { to: "/", label: "Accueil" },
  { to: "/services", label: "Services" },
  { to: "/tarifs", label: "Tarifs" },
  { to: "/comment-ca-marche", label: "Comment ça marche" },
  { to: "/suivi", label: "Suivi" },
  { to: "/services", label: "Professionnels", search: { audience: "pro" }, accent: "purple" },
  { to: "/actualites", label: "Actualités" },
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
        className={`hidden 2xl:block fixed top-0 left-0 right-0 z-50 tln-shell ${
          scrolled ? "is-scrolled" : ""
        }`}
      >
        <div className="tln-bar">
          <span className="tln-sheen" aria-hidden="true" />

          <div className="tln-bar-inner">
            <Link to="/" className="tln-brand" aria-label="Accueil · Transports Ligneo">
              <LigneoLockup size="md" />
            </Link>

            <span className="tln-sep" aria-hidden="true" />

            <ul className="tln-links">
              {navLinks.map((l) => {
                const accentClass = l.accent === "purple" ? " nav-accent-purple" : l.accent === "green" ? " nav-accent-green" : "";
                return (
                  <li key={`${l.to}-${l.search?.audience ?? ""}`}>
                    <Link
                      to={l.to}
                      search={l.search}
                      activeOptions={{ exact: l.search ? false : true }}
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

            <span className="tln-sep" aria-hidden="true" />

            <div className="tln-actions">
              <a
                href="tel:+33782456181"
                className="nav-phone-block tln-phone"
                aria-label="Appeler Transports Ligneo · 07 82 45 61 81"
              >
                <span className="nav-phone-icon">
                  <Phone size={15} strokeWidth={2.25} />
                  <span className="nav-phone-pulse" aria-hidden="true" />
                </span>
                <span className="flex flex-col items-start">
                  <span className="nav-phone-number">Besoin d'un conseil ?</span>
                  <span className="nav-phone-sub">
                    <span className="nav-phone-live" aria-hidden="true" />
                    07 82 45 61 81 · 7j/7
                  </span>
                </span>
              </a>
              <ThemeToggle />
              <button onClick={goToEspace} className="r4-btn-connect tln-connect" type="button">
                <User size={13} />
                {isAuthenticated ? "Mon espace" : "Connexion"}
              </button>
            </div>
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
                    <span className="nav-phone-number">Besoin d'un conseil ?</span>
                    <span className="nav-phone-sub">
                      <span className="nav-phone-live" aria-hidden="true" />
                      07 82 45 61 81 · 7j/7
                    </span>
                  </span>
                </a>
              </li>
              <li>
                <ThemeToggle variant="full" />
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

