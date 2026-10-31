import { isDemoRow } from "@/hooks/useMissionAlerts";
import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { getDemandesSeenAt, onDemandesSeen } from "@/lib/admin/demandes-seen";
import {
  LayoutDashboard,
  Car,
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
  FileSignature,
  Radar,
  GraduationCap,
  Megaphone,
  Smartphone,
  Sparkles,
  Crown,
  ClipboardList,
  Hourglass,
  AlertTriangle,
  Wallet,
  Gauge,
  Inbox,
  FileCheck2,
  ScanLine,
  Wrench,
  Calculator,


} from "lucide-react";
import { useEffect, useState } from "react";
import { AdminSidebar, type AdminSidebarItem } from "@/components/admin/AdminSidebar";
import { supabase } from "@/integrations/supabase/client";
import { LogoLoader } from "@/components/brand/LogoLoader";
import { verifyAdminAccess } from "@/lib/admin-guard.functions";
import { AdminMfaGate } from "@/components/admin/AdminMfaGate";

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
  const [demandesCount, setDemandesCount] = useState(0);
  const [poCount, setPoCount] = useState(0);
  const [fraisCount, setFraisCount] = useState(0);

  useEffect(() => {
    if (role !== "admin" && role !== "super_admin") return;
    const fetchFrais = async () => {
      const { count } = await supabase
        .from("frais_mission" as never)
        .select("id", { count: "exact", head: true })
        .eq("statut" as never, "attente" as never);
      setFraisCount(count ?? 0);
    };
    void fetchFrais();
    const channel = supabase
      .channel("admin-frais-badge")
      .on("postgres_changes", { event: "*", schema: "public", table: "frais_mission" }, fetchFrais)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [role]);

  useEffect(() => {
    if (role !== "admin" && role !== "super_admin") return;
    const fetchPo = async () => {
      const { count } = await supabase
        .from("bons_commande" as never)
        .select("id", { count: "exact", head: true })
        .in("statut" as never, ["ambigu", "erreur_extraction"] as never);
      setPoCount(count ?? 0);
    };
    fetchPo();
    const channel = supabase
      .channel("admin-po-badge")
      .on("postgres_changes", { event: "*", schema: "public", table: "bons_commande" }, fetchPo)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [role]);


  useEffect(() => {
    if (role !== "admin" && role !== "super_admin") return;
    const fetchDemandes = async () => {
      const seenAt = getDemandesSeenAt();
      let q = supabase
        .from("demandes_convoyage" as never)
        .select("id", { count: "exact", head: true });
      if (seenAt) q = q.gt("created_at" as never, seenAt as never);
      const { count } = await q;
      setDemandesCount(count ?? 0);
    };
    fetchDemandes();
    const off = onDemandesSeen(() => { void fetchDemandes(); });
    const channel = supabase
      .channel("admin-demandes-badge")
      .on("postgres_changes", { event: "*", schema: "public", table: "demandes_convoyage" }, fetchDemandes)
      .subscribe();
    return () => { off(); supabase.removeChannel(channel); };
  }, [role]);


  useEffect(() => {
    if (role !== "admin" && role !== "super_admin") return;
    const fetchAlerts = async () => {
      const { data } = await supabase
        .from("mission_alerts" as never)
        .select("id, attributions!inner(trajets(is_test_data, client_email, client_nom, immatriculation, vehicule_immatriculation))" as never)
        .in("status" as never, ["open", "acknowledged"] as never);
      // Les alertes de missions démo / test ne comptent pas.
      setAlertCount(((data as unknown as any[]) ?? []).filter((r) => !isDemoRow(r)).length);
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

  const rawNavItems: AdminSidebarItem[] = [
    // Essentiel (sans titre, toujours visible)
    { to: "/admin", label: "Tableau de bord", icon: LayoutDashboard, exact: true },
    {
      to: "/admin/demandes",
      label: "Demandes de convoyage",
      icon: Inbox,
      badge: demandesCount > 0
        ? <span className="lig-nav-badge ml-auto px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-[#2F5FFF] text-white">{demandesCount > 99 ? "99+" : demandesCount}</span>
        : undefined,
    },
    { to: "/admin/missions", label: "Missions", icon: RouteIcon },
    { to: "/admin/devis", label: "Devis", icon: Receipt },
    { to: "/admin/factures", label: "Factures", icon: Receipt },
    {
      to: "/admin/frais",
      label: "Frais de mission",
      icon: Receipt,
      badge: fraisCount > 0
        ? <span className="lig-nav-badge ml-auto px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-[#2F5FFF] text-white">{fraisCount > 99 ? "99+" : fraisCount}</span>
        : undefined,
    },
    {
      to: "/admin/notifications",
      label: "Notifications",
      icon: Bell,
      alert: unreadCount > 0,
      badge: unreadCount > 0
        ? <span className="lig-nav-badge lig-notif-badge ml-auto" aria-label={`${unreadCount} notification(s) non lue(s)`}><i aria-hidden="true" />{unreadCount > 99 ? "99+" : unreadCount}</span>
        : undefined,
    },

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
    { to: "/admin/remarketing", label: "Remarketing", icon: Car, group: "Opérations" },
    { to: "/admin/incidents", label: "Registre des incidents", icon: AlertTriangle, group: "Opérations" },
    { to: "/admin/candidatures", label: "Marketplace Missions", icon: Handshake, group: "Opérations" },
    { to: "/admin/messagerie", label: "Chat des missions", icon: MessageSquare, group: "Opérations" },
    { to: "/admin/messagerie-conseiller", label: "Chat conseiller", icon: MessageSquare, group: "Opérations" },
    { to: "/admin/messages", label: "Messages", icon: MessageSquare, group: "Opérations" },

    // Clients & convoyeurs
    { to: "/admin/clients", label: "Clients", icon: UserRound, group: "Clients & convoyeurs" },
    { to: "/admin/organisations", label: "Organisations", icon: Building2, group: "Clients & convoyeurs" },
    { to: "/admin/convoyeurs", label: "Convoyeurs", icon: IdCard, group: "Clients & convoyeurs" },
    { to: "/admin/liste-attente", label: "Liste d'attente", icon: Hourglass, group: "Clients & convoyeurs" },
    { to: "/admin/inscriptions", label: "Suivi inscriptions", icon: ClipboardList, group: "Clients & convoyeurs" },
    { to: "/admin/documents", label: "Documents", icon: FolderOpen, group: "Clients & convoyeurs" },
    { to: "/admin/formation", label: "Formation", icon: GraduationCap, group: "Clients & convoyeurs" },
    { to: "/admin/infos-ligneo", label: "Infos Ligneo", icon: Megaphone, group: "Clients & convoyeurs" },
    { to: "/admin/mises-a-jour-driver", label: "Mises à jour Driver", icon: Smartphone, group: "Clients & convoyeurs" },
    {
      to: "/admin/bons-commande",
      label: "Bons de commande",
      icon: FileCheck2,
      group: "Clients & convoyeurs",
      badge: poCount > 0
        ? <span className="lig-nav-badge ml-auto px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-500 text-[#0b1026]">{poCount > 99 ? "99+" : poCount}</span>
        : undefined,
    },
    { to: "/admin/acceptations", label: "Preuves d'acceptation", icon: PenLine, group: "Clients & convoyeurs" },
    { to: "/admin/contrats-convoyeurs", label: "Contrats convoyeurs", icon: FileSignature, group: "Clients & convoyeurs" },
    { to: "/admin/signatures", label: "Signatures électroniques", icon: FileSignature, group: "Clients & convoyeurs" },
    { to: "/admin/b2b-leads", label: "Partenariats", icon: Handshake, group: "Clients & convoyeurs" },
    { to: "/admin/acces-demo", label: "Accès démo", icon: Send, group: "Clients & convoyeurs" },

    // Finance
    { to: "/admin/paiements", label: "Paiements clients", icon: CreditCard, group: "Finance" },
    { to: "/admin/paiements-convoyeurs", label: "Paiements convoyeurs", icon: Wallet, group: "Finance" },
    { to: "/admin/fidelite", label: "Compte Kilomètres", icon: Gauge, group: "Finance" },
    { to: "/admin/informations-legales", label: "Informations légales", icon: Building2, group: "Finance" },

    // Réglages & outils
    { to: "/admin/communication", label: "Emails & push", icon: Megaphone, group: "Réglages & outils" },
    { to: "/admin/test-notifications", label: "Test notifications", icon: Bell, group: "Réglages & outils" },
    { to: "/admin/campagnes", label: "Campagnes", icon: Megaphone, group: "Réglages & outils" },
    { to: "/admin/utilisateurs", label: "Utilisateurs", icon: Users, group: "Réglages & outils" },
    { to: "/admin/catalogue-vehicules", label: "Catalogue véhicules", icon: Gauge, group: "Réglages & outils" },
    { to: "/admin/contenu", label: "Contenu du site", icon: FileText, group: "Réglages & outils" },
    { to: "/admin/grille-tarifaire", label: "Grille tarifaire & fiche équipe", icon: Calculator, group: "Réglages & outils" },
    { to: "/admin/historique", label: "Historique", icon: History, group: "Réglages & outils" },
    { to: "/admin/parametres", label: "Paramètres", icon: Shield, group: "Réglages & outils" },
    { to: "/admin/parametres-ia", label: "Paramètres IA", icon: Sparkles, group: "Réglages & outils" },
    { to: "/admin/assistant-ia", label: "Assistant IA", icon: MessageSquare, group: "Réglages & outils" },
    { to: "/admin/scan-document", label: "Scanner un document", icon: ScanLine, group: "Réglages & outils" },
    { to: "/admin/outils-externes", label: "Outils externes client", icon: Wrench, group: "Réglages & outils" },
    { to: "/admin/maintenance", label: "Mise à jour et maintenance", icon: Wrench, group: "Réglages & outils" },

  ];

  // Regroupement simplifié du menu : 6 rubriques claires (aucune page supprimée).
  const MENU_GROUPS: Record<string, string[]> = {
    Missions: ["demandes", "missions", "devis", "exploitation", "alertes", "incidents", "candidatures", "remarketing", "bons-commande", "acceptations"],
    Convoyeurs: ["convoyeurs", "liste-attente", "inscriptions", "contrats-convoyeurs", "documents", "formation", "paiements-convoyeurs", "mises-a-jour-driver"],
    Clients: ["clients", "organisations", "b2b-leads", "acces-demo", "fidelite"],
    Finances: ["factures", "paiements", "frais", "signatures", "grille-tarifaire", "informations-legales"],
    Communication: ["notifications", "messagerie", "messagerie-conseiller", "messages", "communication", "campagnes", "infos-ligneo", "test-notifications"],
    Réglages: ["utilisateurs", "catalogue-vehicules", "contenu", "historique", "parametres", "parametres-ia", "assistant-ia", "scan-document", "outils-externes", "maintenance"],
  };
  const MENU_ORDER = ["_main", ...Object.keys(MENU_GROUPS)];
  const navItems: AdminSidebarItem[] = rawNavItems
    .map((it) => {
      const slug = it.to.replace("/admin/", "");
      const g = Object.keys(MENU_GROUPS).find((k) => MENU_GROUPS[k].includes(slug));
      return g ? { ...it, group: g } : { ...it, group: it.to === "/admin" ? undefined : it.group };
    })
    .sort((a, b) => MENU_ORDER.indexOf(a.group ?? "_main") - MENU_ORDER.indexOf(b.group ?? "_main"));

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
    <AdminMfaGate>
      <AdminSidebar items={navItems}>
        <Outlet />
      </AdminSidebar>
    </AdminMfaGate>
  );
}
