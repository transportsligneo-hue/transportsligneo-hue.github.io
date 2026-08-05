import { Link, useLocation } from "@tanstack/react-router";
import { LogOut, Menu, X, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { LigneoBrand } from "@/components/brand/LigneoBrand";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { OrgLogo } from "@/components/OrgLogo";
import { useCurrentOrgAccountType } from "@/hooks/useCurrentOrgAccountType";

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
  /** "pro" = B2B / Flotte (badge organisation) · "client" = particulier (badge Client) */
  audience?: "pro" | "client";
}

function ClientHeaderBlock({ name, email }: { name?: string; email?: string }) {
  const label = name || email || "Mon espace";
  return (
    <div className="mt-3 flex items-center gap-2.5 rounded-lg border border-blue-200 bg-gradient-to-br from-blue-50 via-white to-white px-2.5 py-2 shadow-[inset_0_0_0_1px_rgba(47,95,255,0.08)]">
      <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg bg-[#2f5fff] text-[13px] font-bold text-white">
        {label.trim().charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium text-pro-text">{label}</div>
        <div className="mt-0.5">
          <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#2f5fff]">
            Client
          </span>
        </div>
      </div>
    </div>
  );
}

function OrgHeaderBlock({ fallbackName }: { fallbackName?: string }) {
  const { data } = useCurrentOrgAccountType();
  const name = data?.name ?? fallbackName ?? "Mon entreprise";
  const isFlotte = data?.accountType === "flotte";
  return (
    <div
      className={`mt-3 flex items-center gap-2.5 rounded-lg border px-2.5 py-2 ${
        isFlotte
          ? "border-violet-200 bg-gradient-to-br from-violet-50 via-white to-white shadow-[inset_0_0_0_1px_rgba(124,58,237,0.08)]"
          : "border-blue-200 bg-gradient-to-br from-blue-50 via-white to-white shadow-[inset_0_0_0_1px_rgba(47,95,255,0.08)]"
      }`}
    >
      <OrgLogo name={name} url={data?.logoUrl} size={34} rounded="rounded-lg" />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-pro-text truncate">{name}</div>
        <div className="mt-0.5">
          <span className="org-theme-badge inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide border">
            {isFlotte ? "Flotte partenaire" : "B2B Standard"}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Layout SaaS clair pour l'espace B2B (/dashboard-pro/*).
 * Indépendant de DashboardSidebar (espace particulier) · design clair, dense, business.
 */
export function ProSidebar({ societe, items, children, audience = "pro" }: Props) {
  const location = useLocation();
  const { logout, user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: orgInfo } = useCurrentOrgAccountType();
  const isClient = audience === "client";
  const themeAttr = isClient
    ? "client"
    : orgInfo?.accountType === "flotte"
      ? "flotte"
      : "b2b_standard";
  const brandRole = isClient ? "client" : "partner";
  const headerBlock = isClient
    ? <ClientHeaderBlock name={societe} email={user?.email ?? undefined} />
    : <OrgHeaderBlock fallbackName={societe} />;

  const isActive = (item: ProSidebarItem) =>
    item.exact
      ? location.pathname === item.to
      : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);

  return (
    <div data-org-theme={themeAttr} className="min-h-screen flex bg-pro-bg text-pro-text">
      {/* === Sidebar Desktop === */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-pro-border flex-col">
        <div className="org-theme-rail absolute inset-y-0 left-0 w-[3px]" aria-hidden="true" />
        <div className="px-5 py-5 border-b border-pro-border">
          <LigneoBrand role={brandRole} variant="light" />
          <p className="text-pro-muted text-[11px] truncate mt-1.5 pl-12">
            {societe || user?.email}
          </p>
          {headerBlock}
        </div>

        <nav className="lig-nav flex-1 p-3 space-y-1 overflow-y-auto">
          {items.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`lig-nav-item${active ? " is-active" : ""}`}
              >
                <span className="lig-nav-ic"><item.icon size={15} /></span>
                <span className="flex-1">{item.label}</span>
                {item.badge}
              </Link>
            );
          })}
        </nav>

        <div className="lig-nav p-3 border-t border-pro-border">
          <button onClick={() => logout()} className="lig-nav-logout">
            <span className="lig-nav-ic"><LogOut size={15} /></span>
            Déconnexion
          </button>
        </div>

      </aside>

      {/* === Mobile header === */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-pro-border safe-top">
        <div className="h-14 px-4 flex items-center justify-between">
          <LigneoBrand role={brandRole} variant="light" compact />
          <div className="flex items-center gap-2 text-pro-text-soft">
            <NotificationBell />
            <button
              onClick={() => setMobileOpen(true)}
              className="w-9 h-9 rounded-md border border-pro-border flex items-center justify-center text-pro-text-soft"
              aria-label="Menu"
            >
              <Menu size={18} />
            </button>
          </div>
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
            <div className="org-theme-rail absolute inset-y-0 left-0 w-[3px]" aria-hidden="true" />
            <div className="px-5 py-4 border-b border-pro-border flex items-center justify-between">
              <LigneoBrand role={brandRole} variant="light" />
              <button
                onClick={() => setMobileOpen(false)}
                className="w-8 h-8 rounded-md hover:bg-pro-bg-soft flex items-center justify-center text-pro-text-soft"
              >
                <X size={18} />
              </button>
            </div>
            <div className="px-4 pt-3">
              {headerBlock}
            </div>



            <nav className="lig-nav flex-1 p-3 space-y-1 overflow-y-auto">
              {items.map((item) => {
                const active = isActive(item);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className={`lig-nav-item${active ? " is-active" : ""}`}
                  >
                    <span className="lig-nav-ic"><item.icon size={15} /></span>
                    <span className="flex-1">{item.label}</span>
                    {item.badge}
                  </Link>
                );
              })}
            </nav>

            <div className="lig-nav p-3 border-t border-pro-border">
              <button onClick={() => logout()} className="lig-nav-logout">
                <span className="lig-nav-ic"><LogOut size={15} /></span>
                Déconnexion
              </button>
            </div>

          </aside>
        </>
      )}

      {/* === Main === */}
      <main className="flex-1 lg:ml-64 pt-14 lg:pt-0 min-h-screen flex flex-col">
        <DashboardHeader variant="light" profileTo={isClient ? "/dashboard-client/profil" : "/dashboard-pro/societe"} enableGlobalSearch />
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full flex-1">{children}</div>
      </main>
    </div>
  );
}
