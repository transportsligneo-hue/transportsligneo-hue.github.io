import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { User, Phone } from "lucide-react";
import logoLigneo from "@/assets/logo-transports-ligneo-officiel.png";
import { useAuth } from "@/hooks/useAuth";
import ThemePreference from "@/components/ThemePreference";

type NavAccent = "b2b" | "driver" | undefined;
const links: ReadonlyArray<{ to: string; label: string; accent?: NavAccent }> = [
  { to: "/", label: "Accueil" },
  { to: "/services", label: "Nos services" },
  { to: "/tarifs", label: "Tarifs" },
  { to: "/comment-ca-marche", label: "Process" },
  { to: "/suivi", label: "Suivi" },
  { to: "/actualites", label: "Actualités" },
  { to: "/a-propos", label: "À propos" },
  { to: "/contact", label: "Contact" },
] as const;

const SteeringIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <rect x="3" y="11" width="18" height="7" rx="2" />
    <path d="M5 11V8a7 7 0 0 1 14 0v3" />
    <circle cx="8" cy="14.5" r="1" />
    <circle cx="16" cy="14.5" r="1" />
  </svg>
);


const HIDDEN_PREFIXES = [
  "/convoyeur",
  "/admin",
  "/dashboard-",
  "/entreprise",
  "/flotte",
  "/attente-validation",
  "/login",
  "/inscription",
  "/choisir-compte",
  "/mot-de-passe-oublie",
  "/reset-password",
  "/scan",
];

export default function MobileNavbar() {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);
  const { isAuthenticated, role } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    lastY.current = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastY.current;
      if (y < 50) setHidden(false);
      else if (delta > 8) setHidden(true);
      else if (delta < -8) setHidden(false);
      lastY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return null;
  }

  const goEspace = () => {
    if (!isAuthenticated) return navigate({ to: "/login" });
    if (role === "admin" || role === "super_admin") navigate({ to: "/admin" });
    else if (role === "convoyeur") navigate({ to: "/convoyeur" });
    else navigate({ to: "/dashboard-client" });
  };

  return (
    <header
      className={`2xl:hidden fixed top-0 left-0 right-0 z-[55] safe-top transition-transform duration-300 ease-out ${
        hidden ? "-translate-y-full" : "translate-y-0"
      }`}
    >
      <div className="mnav-bar r4-topbar-mobile">
        <div className="grid h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 sm:px-4">
          <Link to="/" className="flex min-w-0 items-center gap-2.5 sm:gap-3 overflow-visible">
            <img src={logoLigneo} alt="Transports Ligneo" className="h-9 w-9 sm:h-11 sm:w-11 shrink-0 object-contain" />
            <span
              className="font-black text-[15px] sm:text-[17px] tracking-[0.02em] uppercase text-white whitespace-nowrap"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              TRANSPORTS{" "}
              <span className="text-[#6ea1ff] [text-shadow:0_0_12px_rgba(91,143,255,0.85)]">LIGNEO</span>
            </span>
          </Link>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <a
              href="tel:+33782456181"
              className="nav-phone-block mnav-phone-compact"
              aria-label="Appeler Transports Ligneo · 07 82 45 61 81"
            >
              <span className="nav-phone-icon">
                <Phone size={13} strokeWidth={2.4} />
                <span className="nav-phone-pulse" aria-hidden="true" />
                <span className="nav-phone-pulse nav-phone-pulse-delay" aria-hidden="true" />
              </span>
              <span className="mnav-phone-label">Appeler</span>
            </a>
            <ThemePreference variant="compact" />


          </div>
        </div>
        <nav className="px-3 pb-2">
          <ul className="r4-nav-pill mnav-pill no-scrollbar">
            {links.map((l) => {
              const accent =
                l.accent === "b2b" ? " nav-accent-purple" : l.accent === "driver" ? " nav-accent-green" : "";
              return (
                <li key={l.to}>
                  <Link
                    to={l.to}
                    activeOptions={{ exact: true }}
                    activeProps={{ className: `r4-nav-link is-active whitespace-nowrap${accent}` }}
                    inactiveProps={{ className: `r4-nav-link whitespace-nowrap${accent}` }}
                  >
                    {l.accent === "driver" && <SteeringIcon />}
                    {l.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

      </div>
    </header>
  );
}
