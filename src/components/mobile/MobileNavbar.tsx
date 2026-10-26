import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Menu, Phone, User, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { logoLigneoSeasonal as logoLigneo } from "@/lib/seasonal-logo";
import logoDriver from "@/assets/logo-driver.png.asset.json";
import ThemePreference from "@/components/ThemePreference";
import OctobreRoseBadge from "@/components/marketing/OctobreRoseBadge";
import { Button } from "@/components/ui/button";
import StoriesButton from "@/components/mobile/stories/StoriesViewer";
import "@/styles/mobile-home-v2.css";

type NavAccent = "b2b" | undefined;
const links: ReadonlyArray<{ to: string; label: string; accent?: NavAccent; search?: { audience: "pro" | "particuliers" } }> = [
  { to: "/services", label: "Particuliers", search: { audience: "particuliers" } },
  { to: "/services", label: "Professionnels", search: { audience: "pro" }, accent: "b2b" },
  { to: "/comment-ca-marche", label: "Comment ça marche" },
  { to: "/tarifs", label: "Tarifs" },
  { to: "/a-propos", label: "À propos" },
  { to: "/remarketing", label: "Ligneo Remarketing" },
  { to: "/suivi", label: "Suivre mon véhicule" },
] as const;

const HIDDEN_PREFIXES = [
  "/convoyeur", "/admin", "/dashboard-", "/entreprise", "/flotte",
  "/attente-validation", "/login", "/inscription", "/choisir-compte",
  "/mot-de-passe-oublie", "/reset-password", "/scan",
];

export default function MobileNavbar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { isAuthenticated, role } = useAuth();
  const goEspace = () => {
    setOpen(false);
    if (!isAuthenticated) return navigate({ to: "/login" });
    if (role === "admin" || role === "super_admin") return navigate({ to: "/admin" });
    if (role === "convoyeur") return navigate({ to: "/convoyeur" });
    return navigate({ to: "/dashboard-client" });
  };
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onEscape);
    return () => { document.body.style.overflow = previous; document.removeEventListener("keydown", onEscape); };
  }, [open]);

  if (HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) return null;

  return (
    <header className="xl:hidden fixed top-0 left-0 right-0 z-[55] safe-top">
      <div className="mnav-bar r4-topbar-mobile">
        <div className="grid h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 sm:px-4">
          <Link to="/" className="flex min-w-0 items-center gap-2 overflow-hidden" aria-label="Transports Ligneo · Accueil">
            <img src={pathname === "/devenir-convoyeur" ? logoDriver.url : logoLigneo()} alt="" className="mh2-logo" />
            <span className="min-w-0 flex flex-col gap-[3px]">
              <span className="mnav-wordmark mh2-word truncate">
                TRANSPORTS <span>LIGNEO</span>
              </span>
              <span className="w-fit"><OctobreRoseBadge compact /></span>
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <StoriesButton />
            <Link to="/contact" className="mh2-phone md:hidden" aria-label="Contacter Transports Ligneo">
              <Phone size={17} strokeWidth={2.3} />
            </Link>
            <div className="hidden md:block"><ThemePreference variant="compact" /></div>
            <Button type="button" variant="ghost" size="icon" className="mnav-menu-trigger md:hidden" aria-label={open ? "Fermer le menu" : "Ouvrir le menu"} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
              {open ? <X /> : <Menu />}
            </Button>
          </div>
        </div>
        <nav className="hidden md:block px-3 pb-2" aria-label="Navigation du site">
          <ul className="r4-nav-pill mnav-pill no-scrollbar">
            {links.map((link) => <li key={`${link.to}-${link.search?.audience ?? ""}`}>
              <Link to={link.to} search={link.search} activeOptions={{ exact: true, includeSearch: true }}
                activeProps={{ className: `r4-nav-link is-active whitespace-nowrap${link.accent === "b2b" ? " nav-accent-purple" : ""}` }}
                inactiveProps={{ className: `r4-nav-link whitespace-nowrap${link.accent === "b2b" ? " nav-accent-purple" : ""}` }}>
                {link.label}
              </Link>
            </li>)}
          </ul>
        </nav>
      </div>
      {open && <div className="md:hidden fixed inset-0 top-14 z-[-1] mnav-scrim" onClick={() => setOpen(false)} aria-hidden="true" />}
      <nav className={`md:hidden mnav-sheet${open ? " is-open" : ""}`} aria-label="Menu du site" aria-hidden={!open}>
        {links.map((link) => <Link key={`${link.to}-${link.search?.audience ?? ""}`} to={link.to} search={link.search} tabIndex={open ? 0 : -1}
          className={`mnav-sheet-link${link.accent === "b2b" ? " is-pro" : ""}`} onClick={() => setOpen(false)}>
          {link.label}
        </Link>)}
        <button type="button" tabIndex={open ? 0 : -1} onClick={goEspace} className="mnav-sheet-link flex items-center gap-2">
          <User size={16} /> {isAuthenticated ? "Mon espace" : "Connexion"}
        </button>
        <ThemePreference variant="full" />
      </nav>
    </header>
  );
}
