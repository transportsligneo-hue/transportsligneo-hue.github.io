import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { LayoutDashboard, Truck, PlusCircle, FolderOpen, UserCog, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
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
  const { isAuthenticated, user, role, isLoading } = useAuth();
  const [active, setActive] = useState<boolean | null>(null);
  const [typeClient, setTypeClient] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { setActive(null); return; }
    supabase
      .from("user_roles")
      .select("actif" as never)
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        const row = data as { actif?: boolean } | null;
        setActive(row?.actif === false ? false : true);
      });
    supabase
      .from("profiles")
      .select("type_client" as never)
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        const row = data as { type_client?: string } | null;
        setTypeClient(row?.type_client ?? "particulier");
      });
  }, [user]);

  if (isLoading || active === null) {
    return (
      <div className="min-h-screen flex items-center justify-center section-bg">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (!isAuthenticated) {
    if (typeof window !== "undefined") window.location.href = "/login";
    return null;
  }

  if (active === false) {
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

  // Si convoyeur ou admin, on redirige vers leur espace
  if (role === "admin") {
    if (typeof window !== "undefined") window.location.href = "/admin";
    return null;
  }
  if (role === "convoyeur") {
    if (typeof window !== "undefined") window.location.href = "/convoyeur";
    return null;
  }
  // Si client B2B → rediriger vers son espace dédié
  if (typeClient === "b2b") {
    if (typeof window !== "undefined") window.location.href = "/dashboard-pro";
    return null;
  }

  return (
    <DashboardSidebar title="Espace Client" subtitle="Gérez vos convoyages" items={navItems}>
      <Outlet />
    </DashboardSidebar>
  );
}
