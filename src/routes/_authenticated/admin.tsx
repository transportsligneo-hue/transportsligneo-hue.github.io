import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard,
  FileText,
  Route as RouteIcon,
  IdCard,
  Send,
  FolderOpen,
  Receipt,
  MessageSquare,
  Loader2,
  Users,
  Building2,
  History,
  Shield,
  CreditCard,
  Bell,
  Handshake,
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
    if (role !== "admin" && role !== "super_admin") {
      navigate({ to: homeRoute });
    }
  }, [isLoading, isAuthenticated, role, homeRoute, navigate]);

  useEffect(() => {
    if (role !== "admin" && role !== "super_admin") return;
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
    // Pilotage
    { to: "/admin", label: "Tableau de bord", icon: LayoutDashboard, exact: true, group: "Pilotage" },
    {
      to: "/admin/notifications",
      label: "Notifications",
      icon: Bell,
      group: "Pilotage",
      badge: unreadCount > 0
        ? <span className="ml-auto px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-pro-gold text-[#0b1026]">{unreadCount > 99 ? "99+" : unreadCount}</span>
        : undefined,
    },

    // Comptes
    { to: "/admin/utilisateurs", label: "Utilisateurs", icon: Users, group: "Comptes" },
    { to: "/admin/organisations", label: "Organisations", icon: Building2, group: "Comptes" },
    { to: "/admin/convoyeurs", label: "Convoyeurs", icon: IdCard, group: "Comptes" },
    { to: "/admin/documents", label: "Documents", icon: FolderOpen, group: "Comptes" },

    // Activité commerciale
    { to: "/admin/devis", label: "Devis", icon: Receipt, group: "Activité" },
    { to: "/admin/demandes", label: "Demandes", icon: FileText, group: "Activité" },
    { to: "/admin/b2b-leads", label: "Partenariats", icon: Handshake, group: "Activité" },
    { to: "/admin/messages", label: "Messages", icon: MessageSquare, group: "Activité" },

    // Opérations
    { to: "/admin/trajets", label: "Trajets", icon: RouteIcon, group: "Opérations" },
    { to: "/admin/attributions", label: "Attributions", icon: Send, group: "Opérations" },

    // Finance
    { to: "/admin/factures", label: "Factures", icon: Receipt, group: "Finance" },
    { to: "/admin/paiements", label: "Paiements", icon: CreditCard, group: "Finance" },

    // Système
    { to: "/admin/historique", label: "Historique", icon: History, group: "Système" },
    { to: "/admin/parametres", label: "Paramètres", icon: Shield, group: "Système" },
  ];

  if (isLoading || !isAuthenticated || (role !== "admin" && role !== "super_admin")) {
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
