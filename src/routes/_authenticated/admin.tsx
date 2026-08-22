import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
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
  Users,
  Building2,
  History,
  Shield,
  CreditCard,
  Bell,
  Handshake,
  UserRound,
  PenLine,
  Radar,
  Megaphone,
  GraduationCap,
  Sparkles,
  Crown,
  ClipboardList,
  AlertTriangle,
  Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";
import { AdminSidebar, type AdminSidebarItem } from "@/components/admin/AdminSidebar";
import { supabase } from "@/integrations/supabase/client";
import { LogoLoader } from "@/components/brand/LogoLoader";
import { verifyAdminAccess } from "@/lib/admin-guard.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    // Le SSR n'a pas de session : on laisse le client faire la vérification,
    // sinon un simple refresh renvoie vers l'accueil.
    if (typeof window === "undefined") return;
    try {
      await verifyAdminAccess();
    } catch {
      // Not an admin — redirect to the public home before rendering any admin UI.
      throw redirect({ to: "/" });
    }
  },
  component: AdminLayout,
});

function AdminLayout() {
  const { isAuthenticated, role, isLoading, homeRoute } = useAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    if (role !== "admin" && role !== "super_admin") return;
    const fetchAlerts = async () => {
      const { count } = await supabase
        .from("mission_alerts" as never)
        .select("id", { count: "exact", head: true })
        .in("status" as never, ["open", "acknowledged"] as never);
      setAlertCount(count ?? 0);
    };
    fetchAlerts();
    const channel = supabase
      .channel("admin-alert-badge")
      .on("postgres_changes", { event: "*", schema: "public", table: "mission_alerts" }, fetchAlerts)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [role]);

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
        ? <span className="lig-nav-badge ml-auto px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-pro-gold text-[#0b1026]">{unreadCount > 99 ? "99+" : unreadCount}</span>
        : undefined,
    },
    { to: "/admin/communication", label: "Emails & push", icon: Megaphone, group: "Pilotage" },
    { to: "/admin/test-notifications", label: "Test notifications", icon: Bell, group: "Pilotage" },


    // Marketing
    { to: "/admin/campagnes", label: "Campagnes", icon: Megaphone, group: "Marketing" },

    // Comptes
    { to: "/admin/utilisateurs", label: "Utilisateurs", icon: Users, group: "Comptes" },
    { to: "/admin/clients", label: "Clients", icon: UserRound, group: "Comptes" },
    { to: "/admin/organisations", label: "Organisations", icon: Building2, group: "Comptes" },
    { to: "/admin/convoyeurs", label: "Convoyeurs", icon: IdCard, group: "Comptes" },
    { to: "/admin/inscriptions", label: "Suivi inscriptions", icon: ClipboardList, group: "Comptes" },
    { to: "/admin/documents", label: "Documents", icon: FolderOpen, group: "Comptes" },
    { to: "/admin/formation", label: "Formation", icon: GraduationCap, group: "Comptes" },

    // Activité commerciale
    { to: "/admin/devis", label: "Devis", icon: Receipt, group: "Activité" },
    { to: "/admin/acceptations", label: "Preuves d'acceptation", icon: PenLine, group: "Activité" },
    { to: "/admin/b2b-leads", label: "Partenariats", icon: Handshake, group: "Activité" },
    { to: "/admin/messages", label: "Messages", icon: MessageSquare, group: "Activité" },
    { to: "/admin/assistant-ia", label: "Assistant IA", icon: MessageSquare, group: "Activité" },

    // Opérations
    { to: "/admin/exploitation", label: "Exploitation (live)", icon: Radar, group: "Opérations" },
    {
      to: "/admin/alertes",
      label: "Alertes opérationnelles",
      icon: AlertTriangle,
      group: "Opérations",
      badge: alertCount > 0
        ? <span className="lig-nav-badge ml-auto px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-red-500 text-white">{alertCount > 99 ? "99+" : alertCount}</span>
        : undefined,
    },
    { to: "/admin/incidents", label: "Registre des incidents", icon: AlertTriangle, group: "Opérations" },
    { to: "/admin/missions", label: "Missions", icon: RouteIcon, group: "Opérations" },

    { to: "/admin/attributions", label: "Attributions", icon: ClipboardList, group: "Opérations" },
    { to: "/admin/candidatures", label: "Marketplace Missions", icon: Handshake, group: "Opérations" },


    // Finance
    { to: "/admin/factures", label: "Factures", icon: Receipt, group: "Finance" },
    { to: "/admin/paiements", label: "Paiements clients", icon: CreditCard, group: "Finance" },
    { to: "/admin/paiements-convoyeurs", label: "Paiements convoyeurs", icon: Wallet, group: "Finance" },
    { to: "/admin/fidelite", label: "Compte Kilomètres", icon: Gauge, group: "Finance" },
    { to: "/admin/informations-legales", label: "Informations légales", icon: Building2, group: "Finance" },

    // Système
    { to: "/admin/contenu", label: "Contenu du site", icon: FileText, group: "Système" },
    { to: "/admin/historique", label: "Historique", icon: History, group: "Système" },
    { to: "/admin/parametres", label: "Paramètres", icon: Shield, group: "Système" },
    { to: "/admin/parametres-ia", label: "Paramètres IA", icon: Sparkles, group: "Système" },
  ];

  // Section Super Admin : visible uniquement pour super_admin
  if (role === "super_admin") {
    navItems.push({
      to: "/admin/super-admin",
      label: "Super Admin",
      icon: Crown,
      group: "Super Admin",
      badge: <span className="lig-nav-badge ml-auto px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-purple-600 text-white uppercase tracking-wider">SA</span>,
    });
  }

  if (isLoading || !isAuthenticated || (role !== "admin" && role !== "super_admin")) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pro-bg">
        <LogoLoader label="Connexion à l'administration…" />
      </div>
    );
  }

  return (
    <AdminSidebar items={navItems}>
      <Outlet />
    </AdminSidebar>
  );
}
