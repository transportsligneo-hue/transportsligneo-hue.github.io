import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { Gauge, LayoutDashboard, Truck, FileText, Building2, PlusCircle, Loader2, MapPin, Car, Users, Code2 } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ProSidebar, type ProSidebarItem } from "@/components/dashboard-pro/ProSidebar";
import { useCurrentOrgAccountType } from "@/hooks/useCurrentOrgAccountType";

export const Route = createFileRoute("/_authenticated/dashboard-pro")({
  component: ProLayout,
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/login" });
  },
});

function buildNavItems(accountType: "b2b_standard" | "flotte"): ProSidebarItem[] {
  const base: ProSidebarItem[] = [
    { to: "/dashboard-pro", label: "Vue d'ensemble", icon: LayoutDashboard, exact: true },
    { to: "/dashboard-pro/missions", label: "Missions", icon: Truck },
    { to: "/dashboard-pro/nouvelle-mission", label: "Nouvelle mission", icon: PlusCircle },
    { to: "/dashboard-pro/adresses", label: "Mes adresses", icon: MapPin },
  ];
  // Section Flotte : véhicules + conducteurs, réservée aux comptes Flotte
  if (accountType === "flotte") {
    base.push(
      { to: "/dashboard-pro/flotte", label: "Parc véhicules", icon: Car },
      { to: "/dashboard-pro/conducteurs", label: "Conducteurs", icon: Users },
    );
  }
  base.push(
    { to: "/dashboard-pro/documents", label: "Factures & devis", icon: FileText },
    { to: "/dashboard-pro/fidelite", label: "Compte Kilomètres", icon: Gauge },
    { to: "/dashboard-pro/api", label: "API & Intégrations", icon: Code2 },
    { to: "/dashboard-pro/societe", label: "Ma société", icon: Building2 },
  );
  return base;
}

function ProLayout() {
  const { isAuthenticated, isLoading, homeRoute } = useAuth();
  const navigate = useNavigate();
  const { data: orgInfo } = useCurrentOrgAccountType();
  const accountType = orgInfo?.accountType ?? "b2b_standard";
  const navItems = useMemo(() => buildNavItems(accountType), [accountType]);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      navigate({ to: "/login" });
      return;
    }
    if (homeRoute !== "/dashboard-pro") {
      navigate({ to: homeRoute, replace: true });
    }
  }, [isLoading, isAuthenticated, role, typeClient, homeRoute, navigate]);

  if (isLoading || !isAuthenticated || homeRoute !== "/dashboard-pro") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pro-bg">
        <Loader2 className="animate-spin text-pro-accent" size={32} />
      </div>
    );
  }

  return (
    <div className="dashboard-shell-light" data-account-type={accountType}>
      <ProSidebar items={navItems}>
        <Outlet />
      </ProSidebar>
    </div>
  );
}
