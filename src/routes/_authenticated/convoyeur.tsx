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
  Gavel,
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ConvoyeurSidebar, type ConvoyeurSidebarItem } from "@/components/convoyeur/ConvoyeurSidebar";

export const Route = createFileRoute("/_authenticated/convoyeur")({
  component: ConvoyeurLayout,
});

const navItems: ConvoyeurSidebarItem[] = [
  { to: "/convoyeur", label: "Tableau de bord", shortLabel: "Accueil", icon: LayoutDashboard, exact: true },
  { to: "/convoyeur/disponibles", label: "Missions dispo", shortLabel: "Dispo", icon: Gavel },
  { to: "/convoyeur/missions", label: "Mes missions", shortLabel: "Missions", icon: Truck },
  { to: "/convoyeur/disponibilites", label: "Disponibilités", shortLabel: "Agenda", icon: CalendarDays },
  { to: "/convoyeur/documents", label: "Documents", shortLabel: "Docs", icon: FolderOpen },
  { to: "/convoyeur/historique", label: "Historique", icon: History },
  { to: "/convoyeur/profil", label: "Mon profil", shortLabel: "Profil", icon: UserRound },
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
      <div className="min-h-screen flex items-center justify-center bg-pro-bg">
        <Loader2 className="animate-spin text-emerald-600" size={32} />
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
      <div className="min-h-screen flex items-center justify-center bg-pro-bg px-4">
        <div className="text-center space-y-4 max-w-md bg-white rounded-xl border border-pro-border p-8 shadow-sm">
          <h1 className="font-semibold text-lg text-pro-text">
            {convoyeurStatut === "en_attente" ? "Compte en attente de validation" : convoyeurStatut === "refuse" ? "Compte refusé" : "Accès non autorisé"}
          </h1>
          <p className="text-pro-text-soft text-sm">
            {convoyeurStatut === "en_attente"
              ? "Votre inscription est en cours de validation par notre équipe. Vous recevrez un email dès qu'elle sera approuvée."
              : convoyeurStatut === "refuse"
              ? "Votre candidature n'a pas été retenue. Contactez-nous pour plus d'informations."
              : "Vous n'avez pas les droits pour accéder à cet espace."}
          </p>
          <div className="flex flex-col gap-2 items-center pt-2">
            <button onClick={() => logout()} className="text-sm text-red-600 hover:underline">Se déconnecter</button>
            <a href="/" className="text-xs text-pro-muted hover:text-pro-text transition-colors">← Retour au site</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ConvoyeurSidebar items={navItems}>
      <Outlet />
    </ConvoyeurSidebar>
  );
}
