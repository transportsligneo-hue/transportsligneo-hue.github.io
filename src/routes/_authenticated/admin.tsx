import { createFileRoute, Outlet, Link, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard,
  FileText,
  Route as RouteIcon,
  Users,
  Send,
  FolderOpen,
  Receipt,
  LogOut,
  Loader2,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

const navItems = [
  { to: "/admin", label: "Tableau de bord", icon: LayoutDashboard, exact: true },
  { to: "/admin/demandes", label: "Demandes", icon: FileText },
  { to: "/admin/devis", label: "Devis", icon: Receipt },
  { to: "/admin/trajets", label: "Trajets", icon: RouteIcon },
  { to: "/admin/convoyeurs", label: "Convoyeurs", icon: Users },
  { to: "/admin/attributions", label: "Attributions", icon: Send },
  { to: "/admin/documents", label: "Documents", icon: FolderOpen },
];

function AdminLayout() {
  const { isAuthenticated, role, isLoading, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center section-bg">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (!isAuthenticated || role !== "admin") {
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    return null;
  }

  return (
    <div className="min-h-screen flex section-bg">
      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-navy/95 border-b border-primary/20 px-4 py-3 flex items-center justify-between backdrop-blur-sm">
        <span className="font-heading text-primary text-sm tracking-[0.1em] uppercase">Admin Ligneo</span>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-cream/70">
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-64 bg-navy/80 border-r border-primary/20 flex flex-col transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        } md:translate-x-0 pt-14 md:pt-0`}
      >
        <div className="p-6 border-b border-primary/20 hidden md:block">
          <h2 className="font-heading text-primary text-lg tracking-[0.1em] uppercase">Admin Ligneo</h2>
          <p className="text-cream/40 text-xs mt-1">Espace administrateur</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = item.exact
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded text-sm transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-cream/60 hover:text-cream hover:bg-primary/5"
                }`}
              >
                <item.icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-primary/20">
          <button
            onClick={() => logout()}
            className="flex items-center gap-3 px-4 py-2.5 rounded text-sm text-cream/60 hover:text-destructive hover:bg-destructive/10 transition-colors w-full"
          >
            <LogOut size={18} />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Backdrop mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <main className="flex-1 overflow-auto pt-14 md:pt-0">
        <div className="p-6 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
