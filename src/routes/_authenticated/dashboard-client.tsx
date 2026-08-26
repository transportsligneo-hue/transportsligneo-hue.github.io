import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { Gauge, LayoutDashboard, Truck, PlusCircle, FolderOpen, UserCog, Loader2, FileText, MapPin, MailCheck, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ProSidebar, type ProSidebarItem } from "@/components/dashboard-pro/ProSidebar";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard-client")({
  component: ClientLayout,
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/login" });
  },
});

const navItems: ProSidebarItem[] = [
  { to: "/dashboard-client", label: "Vue d'ensemble", icon: LayoutDashboard, exact: true },
  { to: "/dashboard-client/nouvelle-reservation", label: "Nouvelle réservation", icon: PlusCircle },
  { to: "/dashboard-client/missions", label: "Mes missions", icon: Truck },
  { to: "/dashboard-client/devis", label: "Factures & devis", icon: FileText },
  { to: "/dashboard-client/adresses", label: "Mes adresses", icon: MapPin },
  { to: "/dashboard-client/fidelite", label: "Compte Kilomètres", icon: Gauge },
  { to: "/dashboard-client/documents", label: "Mes documents", icon: FolderOpen },
  { to: "/dashboard-client/profil", label: "Mon profil", icon: UserCog },
];

function ClientLayout() {
  const { isAuthenticated, roleActif, isLoading, homeRoute, user, refresh } = useAuth();
  const navigate = useNavigate();
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      navigate({ to: "/login" });
      return;
    }
    if (homeRoute !== "/dashboard-client") {
      navigate({ to: homeRoute, replace: true });
    }
  }, [isLoading, isAuthenticated, role, typeClient, homeRoute, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pro-bg">
        <Loader2 className="animate-spin text-pro-accent" size={32} />
      </div>
    );
  }

  // Pas de rôle actif chargé : distinguer email non confirmé vs activation en cours
  if (!roleActif) {
    const emailNotConfirmed = !!user && !user.email_confirmed_at;

    const handleResend = async () => {
      if (!user?.email) return;
      setResending(true);
      try {
        const { error } = await supabase.auth.resend({
          type: "signup",
          email: user.email,
          options: { emailRedirectTo: `${window.location.origin}/auth/email-confirmation` },
        });
        if (error) throw error;
        toast.success("Email de confirmation renvoyé.");
      } catch (e: any) {
        toast.error(e?.message || "Impossible de renvoyer l'email");
      } finally {
        setResending(false);
      }
    };

    return (
      <div className="min-h-screen flex items-center justify-center bg-pro-bg px-4">
        <div className="text-center space-y-5 max-w-md card-premium p-8 rounded">
          <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto">
            <MailCheck className="text-primary" size={28} />
          </div>
          <h1 className="font-heading text-xl text-primary tracking-[0.1em] uppercase">
            {emailNotConfirmed ? "Email à confirmer" : "Compte en cours d'activation"}
          </h1>
          <p className="text-pro-muted text-sm leading-relaxed">
            {emailNotConfirmed
              ? `Vérifiez votre boîte mail (${user?.email}) et cliquez sur le lien de confirmation pour activer votre espace.`
              : "Votre compte est en cours de finalisation. Rafraîchissez la page dans quelques instants."}
          </p>
          <div className="flex flex-col gap-2">
            {emailNotConfirmed && (
              <button
                onClick={handleResend}
                disabled={resending}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground text-xs uppercase tracking-[0.15em] hover:bg-gold-light transition-colors disabled:opacity-60"
              >
                {resending ? <Loader2 size={14} className="animate-spin" /> : <MailCheck size={14} />}
                Renvoyer l'email
              </button>
            )}
            <button
              onClick={() => refresh()}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 border border-primary/30 text-primary text-xs uppercase tracking-[0.15em] hover:bg-primary/10 transition-colors"
            >
              <RefreshCw size={14} /> Rafraîchir
            </button>
          </div>
          <a href="mailto:contact@transportsligneo.fr" className="block text-pro-accent text-xs hover:underline pt-2 border-t border-primary/10">
            Besoin d'aide ? contact@transportsligneo.fr
          </a>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || homeRoute !== "/dashboard-client") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pro-bg">
        <Loader2 className="animate-spin text-pro-accent" size={32} />
      </div>
    );
  }

  return (
    <div className="dashboard-shell-light" data-account-type="client">
      <ProSidebar items={navItems} audience="client">
        <Outlet />
      </ProSidebar>
    </div>
  );
}


