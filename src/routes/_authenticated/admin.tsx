import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
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
  Truck,
  Briefcase,
  Users,
  Building2,
  History,
  Shield,
  CreditCard,
} from "lucide-react";
import { useEffect } from "react";
import { AdminSidebar, type AdminSidebarItem } from "@/components/admin/AdminSidebar";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

const navItems: AdminSidebarItem[] = [
  { to: "/admin", label: "Tableau de bord", icon: LayoutDashboard, exact: true },

  // Hub Comptes — vue centralisée
  { to: "/admin/utilisateurs", label: "Utilisateurs & comptes", icon: Users, group: "Comptes" },
  { to: "/admin/organisations", label: "Organisations", icon: Building2, group: "Comptes" },
  { to: "/admin/clients", label: "Clients particuliers", icon: UserRound, group: "Comptes" },
  { to: "/admin/convoyeurs", label: "Convoyeurs", icon: IdCard, group: "Comptes" },
  { to: "/admin/documents", label: "Documents convoyeurs", icon: FolderOpen, group: "Comptes" },

  // Commercial
  { to: "/admin/demandes", label: "Demandes convoyage", icon: FileText, group: "Commercial" },
  { to: "/admin/messages", label: "Messages & contacts", icon: MessageSquare, group: "Commercial" },
  { to: "/admin/devis", label: "Devis", icon: Receipt, group: "Commercial" },

  // B2B
  { to: "/admin/b2b-dispatch", label: "Dispatch B2B", icon: Truck, group: "B2B" },
  { to: "/admin/b2b-leads", label: "CRM Flotte", icon: Briefcase, group: "B2B" },

  // Opérations
  { to: "/admin/trajets", label: "Trajets", icon: RouteIcon, group: "Opérations" },
  { to: "/admin/attributions", label: "Attributions", icon: Send, group: "Opérations" },

  // Finance
  { to: "/admin/paiements", label: "Paiements & facturation", icon: CreditCard, group: "Finance" },

  // Système
  { to: "/admin/historique", label: "Historique & activité", icon: History, group: "Système" },
  { to: "/admin/parametres", label: "Paramètres & rôles", icon: Shield, group: "Système" },
];

function AdminLayout() {
  const { isAuthenticated, role, isLoading, homeRoute } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      navigate({ to: "/login" });
      return;
    }
    if (role !== "admin") {
      navigate({ to: homeRoute });
    }
  }, [isLoading, isAuthenticated, role, homeRoute, navigate]);

  if (isLoading || !isAuthenticated || role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pro-bg">
        <Loader2 className="animate-spin text-pro-accent" size={32} />
      </div>
    );
  }

  return (
    <AdminSidebar items={navItems}>
      <Outlet />
    </AdminSidebar>
  );
}
