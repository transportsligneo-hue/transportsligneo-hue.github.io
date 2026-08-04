import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { FavoriteAddressesManager } from "@/components/dashboard-pro/FavoriteAddressesManager";
import FleetPageHeader from "@/components/flotte/FleetPageHeader";

export const Route = createFileRoute("/_authenticated/dashboard-pro/adresses")({
  component: AdressesPage,
});

function AdressesPage() {
  const { user } = useAuth();
  if (!user?.id || !user.email) {
    return <div className="p-8 text-sm text-slate-500">Chargement…</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-8 space-y-6">
      <FleetPageHeader
        breadcrumb="Mes adresses"
        eyebrow="Sites enregistrés"
        title="Mes"
        highlight="adresses"
        subtitle="Vos sites de départ et d'arrivée récurrents, préremplis automatiquement dans le formulaire « Nouvelle mission »."
      />


      <div className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
        <FavoriteAddressesManager clientUserId={user.id} clientEmail={user.email} variant="client" />
      </div>
    </div>
  );
}
