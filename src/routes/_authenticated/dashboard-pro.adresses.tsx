import { createFileRoute } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { FavoriteAddressesManager } from "@/components/dashboard-pro/FavoriteAddressesManager";

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
      <header className="flex items-start gap-3">
        <div className="rounded-xl bg-amber-100 text-amber-700 p-2.5">
          <MapPin size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Mes adresses</h1>
          <p className="text-sm text-slate-600 mt-1">
            Enregistrez vos sites de départ et d'arrivée récurrents. L'adresse marquée
            <span className="font-semibold"> par défaut </span> sera préremplie automatiquement
            dans le formulaire « Nouvelle mission ».
          </p>
        </div>
      </header>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
        <FavoriteAddressesManager clientUserId={user.id} clientEmail={user.email} variant="client" />
      </div>
    </div>
  );
}
