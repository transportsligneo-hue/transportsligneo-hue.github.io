import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Truck, FileText, Building2, PlusCircle, Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ProSidebar, type ProSidebarItem } from "@/components/dashboard-pro/ProSidebar";

export const Route = createFileRoute("/_authenticated/dashboard-pro")({
  component: ProLayout,
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/login" });
  },
});

const navItems: ProSidebarItem[] = [
  { to: "/dashboard-pro", label: "Vue d'ensemble", icon: LayoutDashboard, exact: true },
  { to: "/dashboard-pro/missions", label: "Missions", icon: Truck },
  { to: "/dashboard-pro/nouvelle-demande", label: "Nouvelle mission", icon: PlusCircle },
  { to: "/dashboard-pro/documents", label: "Factures & devis", icon: FileText },
  { to: "/dashboard-pro/societe", label: "Ma société", icon: Building2 },
];

function ProLayout() {
  const { isAuthenticated, role, typeClient, isLoading, homeRoute } = useAuth();
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
    // Client mais pas B2B → renvoi vers espace particulier
    if (typeClient !== "b2b") {
      navigate({ to: "/dashboard-client" });
    }
  }, [isLoading, isAuthenticated, role, typeClient, homeRoute, navigate]);

  if (isLoading || !isAuthenticated || role === "admin" || role === "convoyeur" || typeClient !== "b2b") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pro-bg">
        <Loader2 className="animate-spin text-pro-accent" size={32} />
      </div>
    );
  }

  return (
    <ProSidebar items={navItems}>
      <Outlet />
    </ProSidebar>
  );
}
