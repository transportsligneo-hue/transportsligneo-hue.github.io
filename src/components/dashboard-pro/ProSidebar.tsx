import { Link, useLocation } from "@tanstack/react-router";
import { LogOut, Menu, X, Building2, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";

export interface ProSidebarItem {
  to: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  badge?: ReactNode;
}

interface Props {
  societe?: string;
  items: ProSidebarItem[];
  children: ReactNode;
}

/**
 * Layout SaaS clair pour l'espace B2B (/dashboard-pro/*).
 * Indépendant de DashboardSidebar (espace particulier) — design clair, dense, business.
 */
export function ProSidebar({ societe, items, children }: Props) {
  const location = useLocation();
  const { logout, user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (item: ProSidebarItem) =>
    item.exact
      ? location.pathname === item.to
      : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);

  return (
    <div className="min-h-screen flex bg-pro-bg text-pro-text">
      {/* === Sidebar Desktop === */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-pro-border flex-col">
        <div className="px-6 py-5 border-b border-pro-border">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-pro-accent text-white flex items-center justify-center">
              <Building2 size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-pro-text font-semibold text-sm truncate">
                {societe || "Espace Pro"}
              </p>
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
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  active
                    ? "bg-pro-accent/10 text-pro-accent font-medium"
                    : "text-pro-text-soft hover:bg-pro-bg-soft hover:text-pro-text"
                }`}
              >
                <item.icon size={17} className={active ? "text-pro-accent" : "text-pro-muted"} />
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

      {/* === Mobile header === */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-pro-border safe-top">
        <div className="h-14 px-4 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-md bg-pro-accent text-white flex items-center justify-center shrink-0">
              <Building2 size={15} />
            </div>
            <p className="text-pro-text font-semibold text-sm truncate">{societe || "Espace Pro"}</p>
          </div>
          <button
            onClick={() => setMobileOpen(true)}
            className="w-9 h-9 rounded-md border border-pro-border flex items-center justify-center text-pro-text-soft"
            aria-label="Menu"
          >
            <Menu size={18} />
          </button>
        </div>
      </header>

      {/* === Mobile drawer === */}
      {mobileOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-50 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="lg:hidden fixed inset-y-0 left-0 z-[55] w-72 bg-white border-r border-pro-border flex flex-col safe-top safe-bottom">
            <div className="px-5 py-4 border-b border-pro-border flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-pro-accent text-white flex items-center justify-center shrink-0">
                  <Building2 size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-pro-text font-semibold text-sm truncate">{societe || "Espace Pro"}</p>
                  <p className="text-pro-muted text-xs truncate">{user?.email}</p>
                </div>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
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
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm ${
                      active
                        ? "bg-pro-accent/10 text-pro-accent font-medium"
                        : "text-pro-text-soft hover:bg-pro-bg-soft"
                    }`}
                  >
                    <item.icon size={17} className={active ? "text-pro-accent" : "text-pro-muted"} />
                    <span>{item.label}</span>
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
      <main className="flex-1 lg:ml-64 pt-14 lg:pt-0 min-h-screen flex flex-col">
        <DashboardHeader variant="light" profileTo="/dashboard-pro/societe" />
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full flex-1">{children}</div>
      </main>
    </div>
  );
}
