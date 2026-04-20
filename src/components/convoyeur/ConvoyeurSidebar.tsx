import { Link, useLocation } from "@tanstack/react-router";
import { LogOut, Menu, X, Truck, type LucideIcon, MoreHorizontal } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";


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
 * Sidebar convoyeur – mobile-first, thème SaaS clair.
 * Mobile : bottom tab bar (4 tabs + "Plus"), pas de sidebar.
 * Desktop : sidebar gauche fixe.
 */
export function ConvoyeurSidebar({ items, children }: Props) {
  const location = useLocation();
  const { logout, user } = useAuth();
  
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (item: ConvoyeurSidebarItem) =>
    item.exact
      ? location.pathname === item.to
      : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);

  // Mobile bottom nav: 4 visible + "Plus" overflow
  const MAX_TABS = 4;
  const hasOverflow = items.length > MAX_TABS;
  const visibleTabs = hasOverflow ? items.slice(0, 3) : items.slice(0, MAX_TABS);
  const overflowTabs = hasOverflow ? items.slice(3) : [];

  return (
    <div className="min-h-screen flex bg-pro-bg text-pro-text">
      {/* === Sidebar Desktop === */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 z-40 w-60 bg-white border-r border-pro-border flex-col">
        <div className="px-5 py-5 border-b border-pro-border">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
              <Truck size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-pro-text font-semibold text-sm truncate">Espace Convoyeur</p>
              <p className="text-pro-muted text-xs truncate">{user?.email}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {items.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  active
                    ? "bg-emerald-50 text-emerald-700 font-medium"
                    : "text-pro-text-soft hover:bg-pro-bg-soft hover:text-pro-text"
                }`}
              >
                <item.icon size={17} className={active ? "text-emerald-600" : "text-pro-muted"} />
                <span className="flex-1">{item.label}</span>
                {item.badge}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-pro-border">
          <button
            onClick={() => logout()}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-md text-sm text-pro-text-soft hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut size={17} />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* === Mobile Header === */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-pro-border safe-top">
        <div className="h-14 px-4 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <Truck size={15} />
            </div>
            <p className="text-pro-text font-semibold text-sm truncate">Convoyeur</p>
          </div>
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="w-9 h-9 rounded-md border border-pro-border flex items-center justify-center text-pro-text-soft"
            aria-label="Menu"
          >
            <Menu size={18} />
          </button>
        </div>
      </header>

      {/* === Mobile Drawer (full menu) === */}
      {mobileMenuOpen && (
        <>
          <div className="md:hidden fixed inset-0 z-50 bg-black/40" onClick={() => setMobileMenuOpen(false)} />
          <aside className="md:hidden fixed inset-y-0 left-0 z-[55] w-72 bg-white border-r border-pro-border flex flex-col safe-top safe-bottom">
            <div className="px-5 py-4 border-b border-pro-border flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <Truck size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-pro-text font-semibold text-sm truncate">Espace Convoyeur</p>
                  <p className="text-pro-muted text-xs truncate">{user?.email}</p>
                </div>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="w-8 h-8 rounded-md hover:bg-pro-bg-soft flex items-center justify-center text-pro-text-soft"
              >
                <X size={18} />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
              {items.map((item) => {
                const active = isActive(item);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                      active
                        ? "bg-emerald-50 text-emerald-700 font-medium"
                        : "text-pro-text-soft hover:bg-pro-bg-soft hover:text-pro-text"
                    }`}
                  >
                    <item.icon size={17} className={active ? "text-emerald-600" : "text-pro-muted"} />
                    <span className="flex-1">{item.label}</span>
                    {item.badge}
                  </Link>
                );
              })}
            </nav>
            <div className="p-3 border-t border-pro-border">
              <button
                onClick={() => logout()}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-md text-sm text-pro-text-soft hover:bg-red-50 hover:text-red-600"
              >
                <LogOut size={17} />
                Déconnexion
              </button>
            </div>
          </aside>
        </>
      )}

      {/* === Main === */}
      <main className="flex-1 md:ml-60 pt-14 md:pt-0 pb-20 md:pb-0 min-h-screen">
        <div className="p-4 sm:p-5 md:p-8 max-w-5xl mx-auto">{children}</div>
      </main>

      {/* === Mobile Bottom Tab Bar === */}
      <nav
        aria-label="Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-pro-border safe-bottom"
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
                className="flex flex-col items-center justify-center gap-0.5 h-full active:scale-95 transition-transform"
              >
                <item.icon size={20} className={active ? "text-emerald-600" : "text-pro-muted"} />
                <span className={`text-[10px] tracking-wide uppercase ${active ? "text-emerald-600 font-semibold" : "text-pro-muted"}`}>
                  {item.shortLabel || item.label}
                </span>
              </Link>
            );
          })}
          {hasOverflow && (
            <button
              onClick={() => setMoreOpen(true)}
              className="flex flex-col items-center justify-center gap-0.5 h-full active:scale-95 transition-transform"
              aria-label="Plus"
            >
              <MoreHorizontal
                size={20}
                className={overflowTabs.some(isActive) ? "text-emerald-600" : "text-pro-muted"}
              />
              <span className={`text-[10px] tracking-wide uppercase ${overflowTabs.some(isActive) ? "text-emerald-600 font-semibold" : "text-pro-muted"}`}>
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
            className="md:hidden fixed inset-0 z-[55] bg-black/40"
            onClick={() => setMoreOpen(false)}
          />
          <div className="md:hidden fixed inset-x-0 bottom-0 z-[60] safe-bottom">
            <div className="bg-white border-t border-pro-border rounded-t-2xl p-4 pb-6">
              <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="text-pro-text font-semibold text-sm">Menu</h3>
                <button
                  onClick={() => setMoreOpen(false)}
                  className="w-8 h-8 rounded-full bg-pro-bg-soft flex items-center justify-center text-pro-text-soft"
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
                      className={`flex flex-col items-center justify-center gap-1.5 p-3 min-h-[76px] rounded-xl border transition-colors ${
                        active
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-pro-border bg-white text-pro-text-soft hover:bg-pro-bg-soft"
                      }`}
                    >
                      <item.icon size={20} className={active ? "text-emerald-600" : "text-pro-muted"} />
                      <span className="text-[10px] text-center leading-tight tracking-wide uppercase">
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
