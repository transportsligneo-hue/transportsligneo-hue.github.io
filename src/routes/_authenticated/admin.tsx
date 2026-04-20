import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard,
  FileText,
  Route as RouteIcon,
  UserRound,
  IdCard,
  Send,
  FolderOpen,
  Receipt,
  Loader2,
} from "lucide-react";
import { DashboardSidebar, type SidebarItem } from "@/components/dashboard/DashboardSidebar";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

const navItems: SidebarItem[] = [
  { to: "/admin", label: "Tableau de bord", icon: LayoutDashboard, exact: true },

  // Groupe Demandes commerciales
  { to: "/admin/demandes", label: "Demandes", icon: FileText },
  { to: "/admin/devis", label: "Devis", icon: Receipt },

  // Groupe Clients
  { to: "/admin/clients", label: "Clients", icon: UserRound },

  // Groupe Convoyeurs
  { to: "/admin/convoyeurs", label: "Convoyeurs", icon: IdCard },
  { to: "/admin/documents", label: "Documents convoyeurs", icon: FolderOpen },

  // Groupe Missions / Trajets
  { to: "/admin/trajets", label: "Trajets", icon: RouteIcon },
  { to: "/admin/attributions", label: "Attributions", icon: Send },
  // Note : /admin/missions n'existe pas encore, on garde Attributions comme vue missions
];

function AdminLayout() {
  const { isAuthenticated, role, isLoading } = useAuth();

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
    <DashboardSidebar
      title="Admin Ligneo"
      subtitle="Espace administrateur"
      items={navItems}
    >
      <Outlet />
    </DashboardSidebar>
  );
}
