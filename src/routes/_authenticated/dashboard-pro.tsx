import { UserMfaGate } from "@/components/security/UserMfaGate";
import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { Gauge, LayoutDashboard, Truck, FileText, Building2, PlusCircle, Loader2, MapPin, Car, Users, Code2, LifeBuoy, MessageCircle, UserCog, CalendarDays, BarChart3, Network } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ProSidebar, type ProSidebarItem } from "@/components/dashboard-pro/ProSidebar";
import { useCurrentOrgAccountType } from "@/hooks/useCurrentOrgAccountType";
import { isApercuMode, apercuAccountType } from "@/lib/apercu-mode";
import { DemoAccountBanner, DEMO_ACCOUNT_EMAIL } from "@/components/demo/DemoAccountBanner";


export const Route = createFileRoute("/_authenticated/dashboard-pro")({
  component: ProLayout,
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/login" });
  },
});

function buildNavItems(accountType: "b2b_standard" | "flotte"): ProSidebarItem[] {
  if (accountType !== "flotte") {
    // B2B standard : menu simple, à plat (comportement inchangé)
    return [
      { to: "/dashboard-pro", label: "Tableau de bord", icon: LayoutDashboard, exact: true },
      { to: "/dashboard-pro/missions", label: "Missions", icon: Truck },
      { to: "/dashboard-pro/nouvelle-mission", label: "Nouvelle mission", icon: PlusCircle },
      { to: "/dashboard-pro/calendrier", label: "Calendrier", icon: CalendarDays },
      { to: "/dashboard-pro/remarketing", label: "Remarketing", icon: Car },
      { to: "/dashboard-pro/adresses", label: "Mes adresses", icon: MapPin },
      { to: "/dashboard-pro/documents", label: "Factures & devis", icon: FileText },
      { to: "/dashboard-pro/rapports", label: "Rapports", icon: BarChart3 },
      { to: "/dashboard-pro/fidelite", label: "Compte Kilomètres", icon: Gauge },
      { to: "/dashboard-pro/api", label: "API & Intégrations", icon: Code2 },
      { to: "/dashboard-pro/equipe", label: "Équipe & alertes", icon: UserCog },
      { to: "/dashboard-pro/societe", label: "Ma société", icon: Building2 },
      { to: "/dashboard-pro/conseiller", label: "Parler à un conseiller", icon: MessageCircle },
      { to: "/dashboard-pro/aide", label: "Aide & FAQ", icon: LifeBuoy },
    ];
  }
  // Flotte : menu rangé en sections repliables
  return [
    { group: "Essentiel", to: "/dashboard-pro", label: "Tableau de bord", icon: LayoutDashboard, exact: true },
    { group: "Essentiel", to: "/dashboard-pro/nouvelle-mission", label: "Nouvelle mission", icon: PlusCircle },
    { group: "Missions", to: "/dashboard-pro/missions", label: "Missions", icon: Truck },
    { group: "Missions", to: "/dashboard-pro/calendrier", label: "Calendrier", icon: CalendarDays },
    { group: "Parc & organisation", to: "/dashboard-pro/flotte", label: "Parc véhicules", icon: Car },
    { group: "Parc & organisation", to: "/dashboard-pro/remarketing", label: "Remarketing", icon: Car },
    { group: "Parc & organisation", to: "/dashboard-pro/sites", label: "Sites & agences", icon: Network },
    { group: "Parc & organisation", to: "/dashboard-pro/conducteurs", label: "Conducteurs", icon: Users },
    { group: "Parc & organisation", to: "/dashboard-pro/adresses", label: "Mes adresses", icon: MapPin },
    { group: "Facturation & suivi", to: "/dashboard-pro/documents", label: "Factures & devis", icon: FileText },
    { group: "Facturation & suivi", to: "/dashboard-pro/rapports", label: "Rapports", icon: BarChart3 },
    { group: "Facturation & suivi", to: "/dashboard-pro/fidelite", label: "Compte Kilomètres", icon: Gauge },
    { group: "Compte & aide", to: "/dashboard-pro/equipe", label: "Équipe & alertes", icon: UserCog },
    { group: "Compte & aide", to: "/dashboard-pro/societe", label: "Ma société", icon: Building2 },
    { group: "Compte & aide", to: "/dashboard-pro/api", label: "API & Intégrations", icon: Code2 },
    { group: "Compte & aide", to: "/dashboard-pro/conseiller", label: "Parler à un conseiller", icon: MessageCircle },
    { group: "Compte & aide", to: "/dashboard-pro/aide", label: "Aide & FAQ", icon: LifeBuoy },
  ];
}

function ProLayout() {
  const { isAuthenticated, isLoading, homeRoute } = useAuth();
  const navigate = useNavigate();
  const { data: orgInfo } = useCurrentOrgAccountType();
  const apercu = isApercuMode();
  const accountType = (apercu ? apercuAccountType() : null) ?? orgInfo?.accountType ?? "b2b_standard";
  const navItems = useMemo(() => buildNavItems(accountType), [accountType]);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isDemo = user?.email?.toLowerCase() === DEMO_ACCOUNT_EMAIL;

  // Un compte pro sans société rattachée en reçoit une (administrateur) :
  // sans cela import CSV, sites et équipe restent inaccessibles.
  useEffect(() => {
    if (apercu || !isAuthenticated || orgInfo === undefined || orgInfo.orgId) return;
    supabase.rpc("ensure_my_organization").then(({ data }) => {
      if (data) queryClient.invalidateQueries({ queryKey: ["current-org-account-type"] });
    });
  }, [apercu, isAuthenticated, orgInfo, queryClient]);

  useEffect(() => {
    if (isLoading || apercu) return;
    if (!isAuthenticated) {
      navigate({ to: "/login" });
      return;
    }
    if (homeRoute !== "/dashboard-pro") {
      navigate({ to: homeRoute, replace: true });
    }
  }, [isLoading, isAuthenticated, homeRoute, navigate, apercu]);

  if (isLoading || (!apercu && (!isAuthenticated || homeRoute !== "/dashboard-pro"))) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pro-bg">
        <Loader2 className="animate-spin text-pro-accent" size={32} />
      </div>
    );
  }


  return (
    <div className="dashboard-shell-light" data-account-type={accountType}>
      <ProSidebar items={navItems}>
        {isDemo && <DemoAccountBanner />}
        {apercu ? <Outlet /> : <UserMfaGate label="Espace professionnel"><Outlet /></UserMfaGate>}
      </ProSidebar>
    </div>
  );
}
