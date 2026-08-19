import { Link, useLocation } from "@tanstack/react-router";
import { LogOut, Menu, X, type LucideIcon } from "lucide-react";
import DriverDock from "@/components/convoyeur/DriverDock";
import { useState, useEffect, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import ThemeToggle from "@/components/ThemeToggle";
import LigneoLockup from "@/components/brand/LigneoLockup";
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
 * Driver shell premium · Electric Blue / Glassmorphism
 * Inspirations : Tesla App, Mercedes Me, Porsche, Rivian, Apple Wallet, Revolut Ultra.
 */
export function ConvoyeurSidebar({ items, children }: Props) {
  const location = useLocation();
  const { logout, user } = useAuth();
  const { theme } = useTheme();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const prevHtml = document.documentElement.style.background;
    const prevBody = document.body.style.background;
    const shellBg = theme === "light" ? "#f5f7fc" : "#041B52";
    document.documentElement.style.background = shellBg;
    document.body.style.background = shellBg;
    return () => {
      document.documentElement.style.background = prevHtml;
      document.body.style.background = prevBody;
    };
  }, [theme]);

  const isActive = (item: ConvoyeurSidebarItem) =>
    item.exact
      ? location.pathname === item.to
      : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);

  const navItemClass = (active: boolean) =>
    `relative flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm transition-all ${
      active
        ? "bg-gradient-to-r from-[rgba(47,125,255,0.28)] via-[rgba(78,168,255,0.14)] to-transparent text-white font-semibold shadow-[0_0_24px_rgba(78,168,255,0.30)]"
        : "text-[#D6E4FF] hover:bg-white/[0.06] hover:text-white"
    }`;

  return (
    <div className="driver-shell flex">
      {/* === Sidebar Desktop premium === */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 z-40 driver-nav-surface w-64 flex-col border-r border-[rgba(103,193,255,0.18)] bg-[rgba(4,27,82,0.72)] backdrop-blur-2xl">
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

        <div className="p-3 border-t border-[rgba(103,193,255,0.16)] space-y-1">
          <ThemeToggle variant="full" className="w-full justify-start" />
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
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 driver-nav-surface border-b border-[rgba(103,193,255,0.20)] bg-[rgba(4,27,82,0.78)] backdrop-blur-2xl">
        <div style={{ height: "env(safe-area-inset-top)" }} className="bg-[rgba(4,27,82,0.95)]" />
        <div className="h-11 px-3.5 flex items-center justify-between gap-3">
          <DriverBrand size="sm" />
          <div className="flex items-center gap-2 shrink-0">
            <NotificationBell />
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="w-9 h-9 rounded-xl border border-[rgba(103,193,255,0.28)] bg-white/[0.06] backdrop-blur-xl flex items-center justify-center text-white active:scale-95 transition-transform"
              aria-label="Menu"
            >
              <Menu size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* === Mobile Drawer === */}
      {mobileMenuOpen && (
        <>
          <div className="md:hidden fixed inset-0 z-50 bg-[#041B52]/70 backdrop-blur-md" onClick={() => setMobileMenuOpen(false)} />
          <aside className="md:hidden fixed inset-y-0 left-0 z-[55] driver-nav-surface w-80 bg-[rgba(4,27,82,0.95)] backdrop-blur-2xl border-r border-[rgba(103,193,255,0.30)] flex flex-col safe-top safe-bottom animate-sheet-up">
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
            <div className="p-3 border-t border-[rgba(103,193,255,0.20)] space-y-1">
              <ThemeToggle variant="full" className="w-full justify-start" />
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

      {/* === Dock mobile premium (Tableau de bord · Mes missions · Catalogue · Plus) === */}
      <DriverDock items={items} isActive={isActive} />

    </div>
  );
}

/* Brand premium driver : lockup officiel TRANSPORTS LIGNEO + tag DRIVER */
function DriverBrand({ size = "md" }: { size?: "sm" | "md" }) {
  return <LigneoLockup size={size} tag="Driver" />;
}
