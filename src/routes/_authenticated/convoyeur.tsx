import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard,
  Truck,
  CalendarDays,
  FolderOpen,
  History,
  UserRound,
  Loader2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardSidebar, type SidebarItem } from "@/components/dashboard/DashboardSidebar";

export const Route = createFileRoute("/_authenticated/convoyeur")({
  component: ConvoyeurLayout,
});

const navItems: SidebarItem[] = [
  { to: "/convoyeur", label: "Tableau de bord", icon: LayoutDashboard, exact: true },
  { to: "/convoyeur/missions", label: "Mes missions", icon: Truck },
  { to: "/convoyeur/disponibilites", label: "Disponibilités", icon: CalendarDays },
  { to: "/convoyeur/documents", label: "Documents", icon: FolderOpen },
  { to: "/convoyeur/historique", label: "Historique", icon: History },
  { to: "/convoyeur/profil", label: "Mon profil", icon: UserRound },
];

function ConvoyeurLayout() {
  const { isAuthenticated, user, role, isLoading, logout } = useAuth();
  const [convoyeurStatut, setConvoyeurStatut] = useState<string | null>(null);
  const [checkingStatut, setCheckingStatut] = useState(true);

  useEffect(() => {
    if (!user) { setCheckingStatut(false); return; }
    supabase
      .from("convoyeurs")
      .select("statut")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setConvoyeurStatut(data?.statut ?? null);
        setCheckingStatut(false);
      });
  }, [user]);

  if (isLoading || checkingStatut) {
    return (
      <div className="min-h-screen flex items-center justify-center section-bg">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (!isAuthenticated) {
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    return null;
  }

  if (role !== "convoyeur" || convoyeurStatut !== "valide") {
    return (
      <div className="min-h-screen flex items-center justify-center section-bg px-4">
        <div className="text-center space-y-4 max-w-md">
          <h1 className="font-heading text-xl text-primary tracking-[0.1em] uppercase">
            {convoyeurStatut === "en_attente" ? "Compte en attente" : convoyeurStatut === "refuse" ? "Compte refusé" : "Accès non autorisé"}
          </h1>
          <p className="text-cream/50 text-sm">
            {convoyeurStatut === "en_attente"
              ? "Votre inscription est en cours de validation par notre équipe. Vous recevrez un email dès qu'elle sera approuvée."
              : convoyeurStatut === "refuse"
              ? "Votre candidature n'a pas été retenue. Contactez-nous pour plus d'informations."
              : "Vous n'avez pas les droits pour accéder à cet espace."}
          </p>
          <div className="flex flex-col gap-2 items-center">
            <button onClick={() => logout()} className="text-cream/50 text-sm hover:text-primary transition-colors">Se déconnecter</button>
            <a href="/" className="text-cream/40 text-xs hover:text-primary transition-colors">← Retour au site</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <DashboardSidebar
      title="Espace Convoyeur"
      subtitle="Missions & disponibilités"
      items={navItems}
    >
      <Outlet />
    </DashboardSidebar>
  );
}
