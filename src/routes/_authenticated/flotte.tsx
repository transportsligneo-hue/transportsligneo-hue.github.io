import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Truck, Users, Calendar, Building2, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ProSidebar, type ProSidebarItem } from "@/components/dashboard-pro/ProSidebar";

export const Route = createFileRoute("/_authenticated/flotte")({
  component: FlotteLayout,
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/login" });
  },
});

const navItems: ProSidebarItem[] = [
  { to: "/flotte", label: "Vue d'ensemble", icon: LayoutDashboard, exact: true },
  { to: "/flotte/missions", label: "Missions assignées", icon: Truck },
  { to: "/flotte/conducteurs", label: "Conducteurs", icon: Users },
  { to: "/flotte/disponibilites", label: "Disponibilités", icon: Calendar },
  { to: "/flotte/societe", label: "Ma flotte", icon: Building2 },
];

function FlotteLayout() {
  const { isAuthenticated, role, isLoading, user, homeRoute } = useAuth();
  const navigate = useNavigate();
  const [orgName, setOrgName] = useState<string>("");
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) { navigate({ to: "/login" }); return; }
    if (role === "admin" || role === "super_admin") { navigate({ to: homeRoute }); return; }

    (async () => {
      if (!user) return;
      // Trouver une org de type flotte_partenaire dont l'utilisateur est membre
      const { data: mems } = await supabase
        .from("organization_members")
        .select("organization_id, organizations(legal_name, commercial_name)")
        .eq("user_id", user.id)
        .eq("status", "active");
      const orgIds = (mems ?? []).map((m) => m.organization_id);
      if (orgIds.length === 0) { navigate({ to: homeRoute }); return; }

      const { data: roles } = await supabase
        .from("organization_roles")
        .select("organization_id")
        .in("organization_id", orgIds)
        .eq("role", "flotte_partenaire")
        .eq("active", true);

      const fleetOrgId = roles?.[0]?.organization_id;
      if (!fleetOrgId) { navigate({ to: homeRoute }); return; }

      const found = (mems ?? []).find((m) => m.organization_id === fleetOrgId);
      const org = found && (found as { organizations?: { legal_name?: string; commercial_name?: string } | null }).organizations;
      setOrgName(org?.commercial_name || org?.legal_name || "Ma flotte");
      setChecking(false);
    })();
  }, [isLoading, isAuthenticated, role, user, homeRoute, navigate]);

  if (isLoading || checking || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pro-bg">
        <Loader2 className="animate-spin text-pro-accent" size={32} />
      </div>
    );
  }

  return (
    <ProSidebar items={navItems} societe={orgName}>
      <Outlet />
    </ProSidebar>
  );
}
