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
  Bell,
} from "lucide-react";
import { useEffect, useState } from "react";
import { AdminSidebar, type AdminSidebarItem } from "@/components/admin/AdminSidebar";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const { isAuthenticated, role, isLoading, homeRoute } = useAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

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

  useEffect(() => {
    if (role !== "admin") return;
    const fetchUnread = async () => {
      const { count } = await supabase
        .from("admin_notifications" as never)
        .select("id", { count: "exact", head: true })
        .eq("lu" as never, false as never);
      setUnreadCount(count ?? 0);
    };
    fetchUnread();
    const channel = supabase
      .channel("admin-notif-badge")
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_notifications" }, fetchUnread)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [role]);

  const navItems: AdminSidebarItem[] = [
    { to: "/admin", label: "Tableau de bord", icon: LayoutDashboard, exact: true },
    {
      to: "/admin/notifications",
      label: "Notifications",
      icon: Bell,
      badge: unreadCount > 0
        ? <span className="ml-auto px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-pro-gold text-[#0b1026]">{unreadCount > 99 ? "99+" : unreadCount}</span>
        : undefined,
    },

    // Hub Comptes
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
    { to: "/admin/factures", label: "Factures", icon: Receipt, group: "Finance" },
    { to: "/admin/paiements", label: "Paiements & facturation", icon: CreditCard, group: "Finance" },

    // Système
    { to: "/admin/historique", label: "Historique & activité", icon: History, group: "Système" },
    { to: "/admin/parametres", label: "Paramètres & rôles", icon: Shield, group: "Système" },
  ];

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
