import { Link, useLocation } from "@tanstack/react-router";
import { LogOut, Menu, X, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { LigneoBrand } from "@/components/brand/LigneoBrand";
import { useAuth } from "@/hooks/useAuth";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";

export interface AdminSidebarItem {
  to: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  badge?: ReactNode;
  group?: string;
}

interface Props {
  items: AdminSidebarItem[];
  children: ReactNode;
}

/**
 * Sidebar admin SaaS clair (cohérent avec ProSidebar).
 * Regroupement par "group" + sticky sur desktop, drawer sur mobile.
 */
export function AdminSidebar({ items, children }: Props) {
  const location = useLocation();
  const { logout, user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (item: AdminSidebarItem) =>
    item.exact
      ? location.pathname === item.to
      : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);

  // Group items
  const groups = items.reduce<Record<string, AdminSidebarItem[]>>((acc, it) => {
    const g = it.group ?? "_main";
    (acc[g] ||= []).push(it);
    return acc;
  }, {});
  const groupOrder = Object.keys(groups);

  const renderNav = (onClick?: () => void) => (
    <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
      {groupOrder.map((g) => (
        <div key={g} className="space-y-0.5">
          {g !== "_main" && (
            <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-pro-muted">
              {g}
            </p>
          )}
          {groups[g].map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={onClick}
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
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen flex bg-pro-bg text-pro-text">
      {/* === Sidebar Desktop === */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-pro-border flex-col shadow-pro-card">
        {/* Bandeau brand bleu nuit (style Stripe / Qonto) */}
        <div className="bg-pro-brand-strip px-5 py-5 border-b border-pro-border">
          <LigneoBrand role="admin" variant="dark" />
          <p className="text-cream/50 text-[11px] truncate mt-1.5 pl-12">{user?.email}</p>
        </div>

        {renderNav()}

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
          <LigneoBrand role="admin" variant="light" compact />
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
          <aside className="lg:hidden fixed inset-y-0 left-0 z-[55] w-72 bg-white border-r border-pro-border flex flex-col safe-top safe-bottom shadow-pro-elevated">
            <div className="bg-pro-brand-strip px-5 py-4 border-b border-pro-border flex items-center justify-between">
              <LigneoBrand role="admin" variant="dark" />
              <button
                onClick={() => setMobileOpen(false)}
                className="w-8 h-8 rounded-md hover:bg-white/10 flex items-center justify-center text-cream/70 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {renderNav(() => setMobileOpen(false))}

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
        <DashboardHeader variant="light" enableGlobalSearch />
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full flex-1">{children}</div>
      </main>
    </div>
  );
}
