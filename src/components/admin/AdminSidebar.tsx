import { Link, useLocation } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, LogOut, Menu, PanelLeftClose, PanelLeftOpen, X, type LucideIcon } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

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
  const [collapsed, setCollapsed] = useState(false);

  // Restaure la préférence (rétracté / déployé) après hydratation
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("admin-sidebar-collapsed") === "1");
    } catch { /* storage indisponible */ }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem("admin-sidebar-collapsed", next ? "1" : "0"); } catch { /* noop */ }
      return next;
    });
  };

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

  const renderNav = (onClick?: () => void, mini = false) => (
    <nav className={`lig-nav flex-1 ${mini ? "p-2" : "p-3"} space-y-5 overflow-y-auto overflow-x-hidden`}>
      {groupOrder.map((g) => (
        <div key={g} className="space-y-1">
          {g !== "_main" && (
            mini ? (
              <div className="mx-3 my-2 border-t border-pro-border" />
            ) : (
              <p className="px-3 pt-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-pro-muted">
                {g}
              </p>
            )
          )}
          {groups[g].map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={onClick}
                title={mini ? item.label : undefined}
                aria-label={mini ? item.label : undefined}
                className={`lig-nav-item${active ? " is-active" : ""}${mini ? " justify-center px-0" : ""}`}
              >
                <span className="lig-nav-ic"><item.icon size={15} /></span>
                {!mini && <span className="flex-1">{item.label}</span>}
                {!mini && item.badge}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );



  return (
    <div className="admin-shell min-h-screen flex text-pro-text">
      {/* === Sidebar Desktop === */}
      <aside
        className={`hidden lg:flex fixed inset-y-0 left-0 z-40 ${collapsed ? "w-[76px]" : "w-64"} bg-white border-r border-pro-border flex-col shadow-pro-card transition-[width] duration-200 ease-out`}
      >
        {/* Bandeau brand bleu nuit (style Stripe / Qonto) */}
        <div className={`bg-pro-brand-strip border-b border-pro-border ${collapsed ? "px-2 py-4" : "px-5 py-5"}`}>
          {collapsed ? (
            <div className="flex justify-center">
              <LigneoBrand role="admin" variant="dark" compact />
            </div>
          ) : (
            <>
              <LigneoBrand role="admin" variant="dark" />
              <p className="text-cream/50 text-[11px] truncate mt-1.5 pl-12">{user?.email}</p>
            </>
          )}
        </div>

        {/* Bouton rétracter / déployer */}
        <button
          onClick={toggleCollapsed}
          title={collapsed ? "Déployer le menu" : "Rétracter le menu"}
          aria-label={collapsed ? "Déployer le menu" : "Rétracter le menu"}
          className={`flex items-center gap-2 border-b border-pro-border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-pro-muted hover:text-pro-text hover:bg-pro-surface-2 transition-colors ${collapsed ? "justify-center" : ""}`}
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          {!collapsed && <span>Rétracter</span>}
        </button>

        {renderNav(undefined, collapsed)}

        <div className={`lig-nav border-t border-pro-border ${collapsed ? "p-2" : "p-3"}`}>
          <button
            onClick={() => logout()}
            className={`lig-nav-logout${collapsed ? " justify-center px-0" : ""}`}
            title={collapsed ? "Déconnexion" : undefined}
          >
            <span className="lig-nav-ic"><LogOut size={15} /></span>
            {!collapsed && "Déconnexion"}
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

            <div className="lig-nav p-3 border-t border-pro-border">
              <button onClick={() => logout()} className="lig-nav-logout">
                <span className="lig-nav-ic"><LogOut size={15} /></span>
                Déconnexion
              </button>
            </div>

          </aside>
        </>
      )}

      {/* Poignée flottante toujours visible pour rétracter / déployer */}
      <button
        onClick={toggleCollapsed}
        className="admin-rail-toggle"
        style={{ left: collapsed ? 63 : 243 }}
        title={collapsed ? "Déployer le menu" : "Rétracter le menu"}
        aria-label={collapsed ? "Déployer le menu latéral" : "Rétracter le menu latéral"}
      >
        {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
      </button>

      {/* === Main === */}
      <main
        className={`flex-1 min-w-0 max-w-full ${collapsed ? "lg:ml-[76px]" : "lg:ml-64"} pt-14 lg:pt-0 min-h-screen flex flex-col transition-[margin] duration-200 ease-out`}
      >
        <DashboardHeader variant="light" enableGlobalSearch />
        <div className="p-4 sm:p-5 lg:px-6 lg:py-7 max-w-[2000px] mx-auto w-full min-w-0 flex-1">{children}</div>
      </main>


    </div>
  );
}
