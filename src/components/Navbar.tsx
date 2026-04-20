import { useState, useEffect } from "react";
import { Menu, X, User } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import logoLigneo from "@/assets/logo-ligneo.png";
import ReservationModal from "./ReservationModal";
import { useAuth } from "@/hooks/useAuth";

const navLinks = [
  { to: "/", label: "Accueil" },
  { to: "/services", label: "Services" },
  { to: "/tarifs", label: "Tarifs" },
  { to: "/comment-ca-marche", label: "Comment ça marche" },
  { to: "/a-propos", label: "À propos" },
  { to: "/contact", label: "Contact" },
] as const;

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [reserveOpen, setReserveOpen] = useState(false);
  const { isAuthenticated, role } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const openReserve = () => {
    setMobileOpen(false);
    setReserveOpen(true);
  };

  const goToEspace = () => {
    setMobileOpen(false);
    if (role === "admin") navigate({ to: "/admin" });
    else if (role === "convoyeur") navigate({ to: "/convoyeur" });
    else navigate({ to: "/" });
  };

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled
            ? "bg-navy/95 backdrop-blur-md shadow-lg shadow-black/30"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link to="/">
            <img
              src={logoLigneo}
              alt="Transports Ligneo"
              className="h-10 md:h-12 w-auto"
            />
          </Link>

          {/* Desktop */}
          <ul className="hidden md:flex gap-8 items-center">
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
                onClick={openReserve}
                className="px-5 py-2 bg-primary text-navy text-xs tracking-[0.15em] uppercase font-medium hover:bg-primary/90 transition-colors"
              >
                Réserver
              </button>
            </li>
            {isAuthenticated && (
              <li>
                <button
                  onClick={goToEspace}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-primary/60 text-primary text-xs tracking-[0.15em] uppercase font-medium hover:bg-primary hover:text-navy transition-colors"
                >
                  <User size={14} />
                  Mon espace
                </button>
              </li>
            )}
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
                  onClick={openReserve}
                  className="px-6 py-2.5 bg-primary text-navy text-xs tracking-[0.15em] uppercase font-medium"
                >
                  Réserver
                </button>
              </li>
              {isAuthenticated && (
                <li>
                  <button
                    onClick={goToEspace}
                    className="inline-flex items-center gap-2 px-6 py-2.5 border border-primary/60 text-primary text-xs tracking-[0.15em] uppercase font-medium"
                  >
                    <User size={14} />
                    Mon espace
                  </button>
                </li>
              )}
            </ul>
          </div>
        )}
      </nav>

      <ReservationModal open={reserveOpen} onClose={() => setReserveOpen(false)} />
    </>
  );
}
