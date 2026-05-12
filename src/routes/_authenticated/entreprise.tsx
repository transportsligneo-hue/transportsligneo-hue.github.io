import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Truck, Users, Building2, FileText, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ProSidebar, type ProSidebarItem } from "@/components/dashboard-pro/ProSidebar";

export const Route = createFileRoute("/_authenticated/entreprise")({
  component: EntrepriseLayout,
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/login" });
  },
});

const navItems: ProSidebarItem[] = [
  { to: "/entreprise", label: "Vue d'ensemble", icon: LayoutDashboard, exact: true },
  { to: "/entreprise/missions", label: "Missions", icon: Truck },
  { to: "/entreprise/membres", label: "Membres", icon: Users },
  { to: "/entreprise/factures", label: "Factures", icon: FileText },
  { to: "/entreprise/societe", label: "Ma société", icon: Building2 },
];

function EntrepriseLayout() {
  const { isAuthenticated, role, isLoading, user, homeRoute } = useAuth();
  const navigate = useNavigate();
  const [orgName, setOrgName] = useState<string>("");
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      navigate({ to: "/login" });
      return;
    }
    if (role === "admin" || role === "super_admin" || role === "convoyeur") {
      navigate({ to: homeRoute });
      return;
    }

    (async () => {
      if (!user) return;
      const { data: mem } = await supabase
        .from("organization_members")
        .select("organization_id, organizations(legal_name, commercial_name)")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      if (!mem) {
        navigate({ to: "/dashboard-pro" });
        return;
      }
      const org = (mem as { organizations?: { legal_name?: string; commercial_name?: string } | null }).organizations;
      setOrgName(org?.commercial_name || org?.legal_name || "Mon entreprise");
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
