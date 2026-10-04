import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, Phone, X } from "lucide-react";
import { useEffect, useState } from "react";
import logoLigneo from "@/assets/logo-transports-ligneo-officiel.png";
import ThemePreference from "@/components/ThemePreference";
import OctobreRoseBadge from "@/components/marketing/OctobreRoseBadge";
import { Button } from "@/components/ui/button";

type NavAccent = "b2b" | undefined;
const links: ReadonlyArray<{ to: string; label: string; accent?: NavAccent; search?: { audience: "pro" | "particuliers" } }> = [
  { to: "/services", label: "Particuliers", search: { audience: "particuliers" } },
  { to: "/services", label: "Professionnels", search: { audience: "pro" }, accent: "b2b" },
  { to: "/comment-ca-marche", label: "Comment ça marche" },
  { to: "/tarifs", label: "Tarifs" },
  { to: "/a-propos", label: "À propos" },
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
            <img src={logoLigneo} alt="" className="h-9 w-9 sm:h-11 sm:w-11 shrink-0 object-contain" />
            <span className="mnav-wordmark truncate font-black text-[15px] sm:text-[17px] uppercase">
              TRANSPORTS <span>LIGNEO</span>
            </span>
            <OctobreRoseBadge compact />
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <a href="tel:+33782456181" className="nav-phone-block mnav-phone-compact md:hidden" aria-label="Appeler Transports Ligneo au 07 82 45 61 81">
              <span className="nav-phone-icon"><Phone size={13} strokeWidth={2.4} /></span>
              <span className="mnav-phone-label">Appeler</span>
            </a>
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
        <ThemePreference variant="full" />
      </nav>
    </header>
  );
}
