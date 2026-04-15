import { createFileRoute, Outlet, Link, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard,
  Truck,
  FolderOpen,
  History,
  LogOut,
  Loader2,
  Menu,
  X,
} from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/convoyeur")({
  component: ConvoyeurLayout,
});

const navItems = [
  { to: "/convoyeur", label: "Tableau de bord", icon: LayoutDashboard, exact: true },
  { to: "/convoyeur/missions", label: "Mes missions", icon: Truck },
  { to: "/convoyeur/documents", label: "Mes documents", icon: FolderOpen },
  { to: "/convoyeur/historique", label: "Historique", icon: History },
];

function ConvoyeurLayout() {
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

  if (!isAuthenticated) {
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    return null;
  }

  if (role !== "convoyeur") {
    return (
      <div className="min-h-screen flex items-center justify-center section-bg px-4">
        <div className="text-center space-y-4">
          <h1 className="font-heading text-xl text-primary tracking-[0.1em] uppercase">Accès non autorisé</h1>
          <p className="text-cream/50 text-sm">Votre compte est en attente de validation par notre équipe.</p>
          <a href="/" className="inline-block text-primary text-sm hover:text-gold-light transition-colors">← Retour au site</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex section-bg">
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-navy/95 border-b border-primary/20 px-4 py-3 flex items-center justify-between backdrop-blur-sm">
        <span className="font-heading text-primary text-sm tracking-[0.1em] uppercase">Espace Convoyeur</span>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-cream/70">
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-64 bg-navy/80 border-r border-primary/20 flex flex-col transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        } md:translate-x-0 pt-14 md:pt-0`}
      >
        <div className="p-6 border-b border-primary/20 hidden md:block">
          <h2 className="font-heading text-primary text-lg tracking-[0.1em] uppercase">Espace Convoyeur</h2>
          <p className="text-cream/40 text-xs mt-1">Mes missions & documents</p>
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

      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <main className="flex-1 overflow-auto pt-14 md:pt-0">
        <div className="p-6 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
