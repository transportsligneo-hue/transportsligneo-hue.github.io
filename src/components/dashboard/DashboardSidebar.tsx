import { Link, useLocation } from "@tanstack/react-router";
import { LogOut, X, MoreHorizontal, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";

export interface SidebarItem {
  to: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  badge?: ReactNode;
}

interface Props {
  title: string;
  subtitle?: string;
  items: SidebarItem[];
  /** Contenu rendu dans le main */
  children: ReactNode;
}

/**
 * Layout dashboard :
 * - Desktop : sidebar gauche fixe (inchangée).
 * - Mobile : header compact sticky + bottom nav app-like (4 onglets visibles + "Plus" si > 4),
 *   les items "Plus" s'ouvrent dans une bottom sheet.
 */
export function DashboardSidebar({ title, subtitle, items, children }: Props) {
  const location = useLocation();
  const { logout } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const [desktopMenuOpen, setDesktopMenuOpen] = useState(false);

  // Mobile : 4 premiers items en bottom nav, le reste dans "Plus"
  const primary = items.slice(0, 4);
  const overflow = items.slice(4);
  const showMoreTab = overflow.length > 0;
  const visibleCount = showMoreTab ? Math.min(primary.length, 3) : primary.length;
  const visibleItems = showMoreTab ? items.slice(0, visibleCount) : primary;
  const remainingItems = showMoreTab ? items.slice(visibleCount) : [];
  const gridCols = showMoreTab ? visibleItems.length + 1 : visibleItems.length;

  const isActive = (item: SidebarItem) =>
    item.exact
      ? location.pathname === item.to
      : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);

  return (
    <div className="min-h-screen flex section-bg">
      {/* === MOBILE HEADER (compact, sticky) === */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 glass-bar border-b border-primary/15 safe-top">
        <div className="h-14 px-4 flex items-center justify-between">
          <div className="min-w-0">
            <p className="font-heading text-primary text-sm tracking-[0.15em] uppercase truncate">
              {title}
            </p>
            {subtitle && <p className="text-cream/40 text-[10px] truncate">{subtitle}</p>}
          </div>
          <button
            onClick={() => logout()}
            className="w-9 h-9 rounded-full border border-primary/30 flex items-center justify-center tap-scale text-cream/60 hover:text-destructive transition-colors"
            aria-label="Déconnexion"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* === DESKTOP SIDEBAR (inchangée, drawer en mobile retiré) === */}
      <aside
        className={`hidden md:flex fixed md:static inset-y-0 left-0 z-40 w-64 bg-navy/85 border-r border-primary/20 flex-col transition-transform duration-300 ${
          desktopMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="p-6 border-b border-primary/15 hidden md:block">
          <h2 className="font-heading text-primary text-lg tracking-[0.1em] uppercase">{title}</h2>
          {subtitle && <p className="text-cream/40 text-xs mt-1">{subtitle}</p>}
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {items.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setDesktopMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded text-sm transition-all ${
                  active
                    ? "bg-primary/15 text-primary border border-primary/30 shadow-[0_0_15px_rgba(212,175,55,0.1)]"
                    : "text-cream/60 hover:text-primary hover:bg-primary/5 border border-transparent"
                }`}
              >
                <item.icon size={17} />
                <span className="flex-1">{item.label}</span>
                {item.badge}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-primary/15">
          <button
            onClick={() => logout()}
            className="flex items-center gap-3 px-4 py-2.5 rounded text-sm text-cream/60 hover:text-destructive hover:bg-destructive/10 transition-colors w-full"
          >
            <LogOut size={17} />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* === MAIN === */}
      <main className="flex-1 overflow-auto pt-14 md:pt-0 pb-bottom-nav md:pb-0">
        <div className="p-4 md:p-8 max-w-6xl mx-auto">{children}</div>
      </main>

      {/* === MOBILE BOTTOM NAV (dashboard) === */}
      <nav
        aria-label="Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass-bar border-t border-primary/15 safe-bottom"
      >
        <div
          className="grid h-16 items-stretch"
          style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}
        >
          {visibleItems.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.to}
                to={item.to}
                className="flex flex-col items-center justify-center gap-1 h-full tap-scale"
              >
                <item.icon size={19} className={active ? "text-primary" : "text-cream/55"} />
                <span
                  className={`text-[10px] tracking-[0.05em] uppercase truncate max-w-[72px] ${
                    active ? "text-primary" : "text-cream/55"
                  }`}
                >
                  {shortLabel(item.label)}
                </span>
              </Link>
            );
          })}
          {showMoreTab && (
            <button
              onClick={() => setMoreOpen(true)}
              className="flex flex-col items-center justify-center gap-1 h-full tap-scale"
              aria-label="Plus"
            >
              <MoreHorizontal
                size={19}
                className={remainingItems.some((it) => isActive(it)) ? "text-primary" : "text-cream/55"}
              />
              <span
                className={`text-[10px] tracking-[0.05em] uppercase ${
                  remainingItems.some((it) => isActive(it)) ? "text-primary" : "text-cream/55"
                }`}
              >
                Plus
              </span>
            </button>
          )}
        </div>
      </nav>

      {/* === BOTTOM SHEET "Plus" === */}
      {moreOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-[55] bg-black/60 animate-in fade-in duration-200"
            onClick={() => setMoreOpen(false)}
          />
          <div className="md:hidden fixed inset-x-0 bottom-0 z-[60] safe-bottom animate-sheet-up">
            <div className="bg-navy-light border-t border-primary/25 rounded-t-3xl p-4 pb-6">
              <div className="flex items-center justify-between mb-3 px-2">
                <h3 className="font-heading text-primary text-sm tracking-[0.15em] uppercase">
                  Menu
                </h3>
                <button
                  onClick={() => setMoreOpen(false)}
                  className="w-8 h-8 rounded-full bg-cream/5 flex items-center justify-center text-cream/60"
                  aria-label="Fermer"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {remainingItems.map((item) => {
                  const active = isActive(item);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setMoreOpen(false)}
                      className={`mobile-card-pressable flex flex-col items-center justify-center gap-1.5 p-3 min-h-[80px] ${
                        active ? "border-primary/50 bg-primary/10" : ""
                      }`}
                    >
                      <item.icon size={20} className={active ? "text-primary" : "text-cream/70"} />
                      <span
                        className={`text-[10px] text-center leading-tight tracking-wide uppercase ${
                          active ? "text-primary" : "text-cream/70"
                        }`}
                      >
                        {item.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** Raccourcit les labels longs pour la bottom nav (ex: "Tableau de bord" → "Accueil") */
function shortLabel(label: string): string {
  const map: Record<string, string> = {
    "Tableau de bord": "Accueil",
    "Documents convoyeurs": "Docs",
    "Mes documents": "Docs",
    "Mes missions": "Missions",
    "Mon profil": "Profil",
    "Disponibilités": "Dispos",
    "Nouvelle réservation": "Nouveau",
  };
  return map[label] ?? label;
}
