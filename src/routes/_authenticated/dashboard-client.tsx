import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Truck, PlusCircle, FolderOpen, UserCog, Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { DashboardSidebar, type SidebarItem } from "@/components/dashboard/DashboardSidebar";

export const Route = createFileRoute("/_authenticated/dashboard-client")({
  component: ClientLayout,
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/login" });
  },
});

const navItems: SidebarItem[] = [
  { to: "/dashboard-client", label: "Tableau de bord", icon: LayoutDashboard, exact: true },
  { to: "/dashboard-client/missions", label: "Mes missions", icon: Truck },
  { to: "/dashboard-client/nouvelle-reservation", label: "Nouvelle réservation", icon: PlusCircle },
  { to: "/dashboard-client/documents", label: "Mes documents", icon: FolderOpen },
  { to: "/dashboard-client/profil", label: "Mon profil", icon: UserCog },
];

function ClientLayout() {
  const { isAuthenticated, role, roleActif, typeClient, isLoading, homeRoute } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      navigate({ to: "/login" });
      return;
    }
    if (role === "admin" || role === "convoyeur") {
      navigate({ to: homeRoute });
      return;
    }
    if (typeClient === "b2b") {
      navigate({ to: "/dashboard-pro" });
    }
  }, [isLoading, isAuthenticated, role, typeClient, homeRoute, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center section-bg">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (!roleActif) {
    return (
      <div className="min-h-screen flex items-center justify-center section-bg px-4">
        <div className="text-center space-y-4 max-w-md">
          <h1 className="font-heading text-xl text-destructive tracking-[0.1em] uppercase">Compte suspendu</h1>
          <p className="text-cream/50 text-sm">
            Votre compte a été suspendu. Contactez notre équipe pour plus d'informations.
          </p>
          <a href="mailto:contact@transportsligneo.fr" className="inline-block text-primary text-sm hover:text-gold-light transition-colors">
            contact@transportsligneo.fr
          </a>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || role === "admin" || role === "convoyeur" || typeClient === "b2b") {
    return (
      <div className="min-h-screen flex items-center justify-center section-bg">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <DashboardSidebar title="Espace Client" subtitle="Gérez vos convoyages" items={navItems}>
      <Outlet />
    </DashboardSidebar>
  );
}
