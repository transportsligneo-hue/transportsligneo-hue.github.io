import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard,
  Truck,
  CalendarDays,
  FolderOpen,
  History,
  UserRound,
  Loader2,
  Sparkles,
  GraduationCap,
  Wallet,
} from "lucide-react";
import { useEffect } from "react";
import { ConvoyeurSidebar, type ConvoyeurSidebarItem } from "@/components/convoyeur/ConvoyeurSidebar";

export const Route = createFileRoute("/_authenticated/convoyeur")({
  component: ConvoyeurLayout,
});

const navItems: ConvoyeurSidebarItem[] = [
  { to: "/convoyeur", label: "Tableau de bord", shortLabel: "Accueil", icon: LayoutDashboard, exact: true },
  { to: "/convoyeur/formation", label: "Formation", shortLabel: "Formation", icon: GraduationCap },
  { to: "/convoyeur/catalogue", label: "Catalogue missions", shortLabel: "Catalogue", icon: Sparkles },
  { to: "/convoyeur/missions", label: "Mes missions", shortLabel: "Mes missions", icon: Truck },
  { to: "/convoyeur/disponibilites", label: "Disponibilités", shortLabel: "Agenda", icon: CalendarDays },
  { to: "/convoyeur/documents", label: "Documents", shortLabel: "Docs", icon: FolderOpen },
  { to: "/convoyeur/historique", label: "Historique", icon: History },
  { to: "/convoyeur/finances", label: "Finances", shortLabel: "Finances", icon: Wallet },
  { to: "/convoyeur/profil", label: "Mon profil", shortLabel: "Profil", icon: UserRound },
];

function ConvoyeurLayout() {
  const { isAuthenticated, role, convoyeurStatut, isLoading, logout, homeRoute } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      navigate({ to: "/login" });
      return;
    }
    // Mauvais rôle → on redirige vers la home appropriée
    if (role && role !== "convoyeur") {
      navigate({ to: homeRoute });
    }
  }, [isLoading, isAuthenticated, role, homeRoute, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pro-bg">
        <Loader2 className="animate-spin text-emerald-600" size={32} />
      </div>
    );
  }

  if (!isAuthenticated || (role && role !== "convoyeur")) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pro-bg">
        <Loader2 className="animate-spin text-emerald-600" size={32} />
      </div>
    );
  }

  // Convoyeur refusé / suspendu : on bloque totalement
  if (role === "convoyeur" && (convoyeurStatut === "refuse" || convoyeurStatut === "suspendu")) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pro-bg px-4">
        <div className="text-center space-y-4 max-w-md bg-white rounded-xl border border-pro-border p-8 shadow-sm">
          <h1 className="font-semibold text-lg text-pro-text">
            {convoyeurStatut === "refuse" ? "Compte refusé" : "Compte suspendu"}
          </h1>
          <p className="text-pro-text-soft text-sm">
            {convoyeurStatut === "refuse"
              ? "Votre candidature n'a pas été retenue. Contactez-nous pour plus d'informations."
              : "Votre compte est temporairement suspendu. Contactez notre équipe."}
          </p>
          <div className="flex flex-col gap-2 items-center pt-2">
            <button onClick={() => logout()} className="text-sm text-red-600 hover:underline">Se déconnecter</button>
            <a href="/" className="text-xs text-pro-muted hover:text-pro-text transition-colors">← Retour au site</a>
          </div>
        </div>
      </div>
    );
  }

  const isPending = role === "convoyeur" && convoyeurStatut === "en_attente";

  return (
    <ConvoyeurSidebar items={navItems}>
      {isPending && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex items-start gap-3">
          <span className="text-amber-600 text-lg leading-none">⏳</span>
          <div>
            <p className="font-semibold">Votre compte est en attente de validation.</p>
            <p className="text-amber-800/90 mt-0.5">
              Vous pouvez déposer vos documents dès maintenant. Vous pourrez accepter des missions disponibles une fois vos documents validés par notre équipe.
            </p>
          </div>
        </div>
      )}
      <Outlet />
    </ConvoyeurSidebar>
  );
}

