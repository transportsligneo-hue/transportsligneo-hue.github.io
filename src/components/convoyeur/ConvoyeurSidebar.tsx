import { Link, useLocation } from "@tanstack/react-router";
import { LogOut, Menu, X, type LucideIcon, MoreHorizontal } from "lucide-react";
import { useState, useEffect, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import logoLigneo from "@/assets/logo-transports-ligneo-officiel.png";

export interface ConvoyeurSidebarItem {
  to: string;
  label: string;
  shortLabel?: string;
  icon: LucideIcon;
  exact?: boolean;
  badge?: ReactNode;
}

interface Props {
  items: ConvoyeurSidebarItem[];
  children: ReactNode;
}

/**
 * Driver shell premium — fond navy, accents or, glassmorphism.
 * Wrap ALL convoyeur.* routes via .driver-shell pour basculer
 * automatiquement le thème SaaS clair → premium dark sans toucher
 * aux composants enfants (overrides scoppés dans styles.css).
 */
export function ConvoyeurSidebar({ items, children }: Props) {
  const location = useLocation();
  const { logout, user } = useAuth();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  // Force fond navy sous html/body pendant la navigation Driver
  // (sinon la safe-area iOS laisse voir le fond du site vitrine).
  useEffect(() => {
    const prevHtml = document.documentElement.style.background;
    const prevBody = document.body.style.background;
    document.documentElement.style.background = "#0a1230";
    document.body.style.background = "#0a1230";
    return () => {
      document.documentElement.style.background = prevHtml;
      document.body.style.background = prevBody;
    };
  }, []);

  const isActive = (item: ConvoyeurSidebarItem) =>
    item.exact
      ? location.pathname === item.to
      : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);

  const MAX_TABS = 4;
  const hasOverflow = items.length > MAX_TABS;
  const visibleTabs = hasOverflow ? items.slice(0, 3) : items.slice(0, MAX_TABS);
  const overflowTabs = hasOverflow ? items.slice(3) : [];

  return (
    <div className="driver-shell flex">
      {/* === Sidebar Desktop premium === */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 z-40 w-64 flex-col border-r border-[rgba(212,175,55,0.18)] bg-[#0b1026]/80 backdrop-blur-xl">
        <div className="px-5 py-5 border-b border-[rgba(212,175,55,0.18)]">
          <DriverBrand />
          {user?.email && (
            <p className="text-[11px] text-[#8a90a8] truncate mt-2 pl-12 font-mono">{user.email}</p>
          )}
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {items.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                  active
                    ? "bg-gradient-to-r from-[rgba(212,175,55,0.18)] to-transparent text-[#e7c76a] font-semibold"
                    : "text-[#c7cad8] hover:bg-white/5 hover:text-white"
                }`}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-[#d4af37] rounded-r-full" />
                )}
                <item.icon size={17} className={active ? "text-[#d4af37]" : "text-[#8a90a8]"} />
                <span className="flex-1">{item.label}</span>
                {item.badge}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-[rgba(212,175,55,0.18)]">
          <button
            onClick={() => logout()}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-[#c7cad8] hover:bg-red-500/10 hover:text-red-300 transition-colors"
          >
            <LogOut size={17} />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* === Mobile Header premium glass === */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 border-b border-[rgba(212,175,55,0.18)] bg-[#070b1f]/95 backdrop-blur-xl">
        <div style={{ height: "env(safe-area-inset-top)" }} className="bg-[#070b1f]" />
        <div className="h-14 px-4 flex items-center justify-between">
          <DriverBrand />
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="w-10 h-10 rounded-full border border-[rgba(212,175,55,0.30)] bg-white/5 flex items-center justify-center text-[#e7c76a] active:scale-95 transition-transform"
            aria-label="Menu"
          >
            <Menu size={18} />
          </button>
        </div>
      </header>

      {/* === Mobile Drawer === */}
      {mobileMenuOpen && (
        <>
          <div className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <aside className="md:hidden fixed inset-y-0 left-0 z-[55] w-80 bg-[#0b1026] border-r border-[rgba(212,175,55,0.30)] flex flex-col safe-top safe-bottom animate-sheet-up">
            <div className="px-5 py-4 border-b border-[rgba(212,175,55,0.18)] flex items-center justify-between">
              <DriverBrand />
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-[#e7c76a]"
              >
                <X size={18} />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {items.map((item) => {
                const active = isActive(item);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition-all ${
                      active
                        ? "bg-gradient-to-r from-[rgba(212,175,55,0.20)] to-transparent text-[#e7c76a] font-semibold"
                        : "text-[#c7cad8] hover:bg-white/5"
                    }`}
                  >
                    <item.icon size={18} className={active ? "text-[#d4af37]" : "text-[#8a90a8]"} />
                    <span className="flex-1">{item.label}</span>
                    {item.badge}
                  </Link>
                );
              })}
            </nav>
            <div className="p-3 border-t border-[rgba(212,175,55,0.18)]">
              <button
                onClick={() => logout()}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-[#c7cad8] hover:bg-red-500/10 hover:text-red-300"
              >
                <LogOut size={17} />
                Déconnexion
              </button>
            </div>
          </aside>
        </>
      )}

      {/* === Main === */}
      <main className="flex-1 md:ml-64 pb-bottom-nav md:pb-0 min-h-screen flex flex-col w-full driver-main">
        <div className="px-3 py-4 sm:px-4 sm:py-5 md:p-8 md:max-w-5xl md:mx-auto w-full flex-1">{children}</div>
      </main>

      {/* === Mobile Bottom Tab Bar premium === */}
      <nav
        aria-label="Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#070b1f]/95 backdrop-blur-xl border-t border-[rgba(212,175,55,0.20)] safe-bottom"
      >
        <div
          className="grid h-16 items-stretch"
          style={{ gridTemplateColumns: `repeat(${visibleTabs.length + (hasOverflow ? 1 : 0)}, 1fr)` }}
        >
          {visibleTabs.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.to}
                to={item.to}
                className="relative flex flex-col items-center justify-center gap-1 h-full active:scale-95 transition-transform"
              >
                {active && (
                  <span className="absolute top-1 w-8 h-0.5 bg-[#d4af37] rounded-full" />
                )}
                <item.icon size={20} className={active ? "text-[#d4af37]" : "text-[#8a90a8]"} />
                <span className={`text-[10px] tracking-wide uppercase font-semibold ${active ? "text-[#e7c76a]" : "text-[#8a90a8]"}`}>
                  {item.shortLabel || item.label}
                </span>
              </Link>
            );
          })}
          {hasOverflow && (
            <button
              onClick={() => setMoreOpen(true)}
              className="relative flex flex-col items-center justify-center gap-1 h-full active:scale-95 transition-transform"
              aria-label="Plus"
            >
              {overflowTabs.some(isActive) && (
                <span className="absolute top-1 w-8 h-0.5 bg-[#d4af37] rounded-full" />
              )}
              <MoreHorizontal
                size={20}
                className={overflowTabs.some(isActive) ? "text-[#d4af37]" : "text-[#8a90a8]"}
              />
              <span className={`text-[10px] tracking-wide uppercase font-semibold ${overflowTabs.some(isActive) ? "text-[#e7c76a]" : "text-[#8a90a8]"}`}>
                Plus
              </span>
            </button>
          )}
        </div>
      </nav>

      {/* === Bottom sheet "Plus" === */}
      {moreOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-[55] bg-black/60 backdrop-blur-sm"
            onClick={() => setMoreOpen(false)}
          />
          <div className="md:hidden fixed inset-x-0 bottom-0 z-[60] safe-bottom animate-sheet-up">
            <div className="bg-[#0b1026] border-t border-[rgba(212,175,55,0.30)] rounded-t-3xl p-4 pb-6">
              <div className="w-10 h-1 bg-white/15 rounded-full mx-auto mb-3" />
              <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="text-white font-semibold text-sm">Menu</h3>
                <button
                  onClick={() => setMoreOpen(false)}
                  className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-[#e7c76a]"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {overflowTabs.map((item) => {
                  const active = isActive(item);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setMoreOpen(false)}
                      className={`flex flex-col items-center justify-center gap-1.5 p-3 min-h-[80px] rounded-2xl border transition-all ${
                        active
                          ? "border-[rgba(212,175,55,0.50)] bg-[rgba(212,175,55,0.12)] text-[#e7c76a]"
                          : "border-[rgba(212,175,55,0.18)] bg-white/5 text-[#c7cad8]"
                      }`}
                    >
                      <item.icon size={20} className={active ? "text-[#d4af37]" : "text-[#8a90a8]"} />
                      <span className="text-[10px] text-center leading-tight tracking-wide uppercase font-semibold">
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

/* Brand premium driver : logo officiel + wordmark + badge DRIVER or */
function DriverBrand() {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <div className="w-10 h-10 rounded-xl overflow-hidden ring-1 ring-[rgba(212,175,55,0.40)] shrink-0 bg-[#070b1f] flex items-center justify-center p-1">
        <img src={logoLigneo} alt="Transports Ligneo" className="w-full h-full object-contain" />
      </div>
      <div className="min-w-0 flex flex-col leading-tight">
        <span className="font-heading text-[13px] tracking-[0.06em] text-white truncate">
          Transports Ligneo
        </span>
        <span className="inline-flex items-center self-start mt-0.5 px-1.5 py-[1px] rounded text-[9px] font-bold uppercase tracking-[0.14em] bg-gradient-to-r from-[#d4af37] to-[#e7c76a] text-[#0b1026]">
          Driver
        </span>
      </div>
    </div>
  );
}
