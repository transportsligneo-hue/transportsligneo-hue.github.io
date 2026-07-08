import { Link, useLocation } from "@tanstack/react-router";
import { Bell, LogOut, Menu, X, type LucideIcon, MoreHorizontal } from "lucide-react";
import { useState, useEffect, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import logoLigneo from "@/assets/logo-transports-ligneo-officiel.png";
import { NotificationBell } from "@/components/notifications/NotificationBell";

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
 * Driver shell premium — Electric Blue / Glassmorphism
 * Inspirations : Tesla App, Mercedes Me, Porsche, Rivian, Apple Wallet, Revolut Ultra.
 */
export function ConvoyeurSidebar({ items, children }: Props) {
  const location = useLocation();
  const { logout, user } = useAuth();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    const prevHtml = document.documentElement.style.background;
    const prevBody = document.body.style.background;
    document.documentElement.style.background = "#041B52";
    document.body.style.background = "#041B52";
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

  const navItemClass = (active: boolean) =>
    `relative flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm transition-all ${
      active
        ? "bg-gradient-to-r from-[rgba(47,125,255,0.28)] via-[rgba(78,168,255,0.14)] to-transparent text-white font-semibold shadow-[0_0_24px_rgba(78,168,255,0.30)]"
        : "text-[#D6E4FF] hover:bg-white/[0.06] hover:text-white"
    }`;

  return (
    <div className="driver-shell flex">
      {/* === Sidebar Desktop premium === */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 z-40 w-64 flex-col border-r border-[rgba(103,193,255,0.18)] bg-[rgba(4,27,82,0.72)] backdrop-blur-2xl">
        <div className="px-5 py-5 border-b border-[rgba(103,193,255,0.16)]">
          <DriverBrand />
          {user?.email && (
            <p className="text-[11px] text-[#A8C2FF]/80 truncate mt-2.5 pl-12 font-mono">{user.email}</p>
          )}
          <div className="mt-3 pl-11 text-[#D6E4FF]">
            <NotificationBell />
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {items.map((item) => {
            const active = isActive(item);
            return (
              <Link key={item.to} to={item.to} className={navItemClass(active)}>
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-7 bg-gradient-to-b from-[#67C1FF] to-[#2F7DFF] rounded-r-full shadow-[0_0_12px_rgba(103,193,255,0.80)]" />
                )}
                <item.icon size={18} className={active ? "text-[#67C1FF]" : "text-[#A8C2FF]"} />
                <span className="flex-1">{item.label}</span>
                {item.badge}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-[rgba(103,193,255,0.16)]">
          <button
            onClick={() => logout()}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm text-[#D6E4FF] hover:bg-red-500/10 hover:text-red-300 transition-colors"
          >
            <LogOut size={17} />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* === Mobile Header premium glass === */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 border-b border-[rgba(103,193,255,0.20)] bg-[rgba(4,27,82,0.78)] backdrop-blur-2xl">
        <div style={{ height: "env(safe-area-inset-top)" }} className="bg-[rgba(4,27,82,0.95)]" />
        <div className="h-16 px-4 flex items-center justify-between gap-3">
          <DriverBrand />
          <div className="flex items-center gap-2 shrink-0">
            <NotificationBell />
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="w-11 h-11 rounded-2xl border border-[rgba(103,193,255,0.28)] bg-white/[0.06] backdrop-blur-xl flex items-center justify-center text-white active:scale-95 transition-transform"
              aria-label="Menu"
            >
              <Menu size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* === Mobile Drawer === */}
      {mobileMenuOpen && (
        <>
          <div className="md:hidden fixed inset-0 z-50 bg-[#041B52]/70 backdrop-blur-md" onClick={() => setMobileMenuOpen(false)} />
          <aside className="md:hidden fixed inset-y-0 left-0 z-[55] w-80 bg-[rgba(4,27,82,0.95)] backdrop-blur-2xl border-r border-[rgba(103,193,255,0.30)] flex flex-col safe-top safe-bottom animate-sheet-up">
            <div className="px-5 py-4 border-b border-[rgba(103,193,255,0.20)] flex items-center justify-between">
              <DriverBrand />
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="w-10 h-10 rounded-2xl bg-white/[0.06] border border-[rgba(103,193,255,0.28)] flex items-center justify-center text-white"
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
                    className={`flex items-center gap-3 px-3 py-3 rounded-2xl text-sm transition-all ${
                      active
                        ? "bg-gradient-to-r from-[rgba(47,125,255,0.32)] via-[rgba(78,168,255,0.16)] to-transparent text-white font-semibold"
                        : "text-[#D6E4FF] hover:bg-white/[0.06]"
                    }`}
                  >
                    <item.icon size={18} className={active ? "text-[#67C1FF]" : "text-[#A8C2FF]"} />
                    <span className="flex-1">{item.label}</span>
                    {item.badge}
                  </Link>
                );
              })}
            </nav>
            <div className="p-3 border-t border-[rgba(103,193,255,0.20)]">
              <button
                onClick={() => logout()}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-[#D6E4FF] hover:bg-red-500/10 hover:text-red-300"
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

      {/* === Mobile Bottom Tab Bar premium glassmorphism flottant === */}
      <nav
        aria-label="Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 safe-bottom px-3 pb-2 pt-2 pointer-events-none"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.5rem)" }}
      >
        <div className="pointer-events-auto rounded-3xl border border-[rgba(103,193,255,0.28)] bg-[rgba(4,27,82,0.75)] backdrop-blur-2xl shadow-[0_18px_50px_-12px_rgba(4,27,82,0.85),0_0_0_1px_rgba(103,193,255,0.08)_inset]">
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
                    <span className="absolute -top-px left-1/2 -translate-x-1/2 w-10 h-[3px] rounded-full bg-gradient-to-r from-[#2F7DFF] via-[#4EA8FF] to-[#67C1FF] shadow-[0_0_14px_rgba(78,168,255,0.85)]" />
                  )}
                  <item.icon
                    size={20}
                    className={active ? "text-[#67C1FF] drop-shadow-[0_0_8px_rgba(103,193,255,0.65)]" : "text-[#A8C2FF]"}
                  />
                  <span className={`text-[10px] tracking-wide font-semibold ${active ? "text-white" : "text-[#A8C2FF]"}`}>
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
                  <span className="absolute -top-px left-1/2 -translate-x-1/2 w-10 h-[3px] rounded-full bg-gradient-to-r from-[#2F7DFF] via-[#4EA8FF] to-[#67C1FF] shadow-[0_0_14px_rgba(78,168,255,0.85)]" />
                )}
                <MoreHorizontal
                  size={20}
                  className={overflowTabs.some(isActive) ? "text-[#67C1FF]" : "text-[#A8C2FF]"}
                />
                <span className={`text-[10px] tracking-wide font-semibold ${overflowTabs.some(isActive) ? "text-white" : "text-[#A8C2FF]"}`}>
                  Plus
                </span>
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* === Bottom sheet "Plus" === */}
      {moreOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-[55] bg-[#041B52]/70 backdrop-blur-md"
            onClick={() => setMoreOpen(false)}
          />
          <div className="md:hidden fixed inset-x-0 bottom-0 z-[60] safe-bottom animate-sheet-up">
            <div className="bg-[rgba(4,27,82,0.95)] backdrop-blur-2xl border-t border-[rgba(103,193,255,0.30)] rounded-t-3xl p-4 pb-6">
              <div className="w-10 h-1 bg-white/15 rounded-full mx-auto mb-3" />
              <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="text-white font-semibold text-sm">Menu</h3>
                <button
                  onClick={() => setMoreOpen(false)}
                  className="w-9 h-9 rounded-2xl bg-white/[0.06] border border-[rgba(103,193,255,0.28)] flex items-center justify-center text-white"
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
                          ? "border-[rgba(103,193,255,0.55)] bg-[rgba(47,125,255,0.18)] text-white shadow-[0_0_24px_rgba(78,168,255,0.30)]"
                          : "border-[rgba(103,193,255,0.18)] bg-white/[0.05] text-[#D6E4FF]"
                      }`}
                    >
                      <item.icon size={20} className={active ? "text-[#67C1FF]" : "text-[#A8C2FF]"} />
                      <span className="text-[10px] text-center leading-tight tracking-wide font-semibold">
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

/* Brand premium driver : logo officiel + wordmark + badge DRIVER bleu néon */
function DriverBrand() {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <div className="relative w-11 h-11 rounded-2xl overflow-hidden shrink-0 bg-gradient-to-br from-[#0D2E7A] to-[#041B52] flex items-center justify-center p-1.5 ring-1 ring-[rgba(103,193,255,0.45)] shadow-[0_0_18px_rgba(78,168,255,0.35)]">
        <img src={logoLigneo} alt="Transports Ligneo" className="w-full h-full object-contain" />
      </div>
      <div className="min-w-0 flex flex-col leading-tight">
        <span className="font-semibold text-[14px] tracking-[0.02em] text-white truncate">
          Transports Ligneo
        </span>
        <span className="inline-flex items-center self-start mt-1 px-2 py-[2px] rounded-md text-[9px] font-extrabold uppercase tracking-[0.18em] bg-gradient-to-r from-[#2F7DFF] via-[#4EA8FF] to-[#67C1FF] text-white shadow-[0_0_14px_rgba(78,168,255,0.55)]">
          Driver
        </span>
      </div>
    </div>
  );
}
