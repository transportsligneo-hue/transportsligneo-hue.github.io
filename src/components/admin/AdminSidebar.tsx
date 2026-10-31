import { useFeatureFlag, isLoyaltyPath } from "@/hooks/useFeatureFlag";
import { Link, useLocation } from "@tanstack/react-router";
import ThemeToggle from "@/components/ThemeToggle";
import { ChevronDown, ChevronLeft, ChevronRight, LogOut, Menu, PanelLeftClose, PanelLeftOpen, X, House, Route as RouteIco, IdCard, Bell, LayoutGrid, type LucideIcon } from "lucide-react";
import { isAdminAppShell } from "@/lib/app-mode";
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
  /** Mise en avant (ex. notifications non lues) : halo, cloche animée. */
  alert?: boolean;
}

interface Props {
  items: AdminSidebarItem[];
  children: ReactNode;
}

/**
 * Sidebar admin SaaS clair (cohérent avec ProSidebar).
 * Regroupement par "group" + sticky sur desktop, drawer sur mobile.
 */
export function AdminSidebar({ items: allItems, children }: Props) {
  const loyaltyOn = useFeatureFlag("compte_kilometres");
  const items = loyaltyOn ? allItems : allItems.filter((i) => !isLoyaltyPath(i.to));
  const location = useLocation();
  const { logout, user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [nativeApp, setNativeApp] = useState(false);
  useEffect(() => { setNativeApp(isAdminAppShell()); }, []);

  // Restaure la préférence (rétracté / déployé) après hydratation
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("admin-sidebar-collapsed") === "1");
    } catch { /* storage indisponible */ }
  }, []);

  // Sections repliables : "Essentiel" ouverte par défaut, la section de la page active s'ouvre seule.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ Missions: true, Convoyeurs: true });
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("admin-sidebar-groups") || "null");
      if (saved && typeof saved === "object") setOpenGroups((o) => ({ ...o, ...saved }));
    } catch { /* storage indisponible */ }
  }, []);
  const toggleGroup = (g: string) => {
    setOpenGroups((o) => {
      const next = { ...o, [g]: !o[g] };
      try { localStorage.setItem("admin-sidebar-groups", JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
  };

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
  const activeGroup = groupOrder.find((g) => groups[g].some((it) => isActive(it)));
  useEffect(() => {
    if (activeGroup) setOpenGroups((o) => (o[activeGroup] ? o : { ...o, [activeGroup]: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGroup]);

  // Onglets mobiles (raccourcis les plus utilisés sur le terrain)
  const TAB_PATHS = ["/admin", "/admin/missions", "/admin/attributions", "/admin/demandes"];
  const tabItems = TAB_PATHS
    .map((p) => items.find((i) => i.to === p))
    .filter((i): i is AdminSidebarItem => !!i)
    .map((i) => ({ ...i, label: i.label === "Tableau de bord" ? "Bord" : i.label === "Demandes de convoyage" ? "Demandes" : i.label }));


  // Appli native « Ligneo Admin » : 5 onglets fixes.
  const alertBadge = items.find((i) => i.to === "/admin/alertes")?.badge;
  const nativeTabs: { to: string; label: string; icon: LucideIcon; match: string[] }[] = [
    { to: "/admin", label: "Accueil", icon: House, match: ["/admin"] },
    { to: "/admin/missions", label: "Missions", icon: RouteIco, match: ["/admin/missions", "/admin/demandes", "/admin/devis", "/admin/candidatures"] },
    { to: "/admin/convoyeurs", label: "Convoyeurs", icon: IdCard, match: ["/admin/convoyeurs", "/admin/documents", "/admin/inscriptions"] },
    { to: "/admin/alertes", label: "Alertes", icon: Bell, match: ["/admin/alertes", "/admin/incidents", "/admin/notifications"] },
  ];
  const nativeActive = (t: { to: string; match: string[] }) =>
    t.to === "/admin"
      ? location.pathname === "/admin"
      : t.match.some((m) => location.pathname === m || location.pathname.startsWith(`${m}/`));

  const renderNav = (onClick?: () => void, mini = false) => (
    <nav className={`lig-nav flex-1 ${mini ? "p-2" : "p-3"} space-y-5 overflow-y-auto overflow-x-hidden`}>
      {groupOrder.map((g) => {
        const isOpen = mini || g === "_main" || !!openGroups[g];
        // Le « SA » du Super Admin est une simple étiquette fixe : il ne doit pas faire clignoter le point.
        const hasBadge = g !== "Super Admin" && groups[g].some((it) => !!it.badge);
        return (
        <div key={g} className="space-y-1">
          {g !== "_main" && (
            mini ? (
              <div className="mx-3 my-2 border-t border-pro-border" />
            ) : (
              <button
                type="button"
                onClick={() => toggleGroup(g)}
                aria-expanded={isOpen}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors ${isOpen ? "bg-[#2F5FFF]/10 text-[#2F5FFF] shadow-[inset_0_0_0_1px_rgba(47,95,255,0.18)]" : "text-pro-muted hover:text-[#2F5FFF] hover:bg-[#2F5FFF]/5"}`}
              >
                <span className="flex-1 text-left">{g}</span>
                {!isOpen && hasBadge && <span className="relative flex h-2.5 w-2.5" aria-label="Nouveautés"><span className="absolute inline-flex h-full w-full rounded-full bg-[#2F5FFF] opacity-75 animate-ping" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#2F5FFF] shadow-[0_0_8px_rgba(47,95,255,0.9)] animate-pulse" /></span>}
                <ChevronDown size={13} className={`transition-transform ${isOpen ? "" : "-rotate-90"}`} />
              </button>
            )
          )}
          {isOpen && groups[g].map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={onClick}
                title={mini ? item.label : undefined}
                aria-label={mini ? item.label : undefined}
                className={`lig-nav-item${active ? " is-active" : ""}${item.alert ? " lig-nav-alert" : ""}${mini ? " justify-center px-0" : ""}`}
              >
                <span className="lig-nav-ic"><item.icon size={15} /></span>
                {!mini && <span className="flex-1">{item.label}</span>}
                {!mini && item.badge}
              </Link>
            );
          })}
        </div>
        );
      })}
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
          <ThemeToggle variant={collapsed ? "compact" : "full"} className="mb-2 w-full justify-start" />
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
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white/95 backdrop-blur border-b border-pro-border safe-top">
        <div className="h-14 px-3 flex items-center justify-between gap-2">
          <LigneoBrand role="admin" variant="light" compact />
          <div className="flex items-center gap-2">
            <button
              onClick={() => logout()}
              className="w-11 h-11 rounded-xl border border-pro-border flex items-center justify-center text-pro-text-soft active:bg-pro-surface-2"
              aria-label="Déconnexion"
              title="Déconnexion"
            >
              <LogOut size={18} />
            </button>
            <button
              onClick={() => setMobileOpen(true)}
              className="w-11 h-11 rounded-xl border border-pro-border flex items-center justify-center text-pro-text-soft active:bg-pro-surface-2"
              aria-label="Menu"
            >
              <Menu size={20} />
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
              <ThemeToggle variant="full" className="mb-2 w-full justify-start" />
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

      {/* === Barre d'onglets mobile (style appli native) === */}
      {nativeApp ? (
      <nav className="admin-tabbar admin-tabbar--native lg:hidden" aria-label="Navigation principale">
        {nativeTabs.map((t) => (
          <Link key={t.to} to={t.to} className={`admin-tabbar__item${nativeActive(t) ? " is-active" : ""}`}>
            <span className="admin-tabbar__pill"><t.icon size={21} strokeWidth={2} /></span>
            <span>{t.label}</span>
            {t.to === "/admin/alertes" && alertBadge ? <em className="admin-tabbar__badge">{alertBadge}</em> : null}
          </Link>
        ))}
        <button type="button" onClick={() => setMobileOpen(true)} className="admin-tabbar__item" aria-label="Plus">
          <span className="admin-tabbar__pill"><LayoutGrid size={21} strokeWidth={2} /></span>
          <span>Plus</span>
        </button>
      </nav>
      ) : (
      <nav className="admin-tabbar lg:hidden">
        {tabItems.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`admin-tabbar__item${active ? " is-active" : ""}`}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="admin-tabbar__item"
          aria-label="Ouvrir le menu complet"
        >
          <Menu size={20} />
          <span>Menu</span>
        </button>
      </nav>
      )}

      {/* === Main === */}
      <main
        className={`dash-main-mobile flex-1 min-w-0 max-w-full ${collapsed ? "lg:ml-[76px]" : "lg:ml-64"} pt-14 lg:pt-0 min-h-screen flex flex-col transition-[margin] duration-200 ease-out`}
      >
        <DashboardHeader variant="light" enableGlobalSearch />
        <div className="p-4 sm:p-5 lg:px-6 lg:py-7 pb-28 lg:pb-7 max-w-[2000px] mx-auto w-full min-w-0 flex-1">{children}</div>
      </main>



    </div>
  );
}
