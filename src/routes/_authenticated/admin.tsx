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
  MessageSquare,
  Loader2,
} from "lucide-react";
import { AdminSidebar, type AdminSidebarItem } from "@/components/admin/AdminSidebar";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

const navItems: AdminSidebarItem[] = [
  { to: "/admin", label: "Tableau de bord", icon: LayoutDashboard, exact: true },

  { to: "/admin/demandes", label: "Demandes convoyage", icon: FileText, group: "Commercial" },
  { to: "/admin/messages", label: "Messages & contacts", icon: MessageSquare, group: "Commercial" },
  { to: "/admin/devis", label: "Devis", icon: Receipt, group: "Commercial" },

  { to: "/admin/clients", label: "Clients", icon: UserRound, group: "Comptes" },
  { to: "/admin/convoyeurs", label: "Convoyeurs", icon: IdCard, group: "Comptes" },
  { to: "/admin/documents", label: "Documents convoyeurs", icon: FolderOpen, group: "Comptes" },

  { to: "/admin/trajets", label: "Trajets", icon: RouteIcon, group: "Opérations" },
  { to: "/admin/attributions", label: "Attributions", icon: Send, group: "Opérations" },
];

function AdminLayout() {
  const { isAuthenticated, role, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pro-bg">
        <Loader2 className="animate-spin text-pro-accent" size={32} />
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
    <AdminSidebar items={navItems}>
      <Outlet />
    </AdminSidebar>
  );
}
