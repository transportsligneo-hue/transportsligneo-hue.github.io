import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { LayoutDashboard, Truck, FileText, Building2, PlusCircle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
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
  const { isAuthenticated, user, role, isLoading } = useAuth();
  const [societe, setSociete] = useState<string>("");
  const [typeClient, setTypeClient] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!user) { setChecking(false); return; }
    supabase
      .from("profiles")
      .select("societe, type_client" as never)
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        const row = data as { societe?: string; type_client?: string } | null;
        setSociete(row?.societe ?? "");
        setTypeClient(row?.type_client ?? "particulier");
        setChecking(false);
      });
  }, [user]);

  if (isLoading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pro-bg">
        <Loader2 className="animate-spin text-pro-accent" size={32} />
      </div>
    );
  }

  if (!isAuthenticated) {
    if (typeof window !== "undefined") window.location.href = "/login";
    return null;
  }

  if (role === "admin") {
    if (typeof window !== "undefined") window.location.href = "/admin";
    return null;
  }
  if (role === "convoyeur") {
    if (typeof window !== "undefined") window.location.href = "/convoyeur";
    return null;
  }

  // Si pas B2B → rediriger vers l'espace particulier
  if (typeClient !== "b2b") {
    if (typeof window !== "undefined") window.location.href = "/dashboard-client";
    return null;
  }

  return (
    <ProSidebar societe={societe} items={navItems}>
      <Outlet />
    </ProSidebar>
  );
}
